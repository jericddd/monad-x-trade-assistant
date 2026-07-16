import { describe, expect, it } from "vitest";
import { TradeService } from "../src/trading/trade-service.js";
import { MockQuoteProvider, MockSimulationProvider } from "../src/blockchain/nadfun/quote.js";
import { DEFAULT_ALLOWED_ROUTERS } from "../src/blockchain/nadfun/config.js";

const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777" as const;

describe("live trading gates", () => {
  it("keeps dry-run when TRADE_DRY_RUN overrides TRADING_ENABLED", async () => {
    const service = new TradeService(
      {
        TRADING_ENABLED: true,
        TRADE_DRY_RUN: true,
        MAX_MON_PER_TRADE: "10",
        DEFAULT_SLIPPAGE_BPS: 300,
        TRADE_DEADLINE_SECONDS: 120,
        NADFUN_ALLOWED_ROUTER_ADDRESSES: [...DEFAULT_ALLOWED_ROUTERS],
      },
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    const result = await service.executeTrade({
      tweetId: "200",
      authorId: "123",
      commandText: `@monexmonad buy 1 mon ${TOKEN}`,
      commandTextHash: "hash",
      command: { action: "buy", amountMon: "1", tokenAddress: TOKEN },
    });

    expect(result.record.status).toBe("DRY_RUN_SUCCESS");
    expect(result.replyKind).toBe("dry_run");
  });

  it("rejects live trading when disabled", async () => {
    const service = new TradeService(
      {
        TRADING_ENABLED: false,
        TRADE_DRY_RUN: false,
        MAX_MON_PER_TRADE: "10",
        DEFAULT_SLIPPAGE_BPS: 300,
        TRADE_DEADLINE_SECONDS: 120,
        NADFUN_ALLOWED_ROUTER_ADDRESSES: [...DEFAULT_ALLOWED_ROUTERS],
      },
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    await expect(
      service.executeTrade({
        tweetId: "201",
        authorId: "123",
        commandText: `@monexmonad buy 1 mon ${TOKEN}`,
        commandTextHash: "hash",
        command: { action: "buy", amountMon: "1", tokenAddress: TOKEN },
      }),
    ).rejects.toMatchObject({ code: "TRADING_DISABLED" });
  });

  it("requires private key for live trading", async () => {
    const service = new TradeService(
      {
        TRADING_ENABLED: true,
        TRADE_DRY_RUN: false,
        MAX_MON_PER_TRADE: "10",
        DEFAULT_SLIPPAGE_BPS: 300,
        TRADE_DEADLINE_SECONDS: 120,
        MIN_WALLET_RESERVE_MON: "1",
        MONAD_RPC_URL: "https://rpc.monad.xyz",
        MONAD_CHAIN_ID: 143,
        NADFUN_LENS_ADDRESS: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea",
        NADFUN_ALLOWED_ROUTER_ADDRESSES: [...DEFAULT_ALLOWED_ROUTERS],
      },
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    // createLiveExecutionContext will be called; without private key executeLiveBuy fails closed.
    await expect(
      service.executeTrade({
        tweetId: "202",
        authorId: "123",
        commandText: `@monexmonad buy 1 mon ${TOKEN}`,
        commandTextHash: "hash",
        command: { action: "buy", amountMon: "1", tokenAddress: TOKEN },
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });
});

describe("wallet reserve helper", () => {
  it("enforces reserve math", async () => {
    const { hasSufficientReserve } = await import("../src/blockchain/balances.js");
    expect(
      hasSufficientReserve({
        walletBalance: 12n,
        tradeAmount: 10n,
        estimatedGasCost: 1n,
        minimumReserve: 1n,
      }),
    ).toBe(true);

    expect(
      hasSufficientReserve({
        walletBalance: 11n,
        tradeAmount: 10n,
        estimatedGasCost: 1n,
        minimumReserve: 1n,
      }),
    ).toBe(false);
  });
});
