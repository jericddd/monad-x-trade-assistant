# MonEx Trade Assistant

Buy Nad.fun tokens on **Monad mainnet** by mentioning [@monexmonad](https://x.com/monexmonad) on X. Fund a custodial trading wallet on the web desk, then trade from X (or buy/sell held tokens on the desk).

**Live product**
- Desk: [https://trade.monexmonad.xyz](https://trade.monexmonad.xyz)
- Worker: [https://monad-x-trade-assistant.0xjericd.workers.dev/health](https://monad-x-trade-assistant.0xjericd.workers.dev/health)

> This Worker controls real MON when live trading is enabled. Use limited funds only.

## What it does

1. Sign in with X on the desk → link a browser wallet → fund an in-site trading wallet  
2. Post on X: `@monexmonad buy <amount> mon <tokenAddress>`  
3. Worker quotes Nad.fun, simulates, signs locally, broadcasts on Monad  
4. Bot replies once after confirmation (spent / received — no URLs or `0x` hex; X blocks crypto addresses for new app auth)  
5. Desk shows live portfolio, activity, add-funds / cash-out, and buy/sell for tokens you already hold  

## Command format

```text
@monexmonad buy 1 mon 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777
```

Strict parser (no LLM). Amount is native MON spent.

## Architecture

- Cloudflare Worker + cron (`* * * * *`) for X mention polling + receipt confirmation  
- Durable Objects: `TradeCoordinator` (idempotency / limits) + `UserRegistry` (linked users / custodial wallets)  
- Local transaction signing (never `eth_signTransaction` on public RPC)  
- Site APIs under `/api/v1/users/*` for [trade.monexmonad.xyz](https://trade.monexmonad.xyz)  

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Production flags (this deploy)

Configured in `wrangler.toml` / secrets for the live Worker:

| Var | Live value |
|-----|------------|
| `TRADING_ENABLED` | `true` |
| `TRADE_DRY_RUN` | `false` |
| `MAX_MON_PER_TRADE` | `10` |
| `MAX_MON_PER_DAY` | `30` |

Check anytime:

```bash
curl -s https://monad-x-trade-assistant.0xjericd.workers.dev/health
```

Expect `live: true`, `xOAuthConfigured: true`, `dryRun: false`.

## Local setup

```bash
npm ci
cp .dev.vars.example .dev.vars
# fill X OAuth1 keys, AUTHORIZED_X_USER_ID or rely on UserRegistry, MONAD_RPC_URL, SITE_API_SECRET
npm run dev
curl http://127.0.0.1:8787/health
npm test
```

Credentials map: [docs/CREDENTIALS.md](docs/CREDENTIALS.md).

## Emergency stop

Set `TRADING_ENABLED=false` (and preferably `TRADE_DRY_RUN=true`), then `npx wrangler deploy`.

## Docs

- [docs/CREDENTIALS.md](docs/CREDENTIALS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/RUNBOOK.md](docs/RUNBOOK.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/NADFUN_INTEGRATION.md](docs/NADFUN_INTEGRATION.md)
- [docs/COMMAND_SPEC.md](docs/COMMAND_SPEC.md)

## Demo checklist

1. Open [trade.monexmonad.xyz](https://trade.monexmonad.xyz) → Continue with X → link wallet → add funds  
2. Post a small buy on X to `@monexmonad`  
3. Show bot reply + desk Activity / Portfolio (explorer tx link on Activity)  
4. Optional: buy/sell a held token from Portfolio on the desk  

Add your demo video link here when ready: `<!-- DEMO_VIDEO_URL -->`
