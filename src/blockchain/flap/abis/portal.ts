/** Minimal Flap Portal ABI for Monad (getTokenV7 + quote/swap). */
export const flapPortalAbi = [
  {
    type: "function",
    name: "getTokenV7",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        name: "state",
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "reserve", type: "uint256" },
          { name: "circulatingSupply", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "tokenVersion", type: "uint8" },
          { name: "r", type: "uint256" },
          { name: "h", type: "uint256" },
          { name: "k", type: "uint256" },
          { name: "dexSupplyThresh", type: "uint256" },
          { name: "quoteTokenAddress", type: "address" },
          { name: "nativeToQuoteSwapEnabled", type: "bool" },
          { name: "extensionID", type: "bytes32" },
          { name: "taxRate", type: "uint256" },
          { name: "pool", type: "address" },
          { name: "progress", type: "uint256" },
          { name: "lpFeeProfile", type: "uint8" },
          { name: "dexId", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "inputToken", type: "address" },
          { name: "outputToken", type: "address" },
          { name: "inputAmount", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "outputAmount", type: "uint256" }],
  },
  {
    type: "function",
    name: "swapExactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "inputToken", type: "address" },
          { name: "outputToken", type: "address" },
          { name: "inputAmount", type: "uint256" },
          { name: "minOutputAmount", type: "uint256" },
          { name: "permitData", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "outputAmount", type: "uint256" }],
  },
] as const;
