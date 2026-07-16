export const dexRouterAbi = [
  {
    type: "function",
    name: "buy",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct IDexRouter.BuyParams",
        components: [
          { name: "amountOutMin", type: "uint256", internalType: "uint256" },
          { name: "token", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "deadline", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable",
  },
] as const;
