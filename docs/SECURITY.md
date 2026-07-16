# Security

## Threat model

This is a single-user hot-wallet automation service exposed through X mentions. Primary risks:

- Unauthorized X account posting commands
- Private key compromise
- Duplicate tweet delivery causing double spends
- Nonce collisions from concurrent execution
- Malicious token contracts or routers

## Controls

- Authorization uses numeric X user ID only
- One tweet ID maps to one trade via Durable Object storage
- Wallet signing is restricted to allowlisted Nad.fun routers
- Dry-run and trading-disabled defaults
- Per-trade, hourly, and daily limits enforced atomically in the Durable Object
- Structured logging with secret redaction

## Incident response

1. Set `TRADING_ENABLED=false`
2. Redeploy immediately
3. Inspect trade records for affected tweet IDs
4. Rotate X credentials and wallet key if compromise is suspected

See [RUNBOOK.md](RUNBOOK.md) for operational steps.
