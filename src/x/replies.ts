import type { AppEnv } from "../env.js";
import type { XClient } from "./client.js";
import { logError, logInfo } from "../utils/logging.js";
import { stripUrls } from "../trading/replies.js";

export async function replyToMention(
  client: XClient,
  tweetId: string,
  text: string,
): Promise<void> {
  // Never post links — X charges heavily for URL replies.
  await client.replyToTweet({ inReplyToTweetId: tweetId, text: stripUrls(text) });
}

export async function replySafely(
  client: XClient,
  tweetId: string,
  text: string,
): Promise<boolean> {
  try {
    await replyToMention(client, tweetId, text);
    return true;
  } catch (error) {
    logError("x_reply_failed", {
      tweetId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export function shouldReply(existingReplySent: boolean): boolean {
  return !existingReplySent;
}

export function buildUnauthorizedReply(): string {
  return "trade rejected\n\nreason: this account is not authorized to trade";
}

export async function processMentionReplies(
  client: XClient,
  results: Array<{ tweetId: string; replyText?: string; replied?: boolean }>,
): Promise<void> {
  for (const result of results) {
    if (!result.replyText || result.replied) {
      continue;
    }

    const sent = await replySafely(client, result.tweetId, result.replyText);
    result.replied = sent;
    logInfo("x_reply_sent", { tweetId: result.tweetId, sent });
  }
}

export type ReplyContext = {
  env: Partial<AppEnv>;
  client: XClient;
};
