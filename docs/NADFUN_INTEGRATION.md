# Nad.fun Integration

## Official sources

- Trading docs: https://nad.fun/trading.md
- ABI reference: https://nad.fun/abi.md
- Verified contract repo: https://github.com/Naddotfun/contract-v3-abi

## Monad mainnet addresses

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| Lens                 | `0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea` |
| Bonding Curve Router | `0x6F6B8F1a20703309951a5127c45B49b1CD981A22` |
| DEX Router           | `0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137` |

## Buy flow (implemented)

1. Validate token has contract bytecode
2. Call Lens `getAmountOut(token, amountIn, true)`
3. Check `isLocked(token)` when available
4. Validate returned router against `NADFUN_ALLOWED_ROUTER_ADDRESSES`
5. Calculate `amountOutMin` with bigint slippage BPS
6. Build router `buy({ amountOutMin, token, to, deadline })`
7. Simulate via `publicClient.simulateContract`
8. Estimate gas and enforce wallet reserve
9. Sign/broadcast only through `executeNadfunBuy` when live trading is enabled
10. Persist hash, reply, then confirm receipt asynchronously

## Price impact

Reliable on-chain price-impact data is not consistently exposed by Lens for all tokens.
The system therefore relies on:

- Max trade size
- Slippage BPS
- Quote validation
- Simulation
- Router allowlist
- Wallet reserve

## Mock vs real providers

- Real providers are used when `MONAD_RPC_URL` and `NADFUN_LENS_ADDRESS` are set and `USE_MOCK_BLOCKCHAIN` is not `true`
- Unit tests use mock providers and never hit mainnet or a funded wallet
