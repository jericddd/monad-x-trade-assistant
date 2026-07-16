import { buildOAuth1AuthorizationHeader } from "./oauth1.js";
import { createTradeError } from "../trading/errors.js";

export type XTweet = {
  id: string;
  authorId: string;
  text: string;
  createdAt?: string;
};

export type MentionsResponse = {
  tweets: XTweet[];
  newestId?: string;
};

export interface XClient {
  fetchMentions(input: { sinceId?: string; botUserId: string }): Promise<MentionsResponse>;
  replyToTweet(input: { inReplyToTweetId: string; text: string }): Promise<{ id: string }>;
}

export type XCredentials = {
  bearerToken: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

export class MockXClient implements XClient {
  private readonly mentions: XTweet[];
  private readonly replied = new Set<string>();

  constructor(mentions: XTweet[] = []) {
    this.mentions = mentions;
  }

  async fetchMentions(input: { sinceId?: string; botUserId: string }): Promise<MentionsResponse> {
    void input.botUserId;
    const filtered = input.sinceId
      ? this.mentions.filter((tweet) => BigInt(tweet.id) > BigInt(input.sinceId!))
      : [...this.mentions];

    filtered.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));

    return {
      tweets: filtered,
      newestId: filtered.at(-1)?.id,
    };
  }

  async replyToTweet(input: { inReplyToTweetId: string; text: string }): Promise<{ id: string }> {
    if (this.replied.has(input.inReplyToTweetId)) {
      throw new Error("duplicate reply");
    }

    this.replied.add(input.inReplyToTweetId);
    return { id: `reply-${input.inReplyToTweetId}` };
  }

  hasReplied(tweetId: string): boolean {
    return this.replied.has(tweetId);
  }
}

type MentionsApiResponse = {
  data?: Array<{
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
  }>;
  meta?: {
    newest_id?: string;
    result_count?: number;
  };
};

export class RealXClient implements XClient {
  constructor(private readonly credentials: XCredentials) {}

  async fetchMentions(input: { sinceId?: string; botUserId: string }): Promise<MentionsResponse> {
    const url = new URL(`https://api.x.com/2/users/${input.botUserId}/mentions`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("tweet.fields", "author_id,created_at,text");
    if (input.sinceId) {
      url.searchParams.set("since_id", input.sinceId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.credentials.bearerToken}`,
      },
    });

    if (!response.ok) {
      throw createTradeError("X_API_ERROR");
    }

    const body = (await response.json()) as MentionsApiResponse;
    const tweets: XTweet[] = (body.data ?? [])
      .filter((tweet) => tweet.author_id && tweet.text)
      .map((tweet) => ({
        id: tweet.id,
        authorId: tweet.author_id!,
        text: tweet.text,
        createdAt: tweet.created_at,
      }))
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));

    return {
      tweets,
      newestId: body.meta?.newest_id ?? tweets.at(-1)?.id,
    };
  }

  async replyToTweet(input: { inReplyToTweetId: string; text: string }): Promise<{ id: string }> {
    const url = "https://api.x.com/2/tweets";
    const authorization = await buildOAuth1AuthorizationHeader({
      method: "POST",
      url,
      consumerKey: this.credentials.apiKey,
      consumerSecret: this.credentials.apiSecret,
      accessToken: this.credentials.accessToken,
      accessTokenSecret: this.credentials.accessTokenSecret,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        reply: {
          in_reply_to_tweet_id: input.inReplyToTweetId,
        },
      }),
    });

    if (!response.ok) {
      throw createTradeError("X_REPLY_FAILED");
    }

    const body = (await response.json()) as { data?: { id?: string } };
    if (!body.data?.id) {
      throw createTradeError("X_REPLY_FAILED");
    }

    return { id: body.data.id };
  }
}

export function createXClient(env: Record<string, unknown>): XClient {
  if (env.USE_MOCK_X === true || env.USE_MOCK_X === "true") {
    return new MockXClient();
  }

  const bearerToken = env.X_BEARER_TOKEN;
  const apiKey = env.X_API_KEY;
  const apiSecret = env.X_API_SECRET;
  const accessToken = env.X_ACCESS_TOKEN;
  const accessTokenSecret = env.X_ACCESS_TOKEN_SECRET;

  if (
    typeof bearerToken !== "string" ||
    typeof apiKey !== "string" ||
    typeof apiSecret !== "string" ||
    typeof accessToken !== "string" ||
    typeof accessTokenSecret !== "string" ||
    !bearerToken ||
    !apiKey ||
    !apiSecret ||
    !accessToken ||
    !accessTokenSecret
  ) {
    return new MockXClient();
  }

  return new RealXClient({
    bearerToken,
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret,
  });
}
