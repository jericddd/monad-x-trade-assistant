# Security

## Threat model

This is a single-user hot-wallet automation service exposed through X mentions. Primary risks:

- Unauthorized X account posting commands
- Private key compromise
- Duplicate tweet delivery causing double spends
- Nonce collisions from concurrent execution
- Malicious token contracts or routers
- Ambiguous submission results that get retried

## Controls

- Authorization uses numeric X user ID only
- One tweet ID maps to one trade via Durable Object storage
- Wallet signing is restricted to allowlisted Nad.fun routers via `executeNadfunBuy`
- Dry-run and trading-disabled defaults
- `TRADE_DRY_RUN=true` overrides `TRADING_ENABLED=true`
- Per-trade, hourly, and daily limits enforced atomically in the Durable Object
- Poll overlap lock prevents concurrent mention batches
- Unknown submissions are never automatically retried
- Secrets never leave Worker/DO env bindings in request bodies
- Structured logging with secret redaction

## Key rotation

1. Disable trading
2. Create a new dedicated wallet
3. Update `TRADE_WALLET_PRIVATE_KEY`
4. Move only the funds you still need
5. Redeploy and re-enable dry-run first

## Incident response

1. Set `TRADING_ENABLED=false`
2. Redeploy immediately
3. Inspect trade records for affected tweet IDs
4. Rotate X credentials and wallet key if compromise is suspected

See [RUNBOOK.md](RUNBOOK.md).
