import { parseEther } from "viem";
import type { AppEnv } from "../../env.js";
import { NADFUN_MAINNET, DEFAULT_ALLOWED_ROUTERS } from "./config.js";
import {
  createBlockchainClients,
  createPublicBlockchainClient,
  assertConfiguredChainId,
} from "../client.js";
import { hasContractBytecode, isTokenLocked, queryLensQuote } from "./lens.js";
import { simulateBuyTransaction } from "./simulate-buy.js";
import { simulateSellTransaction } from "./simulate-sell.js";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

export type QuoteResult = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
  isLocked: boolean;
  hasBytecode: boolean;
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
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  simulateSell?(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
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

  async getBuyQuote(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
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

    const lensAddress = this.env.NADFUN_LENS_ADDRESS ?? NADFUN_MAINNET.LENS;
    const quote = await queryLensQuote({
      publicClient: this.publicClient,
      lensAddress,
      tokenAddress: input.tokenAddress,
      amountInWei: input.amountInWei,
    });

    const locked = await isTokenLocked({
      publicClient: this.publicClient,
      lensAddress,
      tokenAddress: input.tokenAddress,
    });

    return {
      routerAddress: quote.routerAddress,
      expectedAmountOut: quote.expectedAmountOut,
      isLocked: locked,
      hasBytecode: true,
    };
  }

  async getSellQuote(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
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

    const lensAddress = this.env.NADFUN_LENS_ADDRESS ?? NADFUN_MAINNET.LENS;
    const quote = await queryLensQuote({
      publicClient: this.publicClient,
      lensAddress,
      tokenAddress: input.tokenAddress,
      amountInWei: input.amountInWei,
      isBuy: false,
    });

    const locked = await isTokenLocked({
      publicClient: this.publicClient,
      lensAddress,
      tokenAddress: input.tokenAddress,
    });

    return {
      routerAddress: quote.routerAddress,
      expectedAmountOut: quote.expectedAmountOut,
      isLocked: locked,
      hasBytecode: true,
    };
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
    });
  }

  async simulateSell(input: {
    tokenAddress: `0x${string}`;
    amountInWei: bigint;
    amountOutMin: bigint;
    routerAddress: `0x${string}`;
    recipient: `0x${string}`;
    deadline: bigint;
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
