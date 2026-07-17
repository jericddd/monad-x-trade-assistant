import { describe, expect, it, vi } from "vitest";
import { isTokenUntradeable } from "../src/blockchain/nadfun/lens.js";

describe("isTokenUntradeable", () => {
  it("allows graduated DEX tokens even when Lens reports isLocked", async () => {
    const publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "isLocked") return true;
        if (functionName === "isGraduated") return true;
        throw new Error(`unexpected ${functionName}`);
      }),
    };

    await expect(
      isTokenUntradeable({
        publicClient: publicClient as never,
        lensAddress: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea",
        tokenAddress: "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777",
      }),
    ).resolves.toBe(false);
  });

  it("blocks mid-graduation when locked and not yet graduated", async () => {
    const publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "isLocked") return true;
        if (functionName === "isGraduated") return false;
        throw new Error(`unexpected ${functionName}`);
      }),
    };

    await expect(
      isTokenUntradeable({
        publicClient: publicClient as never,
        lensAddress: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea",
        tokenAddress: "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777",
      }),
    ).resolves.toBe(true);
  });

  it("allows active bonding-curve tokens", async () => {
    const publicClient = {
      readContract: vi.fn(async () => false),
    };

    await expect(
      isTokenUntradeable({
        publicClient: publicClient as never,
        lensAddress: "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea",
        tokenAddress: "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777",
      }),
    ).resolves.toBe(false);
  });
});
