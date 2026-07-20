import { parseEther } from "viem";
import type { AppEnv } from "../../env.js";
import { NADFUN_MAINNET, DEFAULT_ALLOWED_ROUTERS } from "./config.js";
import {
  createBlockchainClients,
  createPublicBlockchainClient,
  assertConfiguredChainId,
} from "../client.js";
import { hasContractBytecode, isTokenUntradeable, queryLensQuote } from "./lens.js";
import { simulateBuyTransaction } from "./simulate-buy.js";
import { simulateSellTransaction } from "./simulate-sell.js";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

export type TradeVenue = "nadfun" | "flap" | "uniswap-v2" | "uniswap-v3";

export type QuoteResult = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
  isLocked: boolean;
  hasBytecode: boolean;
  /** Which venue produced this quote (for calldata / UX). */
  venue?: TradeVenue;
  /** Uniswap V3 fee tier when venue is uniswap-v3. */
  fee?: number;
};

export interface QuoteProvider {
  getBuyQuote(input: { tokenAddress: `0x${string}`; amountInWei: bigint }): Promise<QuoteResult>;
  getSellQuote?(input: { tokenAddress: `0x${string}`; amountInWei: bigint }): Promise<QuoteResult>;
}

export interface SimulationProvider {
  simulateBuy(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
    fee?: number;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  simulateSell?(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
    fee?: number;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
}

export class MockQuoteProvider implements QuoteProvider {
  private readonly scenarios: Record<
    string,
    Omit<QuoteResult, "hasBytecode"> & { hasBytecode?: boolean }
  > = {
    "0x978ae7298d48cf0f8d1fdb26abc12bfacfcc0000": {
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
      expectedAmountOut: 0n,
      isLocked: false,
    },
    "0x978ae7298d48cf0f8d1fdb26abc12bfacfccdead": {
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
      expectedAmountOut: 1n,
      isLocked: true,
    },
    "0x978ae7298d48cf0f8d1fdb26abc12bfacfccbad1": {
      routerAddress: "0x1111111111111111111111111111111111111111",
      expectedAmountOut: 1n,
      isLocked: false,
    },
    "0x978ae7298d48cf0f8d1fdb26abc12bfacfcc0eee": {
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
      expectedAmountOut: 1n,
      isLocked: false,
      hasBytecode: false,
    },
  };

  async getBuyQuote(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
  }): Promise<QuoteResult> {
    const key = input.tokenAddress.toLowerCase();
    const scenario = this.scenarios[key];

    if (scenario) {
      return {
        routerAddress: scenario.routerAddress,
        expectedAmountOut:
          scenario.expectedAmountOut === 0n ? 0n : scenario.expectedAmountOut * input.amountInWei,
        isLocked: scenario.isLocked,
        hasBytecode: scenario.hasBytecode ?? true,
      };
    }

    return {
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
      expectedAmountOut: input.amountInWei * 1_284_392n,
      isLocked: false,
      hasBytecode: true,
    };
  }

  async getSellQuote(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
  }): Promise<QuoteResult> {
    const buy = await this.getBuyQuote(input);
    // Mock sells return a small fraction of token amount as MON.
    return {
      ...buy,
      expectedAmountOut: input.amountInWei / 1_284_392n || 1n,
    };
  }
}

export class MockSimulationProvider implements SimulationProvider {
  constructor(private readonly shouldFail = false) {}

  async simulateBuy(_input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (this.shouldFail) {
      return { ok: false, reason: "transaction simulation failed" };
    }

    return { ok: true };
  }

  async simulateSell(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this.simulateBuy(input);
  }
}

export class RealQuoteProvider implements QuoteProvider {
  constructor(
    private readonly env: Partial<AppEnv>,
    private readonly publicClient = createPublicBlockchainClient(env),
  ) {}

