import type { AppEnv } from "../env.js";
import type { XClient } from "./client.js";
import { processMentionReplies } from "./replies.js";
import { logError, logInfo } from "../utils/logging.js";
import type { ProcessMentionResponse } from "../durable-objects/trade-coordinator.js";

export type PollResult = {
  processed: number;
  failed: number;
  newestCursor?: string;
  skippedOverlap?: boolean;
};

async function getCoordinatorStub(env: AppEnv): Promise<DurableObjectStub> {
  if (!env.TRADE_COORDINATOR) {
    throw new Error("TRADE_COORDINATOR binding is missing");
  }

  const id = env.TRADE_COORDINATOR.idFromName("primary");
  return env.TRADE_COORDINATOR.get(id);
}

async function getCursor(stub: DurableObjectStub): Promise<string | null> {
  const response = await stub.fetch("https://trade-coordinator/cursor");
  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { cursor: string | null };
  return body.cursor;
}

async function setCursor(stub: DurableObjectStub, cursor: string): Promise<void> {
  await stub.fetch("https://trade-coordinator/cursor", {
    method: "PUT",
    body: JSON.stringify({ cursor }),
  });
}

async function acquirePollLock(stub: DurableObjectStub): Promise<boolean> {
  const response = await stub.fetch("https://trade-coordinator/poll-lock", { method: "POST" });
  const body = (await response.json()) as { acquired: boolean };
  return body.acquired;
}

async function releasePollLock(stub: DurableObjectStub): Promise<void> {
  await stub.fetch("https://trade-coordinator/poll-lock", { method: "DELETE" });
}

async function processThroughCoordinator(
  stub: DurableObjectStub,
  mention: { tweetId: string; authorId: string; text: string },
): Promise<ProcessMentionResponse> {
  const response = await stub.fetch("https://trade-coordinator/process-mention", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tweetId: mention.tweetId,
      authorId: mention.authorId,
      text: mention.text,
    }),
  });

  return (await response.json()) as ProcessMentionResponse;
}

async function markReplied(
  stub: DurableObjectStub,
  tweetId: string,
  status: string,
): Promise<void> {
  await stub.fetch("https://trade-coordinator/mark-replied", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tweetId, status }),
  });
}

export async function pollMentions(env: AppEnv, client: XClient): Promise<PollResult> {
  const stub = await getCoordinatorStub(env);
  const acquired = await acquirePollLock(stub);
  if (!acquired) {
    logInfo("poll_skipped_overlap", {});
    return { processed: 0, failed: 0, skippedOverlap: true };
  }

  try {
    const sinceId = (await getCursor(stub)) ?? undefined;
    // Same as MonEx catch bot: bot id always comes from OAuth /users/me.
    const botUser = await client.resolveBotUser();

    logInfo("poll_bot_resolved", {
      botUserId: botUser.id,
      botUsername: botUser.username,
    });

    const mentions = await client.fetchMentions({ sinceId });

    let processed = 0;
    let failed = 0;
    const replyQueue: Array<{
      tweetId: string;
      replyText?: string;
      fallbackReplyText?: string;
      replied?: boolean;
      status?: string;
    }> = [];

    for (const tweet of mentions.tweets) {
      try {
        const result = await processThroughCoordinator(stub, {
          tweetId: tweet.id,
          authorId: tweet.authorId,
          text: tweet.text,
        });

        if (result.replyText) {
          replyQueue.push({
            tweetId: tweet.id,
            replyText: result.replyText,
            fallbackReplyText: result.fallbackReplyText,
            status: result.status,
          });
        }

        if (result.ok) {
          processed += 1;
        } else if (result.failureCode === "UNAUTHORIZED_AUTHOR") {
          logInfo("mention_skipped_unauthorized", {
            tweetId: tweet.id,
            authorId: tweet.authorId,
          });
        } else {
          failed += 1;
          logInfo("mention_rejected", {
            tweetId: tweet.id,
            authorId: tweet.authorId,
            failureCode: result.failureCode,
          });
        }
      } catch (error) {
        failed += 1;
        logError("mention_processing_failed", {
          tweetId: tweet.id,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    await processMentionReplies(client, replyQueue);

    for (const item of replyQueue) {
      if (item.replied && item.status) {
        await markReplied(stub, item.tweetId, item.status);
      }
    }

    const newestCursor = mentions.newestId ?? sinceId;
    if (newestCursor) {
      await setCursor(stub, newestCursor);
    }

    logInfo("poll_completed", {
      processed,
      failed,
      newestCursor,
    });

    return {
      processed,
      failed,
      newestCursor,
    };
  } finally {
    await releasePollLock(stub);
  }
}

export async function confirmPendingTrades(
  env: AppEnv,
  client: XClient,
): Promise<{ checked: number; confirmed: number }> {
  const stub = await getCoordinatorStub(env);
  const response = await stub.fetch("https://trade-coordinator/confirm-pending", {
    method: "POST",
  });
  const body = (await response.json()) as {
    checked: number;
    confirmed: number;
    reverted: number;
    replies: Array<{
      tweetId: string;
      replyText: string;
      fallbackReplyText?: string;
      status: string;
    }>;
  };

  const replyQueue = body.replies.map((reply) => ({
    tweetId: reply.tweetId,
    replyText: reply.replyText,
    fallbackReplyText: reply.fallbackReplyText,
    status: reply.status,
    replied: false as boolean | undefined,
  }));

  await processMentionReplies(client, replyQueue);

  for (const item of replyQueue) {
    if (item.replied && item.status) {
      await markReplied(stub, item.tweetId, item.status);
    }
  }

  logInfo("confirmation_pass", {
    checked: body.checked,
    confirmed: body.confirmed,
    reverted: body.reverted,
  });

  return { checked: body.checked, confirmed: body.confirmed };
}

export async function runScheduledPoll(env: AppEnv, client: XClient): Promise<void> {
  await pollMentions(env, client);
  await confirmPendingTrades(env, client);
}
