import type { XTweet } from "./types.js";

export function isPotentialCommand(text: string, botUsername: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes(`@${botUsername.toLowerCase()}`) && normalized.includes("buy");
}

export function sortMentionsOldestFirst(tweets: XTweet[]): XTweet[] {
  return [...tweets].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

export function filterUnseenMentions(tweets: XTweet[], seenIds: Set<string>): XTweet[] {
  return tweets.filter((tweet) => !seenIds.has(tweet.id));
}
