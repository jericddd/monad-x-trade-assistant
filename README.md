# MonEx Trade Assistant

Personal-only X command bot that lets one authorized X account buy Nad.fun tokens on Monad mainnet using a dedicated backend-controlled hot wallet.

**Warning:** When live trading is enabled, this service controls a funded hot wallet and can spend MON automatically. Use a dedicated wallet with limited funds only.

## Status

MVP Phases 1–4 are implemented:

- Phase 1: parser, auth, Durable Object, dry-run foundation
- Phase 2: real Monad RPC, Nad.fun Lens quotes, bytecode checks, simulation
- Phase 3: restricted signer, live submission, receipt confirmation
- Phase 4: cron polling + confirmation, emergency stop, ops docs

**Defaults remain safe:** `TRADING_ENABLED=false`, `TRADE_DRY_RUN=true`.

## Architecture

- Cloudflare Worker with cron-triggered X mention polling + confirmation
- `TradeCoordinator` Durable Object for idempotency, limits, and serialized execution
- Strict deterministic command parser (no LLM)
- Nad.fun Lens quote flow with router allowlisting
- Restricted signer: `executeNadfunBuy` only (no generic sendTransaction API)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Command format

```
@monexmonad buy 100 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777
@monexmonad buy 100mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777
```

Spends exactly N native MON buying the token at the supplied contract.

## Local setup

```bash
npm ci
cp .dev.vars.example .dev.vars
# fill credentials + MONAD_RPC_URL
npm run dev
curl http://127.0.0.1:8787/health
```

## Stress-test plan (recommended)

Keep dry-run on first:

1. Deploy with `TRADE_DRY_RUN=true` and `TRADING_ENABLED=false`
2. Configure real X credentials + `AUTHORIZED_X_USER_ID`
3. Configure `MONAD_RPC_URL` (mainnet) and Nad.fun addresses
4. Post buy commands from the authorized account only
5. Verify dry-run replies match Nad.fun UI estimates roughly
6. Confirm unauthorized accounts get no public security details
7. Confirm duplicate tweets are ignored
8. Only then consider a tiny live trade (`MAX_MON_PER_TRADE=0.1`)

## Enable live trading

Only after dry-run validation:

```bash
# Cloudflare secrets / vars
TRADING_ENABLED=true
TRADE_DRY_RUN=false
MAX_MON_PER_TRADE=0.1
MAX_MON_PER_DAY=0.5
MAX_TRADES_PER_HOUR=2
```

Fund the dedicated wallet with a small MON amount first.

## Emergency stop

Set `TRADING_ENABLED=false` (and preferably `TRADE_DRY_RUN=true`) and redeploy immediately.

## Test commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/RUNBOOK.md](docs/RUNBOOK.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/NADFUN_INTEGRATION.md](docs/NADFUN_INTEGRATION.md)
- [docs/COMMAND_SPEC.md](docs/COMMAND_SPEC.md)
