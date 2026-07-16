export const lensAbi = [
  {
    type: "function",
    name: "getAmountOut",
    inputs: [
      { name: "_token", type: "address", internalType: "address" },
      { name: "_amountIn", type: "uint256", internalType: "uint256" },
      { name: "_isBuy", type: "bool", internalType: "bool" },
    ],
    outputs: [
      { name: "router", type: "address", internalType: "address" },
      { name: "amountOut", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAmountIn",
    inputs: [
      { name: "_token", type: "address", internalType: "address" },
      { name: "_amountOut", type: "uint256", internalType: "uint256" },
      { name: "_isBuy", type: "bool", internalType: "bool" },
    ],
    outputs: [
      { name: "router", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProgress",
    inputs: [{ name: "_token", type: "address", internalType: "address" }],
    outputs: [{ name: "progress", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getInitialBuyAmountOut",
    inputs: [{ name: "amountIn", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isGraduated",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isLocked",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "availableBuyTokens",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
    outputs: [
      { name: "availableBuyToken", type: "uint256", internalType: "uint256" },
      { name: "requiredMonAmount", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;
