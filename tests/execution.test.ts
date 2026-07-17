import { describe, expect, it, vi } from "vitest";
import { keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { executeNadfunBuy } from "../src/blockchain/wallet.js";
import { NADFUN_MAINNET } from "../src/blockchain/nadfun/config.js";

const ROUTER = NADFUN_MAINNET.BONDING_CURVE_ROUTER;
const TOKEN = "0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777";
// Deterministic anvil-style key → known address for assertions.
const ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const WALLET = ACCOUNT.address;

function mockWalletClient(overrides: {
  prepareTransactionRequest?: ReturnType<typeof vi.fn>;
  signTransaction?: ReturnType<typeof vi.fn>;
}) {
  const signTransaction =
    overrides.signTransaction ?? vi.fn().mockResolvedValue("0x02f8660101010101010101");
  return {
    account: {
      ...ACCOUNT,
      signTransaction,
    },
    prepareTransactionRequest:
      overrides.prepareTransactionRequest ??
      vi.fn().mockResolvedValue({ to: ROUTER, value: 1n, nonce: 7 }),
    signTransaction,
    chain: { id: 143 },
  };
}

describe("restricted execution", () => {
  it("rejects non-allowlisted routers", async () => {
    await expect(
      executeNadfunBuy({
        publicClient: {} as never,
        walletClient: mockWalletClient({}) as never,
        walletAddress: WALLET,
        tokenAddress: TOKEN,
        amountInWei: 1n,
        amountOutMin: 1n,
        routerAddress: "0x1111111111111111111111111111111111111111",
        deadline: 1n,
        allowedRouters: [ROUTER],
      }),
    ).rejects.toMatchObject({ code: "ROUTER_NOT_ALLOWED" });
  });

  it("signs locally then broadcasts raw tx to allowlisted routers", async () => {
    const signed = "0x02f8660101010101010101" as const;
    const expectedHash = keccak256(signed);
    const prepareTransactionRequest = vi.fn().mockResolvedValue({
      to: ROUTER,
      value: 1n,
      nonce: 7,
    });
    const signTransaction = vi.fn().mockResolvedValue(signed);
    const sendRawTransaction = vi.fn().mockResolvedValue(expectedHash);
    const walletClient = mockWalletClient({
      prepareTransactionRequest,
      signTransaction,
    });

    const hash = await executeNadfunBuy({
      publicClient: {
        sendRawTransaction,
        getTransaction: vi.fn(),
        getTransactionCount: vi.fn(),
      } as never,
      walletClient: walletClient as never,
      walletAddress: WALLET,
      tokenAddress: TOKEN,
      amountInWei: 1n,
      amountOutMin: 1n,
      routerAddress: ROUTER,
      deadline: 1n,
      allowedRouters: [ROUTER, NADFUN_MAINNET.DEX_ROUTER],
      gas: 21000n,
      gasPrice: 1n,
    });

    expect(hash).toBe(expectedHash);
    expect(prepareTransactionRequest).toHaveBeenCalledOnce();
    expect(signTransaction).toHaveBeenCalledOnce();
    expect(sendRawTransaction).toHaveBeenCalledOnce();
    const call = prepareTransactionRequest.mock.calls[0]?.[0] as {
      account: { type: string; address: string };
      to: string;
      value: bigint;
    };
    expect(call.to).toBe(ROUTER);
    expect(call.value).toBe(1n);
    expect(call.account.type).toBe("local");
    expect(call.account.address).toBe(WALLET);
  });

  it("rejects address-only (RPC) signers", async () => {
    await expect(
      executeNadfunBuy({
        publicClient: {} as never,
        walletClient: {
          account: WALLET,
          prepareTransactionRequest: vi.fn(),
          signTransaction: vi.fn(),
          chain: { id: 143 },
        } as never,
        walletAddress: WALLET,
        tokenAddress: TOKEN,
        amountInWei: 1n,
        amountOutMin: 1n,
        routerAddress: ROUTER,
        deadline: 1n,
        allowedRouters: [ROUTER],
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });

  it("retries transient broadcast failures and succeeds when tx becomes visible", async () => {
    const signed = "0x02f866aaaaaaaaaaaaaaaa" as const;
    const expectedHash = keccak256(signed);
    const sendRawTransaction = vi
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce(expectedHash);

    const hash = await executeNadfunBuy({
      publicClient: {
        sendRawTransaction,
        getTransaction: vi.fn().mockRejectedValue(new Error("not found")),
        getTransactionCount: vi.fn().mockResolvedValue(7),
      } as never,
      walletClient: mockWalletClient({
        prepareTransactionRequest: vi.fn().mockResolvedValue({ nonce: 7 }),
        signTransaction: vi.fn().mockResolvedValue(signed),
      }) as never,
      walletAddress: WALLET,
      tokenAddress: TOKEN,
      amountInWei: 1n,
      amountOutMin: 1n,
      routerAddress: ROUTER,
      deadline: 1n,
      allowedRouters: [ROUTER],
      gas: 21000n,
      gasPrice: 1n,
    });

    expect(hash).toBe(expectedHash);
    expect(sendRawTransaction.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("maps exhausted broadcast failure to SUBMISSION_FAILED when nonce is unused", async () => {
    const signed = "0x02f866bbbbbbbbbbbbbbbb" as const;
    await expect(
      executeNadfunBuy({
        publicClient: {
          sendRawTransaction: vi.fn().mockRejectedValue(new Error("network timeout")),
          getTransaction: vi.fn().mockRejectedValue(new Error("not found")),
          getTransactionCount: vi.fn().mockResolvedValue(3),
        } as never,
        walletClient: mockWalletClient({
          prepareTransactionRequest: vi.fn().mockResolvedValue({ nonce: 3 }),
          signTransaction: vi.fn().mockResolvedValue(signed),
        }) as never,
        walletAddress: WALLET,
        tokenAddress: TOKEN,
        amountInWei: 1n,
        amountOutMin: 1n,
        routerAddress: ROUTER,
        deadline: 1n,
        allowedRouters: [ROUTER],
        gas: 21000n,
        gasPrice: 1n,
      }),
    ).rejects.toMatchObject({ code: "SUBMISSION_FAILED" });
  }, 20_000);
});
