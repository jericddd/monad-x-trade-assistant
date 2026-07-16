export const bondingCurveRouterAbi = [
  {
    type: "function",
    name: "buy",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IBondingCurveRouter.BuyParams",
        components: [
          { name: "amountOutMin", type: "uint256", internalType: "uint256" },
          { name: "token", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "deadline", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;
