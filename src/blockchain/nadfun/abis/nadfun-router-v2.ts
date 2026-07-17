/** Minimal NadFun V2 router ABI for native MON buys and quotes. */
export const nadfunRouterV2Abi = [
  {
    type: "function",
    name: "getAmountOut",
    inputs: [
      { name: "token", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
      { name: "isBuy", type: "bool", internalType: "bool" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
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
    name: "buyWithNative",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct INadFunRouter.BuyWithNativeParams",
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
  {
    type: "function",
    name: "sellToNative",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct INadFunRouter.SellToNativeParams",
        components: [
          { name: "amountIn", type: "uint256", internalType: "uint256" },
          { name: "amountOutMin", type: "uint256", internalType: "uint256" },
          { name: "token", type: "address", internalType: "address" },
          { name: "to", type: "address", internalType: "address" },
          { name: "deadline", type: "uint256", internalType: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;
