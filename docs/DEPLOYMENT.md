# Deployment

## Cloudflare resources

- Worker: `monad-x-trade-assistant`
- Durable Object class: `TradeCoordinator`
- Cron trigger: `* * * * *` (poll mentions + confirm pending txs)

## Required secrets

Set via `wrangler secret put` or GitHub environment secrets.

**See [CREDENTIALS.md](./CREDENTIALS.md) for which account each secret comes from.**

### Bot account (`@monexmonad`) — OAuth 1.0a

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_BOT_USER_ID` (optional — auto-resolved via `/users/me`)

### Authorized account (you)

- `AUTHORIZED_X_USER_ID`

### Monad

- `MONAD_RPC_URL`

### Live trading only

- `TRADE_WALLET_PRIVATE_KEY`

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
