import type { AppEnv } from "../../env.js";
import { NADFUN_MAINNET } from "./config.js";

export type QuoteResult = {
  routerAddress: `0x${string}`;
  expectedAmountOut: bigint;
  isLocked: boolean;
  hasBytecode: boolean;
};

export interface QuoteProvider {
  getBuyQuote(input: { tokenAddress: `0x${string}`; amountInWei: bigint }): Promise<QuoteResult>;
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
}

export function createMockWalletAddress(): `0x${string}` {
  return "0x0000000000000000000000000000000000000001";
}

export function createProviders(_env: Partial<AppEnv>): {
  quoteProvider: QuoteProvider;
  simulationProvider: SimulationProvider;
  walletAddress: `0x${string}`;
} {
  return {
    quoteProvider: new MockQuoteProvider(),
    simulationProvider: new MockSimulationProvider(),
    walletAddress: createMockWalletAddress(),
  };
}
