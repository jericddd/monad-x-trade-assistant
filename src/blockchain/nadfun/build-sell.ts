import { encodeFunctionData } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isV2Router } from "./config.js";

export type SellCalldataInput = {
  tokenAddress: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
  routerAddress?: `0x${string}`;
};

export function buildSellTransaction(input: SellCalldataInput): `0x${string}` {
  const params = {
    amountIn: input.amountIn,
    amountOutMin: input.amountOutMin,
    token: input.tokenAddress,
    to: input.recipient,
    deadline: input.deadline,
  };

  if (input.routerAddress && isV2Router(input.routerAddress)) {
    return encodeFunctionData({
      abi: nadfunRouterV2Abi,
      functionName: "sellToNative",
      args: [params],
    });
  }

  return encodeFunctionData({
    abi: bondingCurveRouterAbi,
    functionName: "sell",
    args: [params],
  });
}
