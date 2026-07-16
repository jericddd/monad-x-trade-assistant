import { describe, expect, it } from "vitest";
import { calculateMinimumAmountOut } from "../src/utils/bigint.js";
import { assertChainId } from "../src/blockchain/chain.js";

describe("concurrency helpers", () => {
  it("calculates slippage with bigint math", () => {
    const minimum = calculateMinimumAmountOut(1_000_000n, 300);
    expect(minimum).toBe(970_000n);
  });

  it("detects chain id mismatch", () => {
    expect(() => assertChainId(1, 143)).toThrow("CHAIN_ID_MISMATCH");
  });
});
