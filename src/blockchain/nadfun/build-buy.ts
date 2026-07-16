import { encodeFunctionData } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";
import { nadfunRouterV2Abi } from "./abis/nadfun-router-v2.js";
import { isV2Router } from "./config.js";

export type BuyCalldataInput = {
  tokenAddress: `0x${string}`;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
  routerAddress?: `0x${string}`;
};

export function buildBuyTransaction(input: BuyCalldataInput): `0x${string}` {
  if (input.routerAddress && isV2Router(input.routerAddress)) {
    return encodeFunctionData({
      abi: nadfunRouterV2Abi,
      functionName: "buyWithNative",
      args: [
        {
          amountOutMin: input.amountOutMin,
          token: input.tokenAddress,
          to: input.recipient,
          deadline: input.deadline,
        },
      ],
    });
  }

  return encodeFunctionData({
    abi: bondingCurveRouterAbi,
    functionName: "buy",
    args: [
      {
        amountOutMin: input.amountOutMin,
        token: input.tokenAddress,
        to: input.recipient,
        deadline: input.deadline,
      },
    ],
  });
}
