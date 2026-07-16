import type { PublicClient, TransactionReceipt } from "viem";

export async function getTransactionReceipt(
  publicClient: PublicClient,
  txHash: `0x${string}`,
): Promise<TransactionReceipt | null> {
  try {
    return await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return null;
  }
}

export async function waitForReceipt(
  publicClient: PublicClient,
  txHash: `0x${string}`,
  timeoutMs = 15_000,
): Promise<TransactionReceipt | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const receipt = await getTransactionReceipt(publicClient, txHash);
    if (receipt) {
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return null;
}
