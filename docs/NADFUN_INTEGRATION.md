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

## Buy flow

1. Call Lens `getAmountOut(token, amountIn, true)`
2. Receive router address and expected output
3. Validate router against `NADFUN_ALLOWED_ROUTER_ADDRESSES`
4. Build router `buy` transaction with slippage-protected minimum output
5. Simulate, sign, and broadcast through the restricted signer

## Phase status

- Phase 1: mock quote and simulation providers
- Phase 2: real Lens, bytecode validation, and simulation
- Phase 3: restricted signer and live submission
