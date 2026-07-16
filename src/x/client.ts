import { buildOAuth1AuthorizationHeader } from "./oauth1.js";
import { createTradeError } from "../trading/errors.js";
import { normalizeNumericUserId, normalizeOptionalNumericUserId } from "./user-id.js";

const X_API_BASE = "https://api.twitter.com/2";

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

export type XBotUser = {
  id: string;
  username: string;
};

export interface XClient {
  resolveBotUser(): Promise<XBotUser>;
  fetchMentions(input: { sinceId?: string; botUserId?: string }): Promise<MentionsResponse>;
  replyToTweet(input: { inReplyToTweetId: string; text: string }): Promise<{ id: string }>;
}

export type XCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  /** Optional fallback if resolveBotUser fails or for offline config. */
  botUserId?: string;
};

export class MockXClient implements XClient {
  private readonly mentions: XTweet[];
  private readonly replied = new Set<string>();
  private readonly botUser: XBotUser;

  constructor(mentions: XTweet[] = [], botUser: XBotUser = { id: "1", username: "monexmonad" }) {
    this.mentions = mentions;
    this.botUser = botUser;
  }

  async resolveBotUser(): Promise<XBotUser> {
    return this.botUser;
  }

  async fetchMentions(input: { sinceId?: string; botUserId?: string }): Promise<MentionsResponse> {
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

async function readXApiError(response: Response): Promise<string> {
  try {
    const errBody = (await response.json()) as {
      detail?: string;
      title?: string;
      errors?: Array<{ message?: string; detail?: string }>;
    };
    return (
      errBody.detail ??
      errBody.errors?.map((entry) => entry.detail ?? entry.message).filter(Boolean).join("; ") ??
      errBody.title ??
      ""
    );
  } catch {
    return "";
  }
}

export class RealXClient implements XClient {
  private cachedBotUser: XBotUser | null = null;

  constructor(private readonly credentials: XCredentials) {}

  async resolveBotUser(): Promise<XBotUser> {
    if (this.cachedBotUser) {
      return this.cachedBotUser;
    }

    const url = `${X_API_BASE}/users/me?user.fields=username,id`;
    const authorization = await buildOAuth1AuthorizationHeader({
      method: "GET",
      url,
      consumerKey: this.credentials.apiKey,
      consumerSecret: this.credentials.apiSecret,
      accessToken: this.credentials.accessToken,
      accessTokenSecret: this.credentials.accessTokenSecret,
    });

    const response = await fetch(url, {
      headers: { Authorization: authorization },
    });

    if (!response.ok) {
      if (this.credentials.botUserId) {
        const id = normalizeNumericUserId(this.credentials.botUserId, "X_BOT_USER_ID");
        this.cachedBotUser = { id, username: "monexmonad" };
        return this.cachedBotUser;
      }
      const detail = await readXApiError(response);
      const suffix = detail ? `: ${detail}` : "";
      throw createTradeError("X_API_ERROR", `users/me request failed (${response.status})${suffix}`);
    }

    const body = (await response.json()) as { data?: { id?: string; username?: string } };
    if (!body.data?.id) {
      throw createTradeError("X_API_ERROR", "users/me response missing bot user id");
    }

    this.cachedBotUser = {
      id: body.data.id,
      username: body.data.username ?? "monexmonad",
    };
    return this.cachedBotUser;
  }

  async fetchMentions(input: { sinceId?: string; botUserId?: string }): Promise<MentionsResponse> {
    const botUserId = input.botUserId
      ? normalizeNumericUserId(input.botUserId, "X_BOT_USER_ID")
      : (await this.resolveBotUser()).id;
    const sinceId = normalizeOptionalNumericUserId(input.sinceId);

    const url = new URL(`${X_API_BASE}/users/${botUserId}/mentions`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("tweet.fields", "author_id,created_at,text");
    if (sinceId) {
      url.searchParams.set("since_id", sinceId);
    }

    const authorization = await buildOAuth1AuthorizationHeader({
      method: "GET",
      url: url.toString(),
      consumerKey: this.credentials.apiKey,
      consumerSecret: this.credentials.apiSecret,
      accessToken: this.credentials.accessToken,
      accessTokenSecret: this.credentials.accessTokenSecret,
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      const detail = await readXApiError(response);
      const suffix = detail ? `: ${detail}` : "";
      throw createTradeError("X_API_ERROR", `mentions request failed (${response.status})${suffix}`);
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
    const url = `${X_API_BASE}/tweets`;
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

  const apiKey = env.X_API_KEY;
  const apiSecret = env.X_API_SECRET;
  const accessToken = env.X_ACCESS_TOKEN;
  const accessTokenSecret = env.X_ACCESS_TOKEN_SECRET;
  const botUserId = typeof env.X_BOT_USER_ID === "string" ? env.X_BOT_USER_ID.trim() : undefined;

  if (
    typeof apiKey !== "string" ||
    typeof apiSecret !== "string" ||
    typeof accessToken !== "string" ||
    typeof accessTokenSecret !== "string" ||
    !apiKey ||
    !apiSecret ||
    !accessToken ||
    !accessTokenSecret
  ) {
    return new MockXClient();
  }

  return new RealXClient({
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    accessToken: accessToken.trim(),
    accessTokenSecret: accessTokenSecret.trim(),
    botUserId: botUserId || undefined,
  });
}
