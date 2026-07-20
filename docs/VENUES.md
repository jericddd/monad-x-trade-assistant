# Trade venues (Nad.fun + Flap.sh + Uniswap)

MonEx quotes and executes buys/sells across three venues on Monad mainnet. Detection is automatic from the token address — the X command and desk API stay the same:

```text
@monexmonad buy <amount> mon <tokenAddress>
```

## Quote order

1. **Nad.fun** — V1 Lens → V2 router (bonding curve, graduated DEX, V2 tokens)
2. **Flap.sh** — Portal `getTokenV7` + `quoteExactInput` (bonding curve)
3. **Uniswap** — V2 pair then V3 fee tiers (WMON pools; also used for graduated Flap)

## Nad.fun

| Role | Address |
| ---- | ------- |
| Lens (V1) | `0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea` |
| Bonding Curve Router | `0x6F6B8F1a20703309951a5127c45B49b1CD981A22` |
| DEX Router (graduated) | `0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137` |
| V2 Router | `0x8986C8fD44eb85294A725a7e61AF35E76bA26F91` |

See `docs/NADFUN_INTEGRATION.md`.

## Flap.sh (Portal v5.1.2 on Monad)

| Role | Address |
| ---- | ------- |
| Portal | `0x30e8ee7b5881bf2E158A0514f2150aabe2c68b23` |

| Token status | How we trade |
| ------------ | ------------ |
| **Tradable** (bonding curve, native MON quote) | Portal `swapExactInput` |
| **DEX** (graduated) | Portal swap does **not** support DEX yet → **Uniswap** (Flap DEX0 on Monad) |
| ERC20-quoted curves | Not supported yet |

Inspect: `getTokenV7` (V8 is BNB-only). Docs: https://docs.flap.sh/

## Uniswap (V2 + V3)

| Role | Address |
| ---- | ------- |
| WMON | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` |
| V2 Factory | `0x182a927119d56008d921126764bf884221b10f59` |
| V2 Router02 | `0x4b2ab38dbf28d31d467aa8993f6c2585981d6804` |
| V3 Factory | `0x204faca1764b154221e35c0d20abb3c525710498` |
| Quoter V2 | `0x2d01411773c8c24805306e89a41f7855c3c4fe65` |
| SwapRouter02 | `0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900` |

| Path | Buy | Sell |
| ---- | --- | ---- |
| **V2** (preferred when pair exists) | `swapExactETHForTokensSupportingFeeOnTransferTokens` | `swapExactTokensForETHSupportingFeeOnTransferTokens` |
| **V3** | `exactInputSingle` (WMON in, native value wraps) | `multicall(exactInputSingle → unwrapWETH9)` |

V3 fee tiers tried: 3000, 500, 10000, 100, 2500 (Flap LP fee profile maps STANDARD→3000, LOW→500, HIGH→10000).

## Allowlist

All execution routers must appear in `NADFUN_ALLOWED_ROUTER_ADDRESSES` (env name kept for compatibility). Defaults include Nad.fun + Flap Portal + Uniswap V2/V3 routers.

## Not yet supported

- Flap tokens with non-native quote tokens (USD*, etc.)
- Flap graduation targets PancakeSwap / Monday (DEX1 / DEX2) — Uniswap discovery is still attempted
- Uniswap Universal Router command encoding (SwapRouter02 / V2 Router02 only)
- Uniswap V4 pools
