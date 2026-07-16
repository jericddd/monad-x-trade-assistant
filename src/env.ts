import { z } from "zod";
import { isAddress, isHex } from "viem";

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
    X_BEARER_TOKEN: z.string().min(1),
    X_API_KEY: z.string().min(1),
    X_API_SECRET: z.string().min(1),
    X_ACCESS_TOKEN: z.string().min(1),
    X_ACCESS_TOKEN_SECRET: z.string().min(1),
    X_BOT_USER_ID: userIdSchema,
    X_BOT_USERNAME: z.string().min(1),
    AUTHORIZED_X_USER_ID: userIdSchema,
    MONAD_RPC_URL: z.string().url(),
    MONAD_CHAIN_ID: z.coerce.number().int().positive(),
    MONAD_EXPLORER_TX_URL: z.string().url(),
    TRADE_WALLET_PRIVATE_KEY: privateKeySchema,
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
    TRADE_COORDINATOR: z.custom<DurableObjectNamespace>().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.TRADING_ENABLED && !env.TRADE_DRY_RUN) {
      if (!env.TRADE_WALLET_PRIVATE_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TRADE_WALLET_PRIVATE_KEY is required when live trading is enabled",
          path: ["TRADE_WALLET_PRIVATE_KEY"],
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration: ${issues.join("; ")}`);
  }

  return result.data;
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
    ...raw,
  };

  return {
    TRADING_ENABLED: defaults.TRADING_ENABLED === true || defaults.TRADING_ENABLED === "true",
    TRADE_DRY_RUN: defaults.TRADE_DRY_RUN !== false && defaults.TRADE_DRY_RUN !== "false",
    MAX_MON_PER_TRADE: String(defaults.MAX_MON_PER_TRADE ?? "10"),
    MAX_MON_PER_DAY: String(defaults.MAX_MON_PER_DAY ?? "30"),
    MAX_TRADES_PER_HOUR: Number(defaults.MAX_TRADES_PER_HOUR ?? 3),
    DEFAULT_SLIPPAGE_BPS: Number(defaults.DEFAULT_SLIPPAGE_BPS ?? 300),
    MAX_PRICE_IMPACT_BPS: Number(defaults.MAX_PRICE_IMPACT_BPS ?? 1000),
    TRADE_DEADLINE_SECONDS: Number(defaults.TRADE_DEADLINE_SECONDS ?? 120),
    MIN_WALLET_RESERVE_MON: String(defaults.MIN_WALLET_RESERVE_MON ?? "1"),
    X_BOT_USERNAME:
      typeof defaults.X_BOT_USERNAME === "string" ? defaults.X_BOT_USERNAME : "monexmonad",
    AUTHORIZED_X_USER_ID:
      typeof defaults.AUTHORIZED_X_USER_ID === "string" ? defaults.AUTHORIZED_X_USER_ID : undefined,
    X_BOT_USER_ID: typeof defaults.X_BOT_USER_ID === "string" ? defaults.X_BOT_USER_ID : undefined,
    NADFUN_ALLOWED_ROUTER_ADDRESSES: Array.isArray(defaults.NADFUN_ALLOWED_ROUTER_ADDRESSES)
      ? (defaults.NADFUN_ALLOWED_ROUTER_ADDRESSES as string[])
      : typeof defaults.NADFUN_ALLOWED_ROUTER_ADDRESSES === "string"
        ? defaults.NADFUN_ALLOWED_ROUTER_ADDRESSES.split(",").map((entry) => entry.trim())
        : [],
    TRADE_COORDINATOR: defaults.TRADE_COORDINATOR as DurableObjectNamespace | undefined,
  };
}