  private async quoteAcrossVenues(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    isBuy: boolean;
  }): Promise<QuoteResult> {
    await assertConfiguredChainId(this.publicClient, this.env.MONAD_CHAIN_ID ?? 143);

    const hasBytecode = await hasContractBytecode({
      publicClient: this.publicClient,
      tokenAddress: input.tokenAddress,
    });

    if (!hasBytecode) {
      return {
        routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
        expectedAmountOut: 0n,
        isLocked: false,
        hasBytecode: false,
      };
    }

    // 1) Nad.fun (V1 Lens → V2 router)
    try {
      const lensAddress = this.env.NADFUN_LENS_ADDRESS ?? NADFUN_MAINNET.LENS;
      const quote = await queryLensQuote({
        publicClient: this.publicClient,
        lensAddress,
        tokenAddress: input.tokenAddress,
        amountInWei: input.amountInWei,
        isBuy: input.isBuy,
      });
      const untradeable = await isTokenUntradeable({
        publicClient: this.publicClient,
        lensAddress,
        tokenAddress: input.tokenAddress,
      });
      if (quote.expectedAmountOut > 0n && !untradeable) {
        return {
          routerAddress: quote.routerAddress,
          expectedAmountOut: quote.expectedAmountOut,
          isLocked: false,
          hasBytecode: true,
          venue: "nadfun",
        };
      }
      if (untradeable) {
        return {
          routerAddress: quote.routerAddress,
          expectedAmountOut: quote.expectedAmountOut,
          isLocked: true,
          hasBytecode: true,
          venue: "nadfun",
        };
      }
    } catch {
      // try Flap / Uniswap
    }

    // 2) Flap.sh Portal (bonding curve) or graduated → Uniswap
    try {
      const { tryFlapQuote } = await import("../flap/quote.js");
      const flap = await tryFlapQuote({
        publicClient: this.publicClient,
        tokenAddress: input.tokenAddress,
        amountInWei: input.amountInWei,
        isBuy: input.isBuy,
      });
      if (flap && flap.expectedAmountOut > 0n) {
        return {
          routerAddress: flap.routerAddress,
          expectedAmountOut: flap.expectedAmountOut,
          isLocked: flap.isLocked,
          hasBytecode: true,
          venue: flap.venue,
          fee: flap.fee,
        };
      }
    } catch {
      // try Uniswap
    }

    // 3) Uniswap V2 / V3 (any WMON pool)
    try {
      const { tryUniswapQuote } = await import("../uniswap/quote.js");
      const uni = await tryUniswapQuote({
        publicClient: this.publicClient,
        tokenAddress: input.tokenAddress,
        amountInWei: input.amountInWei,
        isBuy: input.isBuy,
      });
      if (uni && uni.expectedAmountOut > 0n) {
        return {
          routerAddress: uni.routerAddress,
          expectedAmountOut: uni.expectedAmountOut,
          isLocked: false,
          hasBytecode: true,
          venue: uni.venue,
          fee: uni.fee,
        };
      }
    } catch {
      // fall through
    }

    return {
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
      expectedAmountOut: 0n,
      isLocked: false,
      hasBytecode: true,
    };
  }

  async getBuyQuote(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
  }): Promise<QuoteResult> {
    return this.quoteAcrossVenues({ ...input, isBuy: true });
  }

  async getSellQuote(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
  }): Promise<QuoteResult> {
    return this.quoteAcrossVenues({ ...input, isBuy: false });
  }
}

export class RealSimulationProvider implements SimulationProvider {
  constructor(
    private readonly env: Partial<AppEnv>,
    private readonly publicClient = createPublicBlockchainClient(env),
  ) {}

  async simulateBuy(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
    fee?: number;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    return simulateBuyTransaction({
      publicClient: this.publicClient,
      account: input.recipient,
      routerAddress: input.routerAddress,
      tokenAddress: input.tokenAddress,
      amountInWei: input.amountInWei,
      amountOutMin: input.amountOutMin,
      recipient: input.recipient,
      deadline: input.deadline,
      fee: input.fee,
    });
  }

  async simulateSell(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
    fee?: number;
  }): Promise<{ ok: true } | { ok: false; reason: string }> {
    return simulateSellTransaction({
      publicClient: this.publicClient,
      account: input.recipient,
      routerAddress: input.routerAddress,
      tokenAddress: input.tokenAddress,
      amountIn: input.amountInWei,
      amountOutMin: input.amountOutMin,
      recipient: input.recipient,
      deadline: input.deadline,
      fee: input.fee,
    });
  }
}

export function createMockWalletAddress(): `0x${string}` {
  return "0x0000000000000000000000000000000000000001";
}

export function resolveWalletAddress(env: Partial<AppEnv>): `0x${string}` {
  if (env.TRADE_WALLET_PRIVATE_KEY) {
    return privateKeyToAccount(env.TRADE_WALLET_PRIVATE_KEY as Hex).address;
  }
  return createMockWalletAddress();
}

export function shouldUseMockBlockchain(env: Partial<AppEnv>): boolean {
  if (env.USE_MOCK_BLOCKCHAIN === true) {
    return true;
  }
  if (!env.MONAD_RPC_URL || !env.NADFUN_LENS_ADDRESS) {
    return true;
  }
  return false;
}

export type TradeProviders = {
  quoteProvider: QuoteProvider;
  simulationProvider: SimulationProvider;
  walletAddress: `0x${string}`;
  mode: "mock" | "real";
};

export function createProviders(env: Partial<AppEnv>): TradeProviders {
  if (shouldUseMockBlockchain(env)) {
    return {
      quoteProvider: new MockQuoteProvider(),
      simulationProvider: new MockSimulationProvider(),
      walletAddress: resolveWalletAddress(env),
      mode: "mock",
    };
  }

  return {
    quoteProvider: new RealQuoteProvider(env),
    simulationProvider: new RealSimulationProvider(env),
    walletAddress: resolveWalletAddress(env),
    mode: "real",
  };
}

export async function createLiveExecutionContext(env: Partial<AppEnv>, signerPrivateKey?: string) {
  const clients = await createBlockchainClients(env, signerPrivateKey);
  const allowedRouters = (
    env.NADFUN_ALLOWED_ROUTER_ADDRESSES?.length
      ? env.NADFUN_ALLOWED_ROUTER_ADDRESSES
      : [...DEFAULT_ALLOWED_ROUTERS]
  ) as `0x${string}`[];

  return {
    ...clients,
    allowedRouters,
    minReserveWei: parseEther(env.MIN_WALLET_RESERVE_MON ?? "1"),
  };
}

export { createBlockchainClients };
