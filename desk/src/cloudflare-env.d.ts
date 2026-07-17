import type { CloudflareEnv as AppCloudflareEnv } from "@/types/cloudflare-env";

declare module "@opennextjs/cloudflare" {
  export interface CloudflareEnv extends AppCloudflareEnv {}
}
