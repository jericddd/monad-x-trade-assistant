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

export function createXClient(_env: Record<string, unknown>): XClient {
  return new MockXClient();
}
