export interface CloudflareEnv {
  PACK_ASSETS: R2Bucket;
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  SESSION_SECRET: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
  X_CALLBACK_URL: string;
  X_BOT_WEBHOOK_SECRET: string;
  MONAD_PACKS_WEBSITE_URL: string;
  ADMIN_X_USER_IDS: string;
  CRON_SECRET: string;
  R2_PUBLIC_URL?: string;
  NFT_CONTRACT_ADDRESS?: string;
  MINT_WALLET_PRIVATE_KEY?: string;
  MONAD_RPC_URL?: string;
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: object): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream | null } | null>;
}
