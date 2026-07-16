# Deployment

## Cloudflare resources

- Worker: `monad-x-trade-assistant`
- Durable Object class: `TradeCoordinator`
- Cron trigger: `* * * * *`

## GitHub secrets

Configure in the production GitHub environment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- All application secrets listed in `.env.example`

## Deploy commands

Local:

```bash
npm run deploy
```

GitHub Actions:

- Run the `deploy` workflow manually

Production deployment must not automatically enable trading.
