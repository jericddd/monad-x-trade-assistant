import type { XTweet } from "./types.js";

function stripMentions(text: string): string {
  return text
    .replace(/@[\w_]+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * MonEx game commands share @monexmonad. Trade Assistant must stay silent
 * so the game bot can reply (e.g. catch) without a "trade rejected" duplicate.
 */
export function isGameCommand(text: string): boolean {
  const normalized = stripMentions(text).toLowerCase();
  if (!normalized) return false;
  if (normalized === "catch" || normalized.startsWith("catch ")) return true;
  if (normalized === "open pack") return true;
  return false;
}

/**
 * True when the mention looks like a trade buy attempt.
 * Trade format is strict (`buy <amount> mon 0x…`); anything else is not our job.
 */
export function isPotentialCommand(text: string, botUsername: string): boolean {
  const lower = text.toLowerCase();
  const bot = botUsername.toLowerCase().replace(/^@/, "");
  if (!lower.includes(`@${bot}`)) return false;
  if (isGameCommand(text)) return false;
  // After stripping mentions, command should start with buy (strict product).
  const body = stripMentions(text).toLowerCase();
  return body.startsWith("buy");
}

/** Whether a failed parse should post a public "trade rejected" reply. */
export function shouldReplyToInvalidCommand(text: string, botUsername: string): boolean {
  return isPotentialCommand(text, botUsername);
}

export function sortMentionsOldestFirst(tweets: XTweet[]): XTweet[] {
  return [...tweets].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

export function filterUnseenMentions(tweets: XTweet[], seenIds: Set<string>): XTweet[] {
  return tweets.filter((tweet) => !seenIds.has(tweet.id));
}
