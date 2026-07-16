import { describe, expect, it, vi } from "vitest";
import { executeNadfunBuy } from "../src/blockchain/wallet.js";
import { NADFUN_MAINNET } from "../src/blockchain/nadfun/config.js";
describe("restricted execution", () => {
  it("rejects non-allowlisted routers", async () => {
    await expect(
      executeNadfunBuy({
        publicClient: {} as never,
        walletClient: {
          sendTransaction: vi.fn(),
          chain: { id: 143 },
        } as never,
        walletAddress: "0x0000000000000000000000000000000000000001",
        tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
        amountInWei: 1n,
        amountOutMin: 1n,
        routerAddress: "0x1111111111111111111111111111111111111111",
        deadline: 1n,
        allowedRouters: [NADFUN_MAINNET.BONDING_CURVE_ROUTER],
      }),
    ).rejects.toMatchObject({ code: "ROUTER_NOT_ALLOWED" });
  });

  it("submits only to allowlisted routers", async () => {
    const sendTransaction = vi.fn().mockResolvedValue("0xabc123");
    const hash = await executeNadfunBuy({
      publicClient: {} as never,
      walletClient: {
        sendTransaction,
        chain: { id: 143 },
      } as never,
      walletAddress: "0x0000000000000000000000000000000000000001",
      tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
      amountInWei: 1n,
      amountOutMin: 1n,
      routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
      deadline: 1n,
      allowedRouters: [NADFUN_MAINNET.BONDING_CURVE_ROUTER, NADFUN_MAINNET.DEX_ROUTER],
    });

    expect(hash).toBe("0xabc123");
    expect(sendTransaction).toHaveBeenCalledOnce();
    const call = sendTransaction.mock.calls[0]?.[0] as { to: string; value: bigint };
    expect(call.to).toBe(NADFUN_MAINNET.BONDING_CURVE_ROUTER);
    expect(call.value).toBe(1n);
  });

  it("maps network failures to SUBMISSION_UNKNOWN", async () => {
    await expect(
      executeNadfunBuy({
        publicClient: {} as never,
        walletClient: {
          sendTransaction: vi.fn().mockRejectedValue(new Error("network timeout")),
          chain: { id: 143 },
        } as never,
        walletAddress: "0x0000000000000000000000000000000000000001",
        tokenAddress: "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777",
        amountInWei: 1n,
        amountOutMin: 1n,
        routerAddress: NADFUN_MAINNET.BONDING_CURVE_ROUTER,
        deadline: 1n,
        allowedRouters: [NADFUN_MAINNET.BONDING_CURVE_ROUTER],
      }),
    ).rejects.toMatchObject({ code: "SUBMISSION_UNKNOWN" });
  });
});
