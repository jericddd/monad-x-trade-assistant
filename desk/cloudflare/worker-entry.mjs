/**
 * Wraps the OpenNext worker to add Cloudflare cron support.
 * Regenerated OpenNext output stays in .open-next/worker.js.
 */
export {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "../.open-next/worker.js";

import openNextWorker from "../.open-next/worker.js";

export default {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    const base = (env.NEXT_PUBLIC_APP_URL ?? "https://trade.monexmonad.xyz").replace(/\/$/, "");
    const request = new Request(`${base}/api/cron/expire`, {
      method: "GET",
      headers: env.CRON_SECRET ? { Authorization: `Bearer ${env.CRON_SECRET}` } : {},
    });

    ctx.waitUntil(
      openNextWorker.fetch(request, env, ctx).catch((error) => {
        console.error("scheduled expire cron failed", error);
      }),
    );
  },
};
