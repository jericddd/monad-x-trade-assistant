import { describe, expect, it } from "vitest";
import { executeNadfunBuy } from "../src/blockchain/wallet.js";

describe("execution", () => {
  it("rejects live execution in phase 1", async () => {
    await expect(
      executeNadfunBuy({
        tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
        amountInWei: 1n,
        amountOutMin: 1n,
        routerAddress: "0x6F6B8F1a20703309951a5127c45B49b1CD981A22",
        deadline: 1n,
      }),
    ).rejects.toThrow("Live execution is disabled in Phase 1");
  });
});
