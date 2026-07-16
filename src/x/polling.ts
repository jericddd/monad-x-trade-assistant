import type { AppEnv } from "../env.js";
import type { XClient } from "./client.js";
import { processMentionReplies } from "./replies.js";
import { logError, logInfo } from "../utils/logging.js";
import type { ProcessMentionResponse } from "../durable-objects/trade-coordinator.js";

export type PollResult = {
  processed: number;
  failed: number;
  newestCursor?: string;
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

async function processThroughCoordinator(
  stub: DurableObjectStub,
  mention: { tweetId: string; authorId: string; text: string },
  env: Partial<AppEnv>,
): Promise<ProcessMentionResponse> {
  const response = await stub.fetch("https://trade-coordinator/process-mention", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tweetId: mention.tweetId,
      authorId: mention.authorId,
      text: mention.text,
      env,
    }),
  });

  return (await response.json()) as ProcessMentionResponse;
}

export async function pollMentions(env: AppEnv, client: XClient): Promise<PollResult> {
  const stub = await getCoordinatorStub(env);
  const sinceId = (await getCursor(stub)) ?? undefined;

  const mentions = await client.fetchMentions({
    sinceId,
    botUserId: env.X_BOT_USER_ID,
  });

  let processed = 0;
  let failed = 0;
  const replyQueue: Array<{ tweetId: string; replyText?: string; replied?: boolean }> = [];

  for (const tweet of mentions.tweets) {
    try {
      const result = await processThroughCoordinator(
        stub,
        {
          tweetId: tweet.id,
          authorId: tweet.authorId,
          text: tweet.text,
        },
        env,
      );

      if (result.replyText) {
        replyQueue.push({ tweetId: tweet.id, replyText: result.replyText });
      }

      if (result.ok) {
        processed += 1;
      } else {
        failed += 1;
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
}

export async function runScheduledPoll(env: AppEnv, client: XClient): Promise<void> {
  await pollMentions(env, client);
}
