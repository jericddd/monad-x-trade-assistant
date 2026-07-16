# Deployment

## Cloudflare resources

- Worker: `monad-x-trade-assistant`
- Durable Object class: `TradeCoordinator`
- Cron trigger: `* * * * *` (poll mentions + confirm pending txs)

## Required secrets

Set via `wrangler secret put` or GitHub environment secrets:

- `X_BEARER_TOKEN`
- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_BOT_USER_ID`
- `AUTHORIZED_X_USER_ID`
- `MONAD_RPC_URL`
- `TRADE_WALLET_PRIVATE_KEY` (required only for live trading)

Non-secret vars may live in `wrangler.toml` `[vars]` (already populated for Nad.fun mainnet defaults).

## GitHub secrets for deploy workflow

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Deploy commands

```bash
npm run deploy
```

Or run the `deploy` GitHub Actions workflow manually.

Production deployment must not automatically enable trading.
