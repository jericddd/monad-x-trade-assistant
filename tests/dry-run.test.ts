import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { TradeService } from "../src/trading/trade-service.js";
import { MockQuoteProvider, MockSimulationProvider } from "../src/blockchain/nadfun/quote.js";
import { DEFAULT_ALLOWED_ROUTERS, NADFUN_MAINNET } from "../src/blockchain/nadfun/config.js";

const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777" as const;

describe("dry run", () => {
  const env = {
    TRADING_ENABLED: false,
    TRADE_DRY_RUN: true,
    MAX_MON_PER_TRADE: "10",
    DEFAULT_SLIPPAGE_BPS: 300,
    TRADE_DEADLINE_SECONDS: 120,
    NADFUN_ALLOWED_ROUTER_ADDRESSES: [...DEFAULT_ALLOWED_ROUTERS],
  };

  it("returns dry run success without broadcasting", async () => {
    const service = new TradeService(
      env,
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    const result = await service.executeDryRun({
      tweetId: "100",
      authorId: "123",
      commandText: `@monexmonad buy 5 mon ${TOKEN}`,
      commandTextHash: "hash",
      command: {
        action: "buy",
        amountMon: "5",
        tokenAddress: TOKEN,
      },
    });

    expect(result.record.status).toBe("DRY_RUN_SUCCESS");
    expect(result.replyKind).toBe("dry_run");
    expect(result.replyText).toContain("no transaction was submitted");
  });

  it("rejects zero output tokens", async () => {
    const service = new TradeService(
      env,
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    await expect(
      service.executeDryRun({
        tweetId: "101",
        authorId: "123",
        commandText: "@monexmonad buy 5 mon 0x978ae7298d48cf0f8d1fdb26abc12bfacfcc0000",
        commandTextHash: "hash",
        command: {
          action: "buy",
          amountMon: "5",
          tokenAddress: "0x978ae7298d48cf0f8d1fdb26abc12bfacfcc0000",
        },
      }),
    ).rejects.toMatchObject({ code: "ZERO_OUTPUT" });
  });

  it("rejects locked tokens", async () => {
    const service = new TradeService(
      env,
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    await expect(
      service.executeDryRun({
        tweetId: "102",
        authorId: "123",
        commandText: "@monexmonad buy 5 mon 0x978ae7298d48cf0f8d1fdb26abc12bfacfccdead",
        commandTextHash: "hash",
        command: {
          action: "buy",
          amountMon: "5",
          tokenAddress: "0x978ae7298d48cf0f8d1fdb26abc12bfacfccdead",
        },
      }),
    ).rejects.toMatchObject({ code: "TOKEN_LOCKED" });
  });

  it("rejects disallowed router", async () => {
    const service = new TradeService(
      env,
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    await expect(
      service.executeDryRun({
        tweetId: "103",
        authorId: "123",
        commandText: "@monexmonad buy 5 mon 0x978ae7298d48cf0f8d1fdb26abc12bfacfccbad1",
        commandTextHash: "hash",
        command: {
          action: "buy",
          amountMon: "5",
          tokenAddress: "0x978ae7298d48cf0f8d1fdb26abc12bfacfccbad1",
        },
      }),
    ).rejects.toMatchObject({ code: "ROUTER_NOT_ALLOWED" });
  });

  it("calculates minimum output using bigint slippage", async () => {
    const service = new TradeService(
      env,
      new MockQuoteProvider(),
      new MockSimulationProvider(),
      "0x0000000000000000000000000000000000000001",
    );

    const result = await service.executeDryRun({
      tweetId: "104",
      authorId: "123",
      commandText: `@monexmonad buy 1 mon ${TOKEN}`,
      commandTextHash: "hash",
      command: {
        action: "buy",
        amountMon: "1",
        tokenAddress: TOKEN,
      },
    });

    const expected = parseEther("1") * 1_284_392n;
    const minimum = BigInt(result.record.minimumAmountOut ?? "0");
    expect(minimum).toBe((expected * 9700n) / 10000n);
    expect(result.record.routerAddress).toBe(NADFUN_MAINNET.BONDING_CURVE_ROUTER);
  });
});
