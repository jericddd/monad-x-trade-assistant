import { encodeFunctionData } from "viem";
import { bondingCurveRouterAbi } from "./abis/bonding-curve-router.js";

export type BuyCalldataInput = {
  tokenAddress: `0x${string}`;
  amountOutMin: bigint;
  recipient: `0x${string}`;
  deadline: bigint;
};

export function buildBuyTransaction(input: BuyCalldataInput): `0x${string}` {
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
