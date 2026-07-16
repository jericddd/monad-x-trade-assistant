import { describe, expect, it } from "vitest";
import { MockSimulationProvider } from "../src/blockchain/nadfun/quote.js";
import { parseEther } from "viem";

describe("simulation", () => {
  it("succeeds by default", async () => {
    const provider = new MockSimulationProvider(false);
    const result = await provider.simulateBuy({
      tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
      amountInWei: parseEther("1"),
      amountOutMin: 1n,
      routerAddress: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22",
      recipient: "0x0000000000000000000000000000000000000001",
      deadline: 999n,
    });

    expect(result.ok).toBe(true);
  });

  it("fails when configured to fail", async () => {
    const provider = new MockSimulationProvider(true);
    const result = await provider.simulateBuy({
      tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
      amountInWei: parseEther("1"),
      amountOutMin: 1n,
      routerAddress: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22",
      recipient: "0x0000000000000000000000000000000000000001",
      deadline: 999n,
    });

    expect(result.ok).toBe(false);
  });
});
