# MonEx Trade Assistant

Personal-only X command bot that lets one authorized X account buy Nad.fun tokens on Monad mainnet using a dedicated backend-controlled hot wallet.

**Warning:** When live trading is enabled, this service controls a funded hot wallet and can spend MON automatically. Use a dedicated wallet with limited funds only.

## Architecture

- Cloudflare Worker with cron-triggered X mention polling
- `TradeCoordinator` Durable Object for idempotency, limits, and serialized execution
- Strict deterministic command parser (no LLM)
- Nad.fun Lens quote flow with router allowlisting
- Dry-run mode enabled by default

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Command format

Only one authorized numeric X user ID may trade.

```
@monexmonad buy 100 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777
@monexmonad buy 100mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777
```

This spends exactly 100 native MON on the token at the supplied contract address.

## Local setup

```bash
npm ci
cp .dev.vars.example .dev.vars
# fill in .dev.vars
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Environment setup

Copy `.env.example` or `.dev.vars.example` and configure:

- X API credentials and authorized user ID
- Monad RPC URL and chain ID
- Nad.fun Lens and allowlisted router addresses
- Trading safety limits

Trading defaults:

- `TRADING_ENABLED=false`
- `TRADE_DRY_RUN=true`

## Dry-run setup

Leave `TRADE_DRY_RUN=true`. The bot will parse commands, validate the author, query quotes (mock in Phase 1), simulate, and reply with estimated results without signing or broadcasting.

## Test commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Cloudflare setup

1. Create a Cloudflare Workers project
2. Configure secrets from `.env.example`
3. Deploy with Wrangler or GitHub Actions

Required resources:

- Worker
- Durable Object binding: `TRADE_COORDINATOR`
- Cron trigger: every minute

## Deployment

Manual deploy:

```bash
npm run deploy
```

GitHub Actions deploy workflow is manual dispatch only.

## Enable trading

Only after dry-run validation on mainnet:

1. Fund a dedicated wallet with a small MON amount
2. Set conservative limits
3. Set `TRADE_DRY_RUN=false`
4. Set `TRADING_ENABLED=true`
5. Deploy

## Stop trading

Set `TRADING_ENABLED=false` and redeploy immediately. Optionally set `TRADE_DRY_RUN=true`.

## Current limitations (Phase 1)

- Mock blockchain quote and simulation providers
- No live transaction signing or broadcasting
- Real Nad.fun Lens and Monad RPC integration planned for Phase 2
- Live execution planned for Phase 3

## Official Nad.fun sources

- https://nad.fun/trading.md
- https://nad.fun/abi.md
- https://github.com/Naddotfun/contract-v3-abi
