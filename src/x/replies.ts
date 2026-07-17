import type { AppEnv } from "../env.js";
import type { XClient } from "./client.js";
import { logError, logInfo } from "../utils/logging.js";
import {
  isDuplicateXReplyError,
  isPermanentXReplyError,
  stripCryptoAddresses,
  stripUrls,
} from "../trading/replies.js";

export async function replyToMention(
  client: XClient,
  tweetId: string,
  text: string,
): Promise<void> {
  // Never post links or 0x payloads — X blocks crypto addresses for new auth.
  const sanitized = stripCryptoAddresses(stripUrls(text));
  await client.replyToTweet({ inReplyToTweetId: tweetId, text: sanitized });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}

export async function replySafely(
  client: XClient,
  tweetId: string,
  text: string,
  fallbackText?: string,
): Promise<boolean> {
  try {
    await replyToMention(client, tweetId, text);
    return true;
  } catch (error) {
    const message = errorMessage(error);
    if (isDuplicateXReplyError(message) || isPermanentXReplyError(message)) {
      logInfo("x_reply_treated_as_sent", { tweetId, message });
      return true;
    }

    const compact = fallbackText?.trim();
    if (compact && compact !== stripCryptoAddresses(stripUrls(text))) {
      try {
        await replyToMention(client, tweetId, compact);
        logInfo("x_reply_sent_compact_fallback", { tweetId });
        return true;
      } catch (fallbackError) {
        const fallbackMessage = errorMessage(fallbackError);
        if (isDuplicateXReplyError(fallbackMessage) || isPermanentXReplyError(fallbackMessage)) {
          logInfo("x_reply_treated_as_sent", {
            tweetId,
            message: fallbackMessage,
            via: "compact",
          });
          return true;
        }
        logError("x_reply_failed", { tweetId, message, fallbackMessage });
        return false;
      }
    }

    logError("x_reply_failed", { tweetId, message });
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
  results: Array<{
    tweetId: string;
    replyText?: string;
    fallbackReplyText?: string;
    replied?: boolean;
  }>,
): Promise<void> {
  for (const result of results) {
    if (!result.replyText || result.replied) {
      continue;
    }

    const sent = await replySafely(
      client,
      result.tweetId,
      result.replyText,
      result.fallbackReplyText,
    );
    result.replied = sent;
    logInfo("x_reply_sent", { tweetId: result.tweetId, sent });
  }
}

export type ReplyContext = {
  env: Partial<AppEnv>;
  client: XClient;
};
