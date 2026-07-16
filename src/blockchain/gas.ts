import type { PublicClient } from "viem";

export async function estimateBuyGas(input: {
  publicClient: PublicClient;
  account: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}): Promise<{ gas: bigint; gasPrice: bigint; estimatedCost: bigint }> {
  const gas = await input.publicClient.estimateGas({
    account: input.account,
    to: input.to,
    data: input.data,
    value: input.value,
  });

  const gasPrice = await input.publicClient.getGasPrice();
  const paddedGas = (gas * 120n) / 100n;

  return {
    gas: paddedGas,
    gasPrice,
    estimatedCost: paddedGas * gasPrice,
  };
}
