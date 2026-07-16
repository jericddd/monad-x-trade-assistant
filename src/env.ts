import { z } from "zod";
import { isAddress, isHex } from "viem";
import { DEFAULT_ALLOWED_ROUTERS, NADFUN_MAINNET } from "./blockchain/nadfun/config.js";

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

const positiveDecimalString = z
  .string()
  .regex(/^\d+(?:\.\d+)?$/, "must be a positive decimal string");

const addressSchema = z
  .string()
  .refine((value) => isAddress(value), "must be a valid address")
  .transform((value) => value as `0x${string}`);

const userIdSchema = z.string().regex(/^\d+$/, "must be a numeric user id");

const privateKeySchema = z
  .string()
  .optional()
  .refine((value) => !value || isHex(value), "must be a hex private key");

export const envSchema = z
  .object({
    // Optional: MonEx-style OAuth 1.0a mentions do not need a Bearer token.
    X_BEARER_TOKEN: z.string().min(1).optional(),
    X_API_KEY: z.string().min(1),
    X_API_SECRET: z.string().min(1),
    X_ACCESS_TOKEN: z.string().min(1),
    X_ACCESS_TOKEN_SECRET: z.string().min(1),
    X_BOT_USERNAME: z.string().min(1),
    // Bootstrap allowlist (legacy single-user). Multi-user auth uses USER_REGISTRY.
    AUTHORIZED_X_USER_ID: userIdSchema.optional(),
    MONAD_RPC_URL: z.string().url(),
    MONAD_CHAIN_ID: z.coerce.number().int().positive(),
    MONAD_EXPLORER_TX_URL: z.string().url(),
    TRADE_WALLET_PRIVATE_KEY: privateKeySchema,
    /** Master seed for per-user in-site wallets. Falls back to TRADE_WALLET_PRIVATE_KEY. */
    CUSTODIAL_MASTER_SEED: z.string().min(16).optional(),
    /** Shared secret for packs.monexmonad.xyz → Worker link/withdraw APIs. */
    SITE_API_SECRET: z.string().min(16).optional(),
    NADFUN_LENS_ADDRESS: addressSchema,
    NADFUN_ALLOWED_ROUTER_ADDRESSES: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      .refine((values) => values.length > 0 && values.every((value) => isAddress(value)), {
        message: "must contain at least one valid router address",
      }),
    TRADING_ENABLED: booleanFromString,
    TRADE_DRY_RUN: booleanFromString,
    MAX_MON_PER_TRADE: positiveDecimalString,
    MAX_MON_PER_DAY: positiveDecimalString,
    MAX_TRADES_PER_HOUR: z.coerce.number().int().positive(),
    DEFAULT_SLIPPAGE_BPS: z.coerce.number().int().min(0).max(1000),
    MAX_PRICE_IMPACT_BPS: z.coerce.number().int().min(0),
    TRADE_DEADLINE_SECONDS: z.coerce.number().int().positive(),
    MIN_WALLET_RESERVE_MON: positiveDecimalString,
    USE_MOCK_BLOCKCHAIN: booleanFromString.optional(),
    USE_MOCK_X: booleanFromString.optional(),
    TRADE_COORDINATOR: z.custom<DurableObjectNamespace>().optional(),
    USER_REGISTRY: z.custom<DurableObjectNamespace>().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.TRADING_ENABLED && !env.TRADE_DRY_RUN) {
      if (!env.TRADE_WALLET_PRIVATE_KEY && !env.CUSTODIAL_MASTER_SEED) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "TRADE_WALLET_PRIVATE_KEY or CUSTODIAL_MASTER_SEED is required when live trading is enabled",
          path: ["TRADE_WALLET_PRIVATE_KEY"],
        });
      }
      if (!env.NADFUN_LENS_ADDRESS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NADFUN_LENS_ADDRESS is required for live trading",
          path: ["NADFUN_LENS_ADDRESS"],
        });
      }
      if (!env.NADFUN_ALLOWED_ROUTER_ADDRESSES?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NADFUN_ALLOWED_ROUTER_ADDRESSES must not be empty for live trading",
          path: ["NADFUN_ALLOWED_ROUTER_ADDRESSES"],
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema> & {
  USE_MOCK_BLOCKCHAIN?: boolean;
  USE_MOCK_X?: boolean;
};

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration: ${issues.join("; ")}`);
  }

  return result.data;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

export function parseEnvLenient(raw: Record<string, unknown>): Partial<AppEnv> {
  const defaults: Record<string, unknown> = {
    TRADING_ENABLED: "false",
    TRADE_DRY_RUN: "true",
    MAX_MON_PER_TRADE: "10",
    MAX_MON_PER_DAY: "30",
    MAX_TRADES_PER_HOUR: "3",
    DEFAULT_SLIPPAGE_BPS: "300",
    MAX_PRICE_IMPACT_BPS: "1000",
    TRADE_DEADLINE_SECONDS: "120",
    MIN_WALLET_RESERVE_MON: "1",
    MONAD_CHAIN_ID: "143",
    NADFUN_LENS_ADDRESS: NADFUN_MAINNET.LENS,
    NADFUN_ALLOWED_ROUTER_ADDRESSES: DEFAULT_ALLOWED_ROUTERS.join(","),
    ...raw,
  };

  const routerRaw = defaults.NADFUN_ALLOWED_ROUTER_ADDRESSES;
  const routers = Array.isArray(routerRaw)
    ? (routerRaw as string[])
    : typeof routerRaw === "string"
      ? routerRaw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [...DEFAULT_ALLOWED_ROUTERS];

  return {
    TRADING_ENABLED: asBoolean(defaults.TRADING_ENABLED, false),
    TRADE_DRY_RUN: asBoolean(defaults.TRADE_DRY_RUN, true),
    MAX_MON_PER_TRADE: String(defaults.MAX_MON_PER_TRADE ?? "10"),
    MAX_MON_PER_DAY: String(defaults.MAX_MON_PER_DAY ?? "30"),
    MAX_TRADES_PER_HOUR: Number(defaults.MAX_TRADES_PER_HOUR ?? 3),
    DEFAULT_SLIPPAGE_BPS: Number(defaults.DEFAULT_SLIPPAGE_BPS ?? 300),
    MAX_PRICE_IMPACT_BPS: Number(defaults.MAX_PRICE_IMPACT_BPS ?? 1000),
    TRADE_DEADLINE_SECONDS: Number(defaults.TRADE_DEADLINE_SECONDS ?? 120),
    MIN_WALLET_RESERVE_MON: String(defaults.MIN_WALLET_RESERVE_MON ?? "1"),
    MONAD_CHAIN_ID: Number(defaults.MONAD_CHAIN_ID ?? 143),
    MONAD_RPC_URL: typeof defaults.MONAD_RPC_URL === "string" ? defaults.MONAD_RPC_URL : undefined,
    MONAD_EXPLORER_TX_URL:
      typeof defaults.MONAD_EXPLORER_TX_URL === "string"
        ? defaults.MONAD_EXPLORER_TX_URL
        : undefined,
    X_BOT_USERNAME:
      typeof defaults.X_BOT_USERNAME === "string" ? defaults.X_BOT_USERNAME : "monexmonad",
    AUTHORIZED_X_USER_ID:
      typeof defaults.AUTHORIZED_X_USER_ID === "string" ? defaults.AUTHORIZED_X_USER_ID : undefined,
    NADFUN_LENS_ADDRESS:
      typeof defaults.NADFUN_LENS_ADDRESS === "string"
        ? (defaults.NADFUN_LENS_ADDRESS as `0x${string}`)
        : NADFUN_MAINNET.LENS,
    NADFUN_ALLOWED_ROUTER_ADDRESSES: routers,
    TRADE_WALLET_PRIVATE_KEY:
      typeof defaults.TRADE_WALLET_PRIVATE_KEY === "string"
        ? defaults.TRADE_WALLET_PRIVATE_KEY
        : undefined,
    CUSTODIAL_MASTER_SEED:
      typeof defaults.CUSTODIAL_MASTER_SEED === "string"
        ? defaults.CUSTODIAL_MASTER_SEED
        : undefined,
    SITE_API_SECRET:
      typeof defaults.SITE_API_SECRET === "string" ? defaults.SITE_API_SECRET : undefined,
    USE_MOCK_BLOCKCHAIN: asBoolean(defaults.USE_MOCK_BLOCKCHAIN, false),
    USE_MOCK_X: asBoolean(defaults.USE_MOCK_X, false),
    TRADE_COORDINATOR: defaults.TRADE_COORDINATOR as DurableObjectNamespace | undefined,
    USER_REGISTRY: defaults.USER_REGISTRY as DurableObjectNamespace | undefined,
  };
}
