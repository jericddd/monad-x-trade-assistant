# MonEx Trade Assistant

Buy Nad.fun tokens on **Monad mainnet** by mentioning [@monexmonad](https://x.com/monexmonad) on X. Fund a custodial trading wallet on the web desk, then trade from X (or buy/sell held tokens on the desk).

**This is the only product repo** (worker + web desk).

| Piece | URL |
|-------|-----|
| Desk | [https://trade.monexmonad.xyz](https://trade.monexmonad.xyz) |
| Worker health | [https://monad-x-trade-assistant.0xjericd.workers.dev/health](https://monad-x-trade-assistant.0xjericd.workers.dev/health) |

> Live trading spends real MON. Use limited funds only.

## Repo layout

```text
├── src/           # Cloudflare Worker (X bot + custodial APIs)
├── desk/          # Next.js trade desk (OpenNext → Cloudflare)
├── docs/          # Worker ops / architecture
└── wrangler.toml  # Worker deploy config
```

## What it does

1. Sign in with X on the desk → link a browser wallet → fund an in-site trading wallet  
2. Post on X: `@monexmonad buy <amount> mon <tokenAddress>`  
3. Worker quotes Nad.fun, simulates, signs locally, broadcasts on Monad  
4. Bot replies once after confirmation (spent / received — no URLs or `0x` hex)  
5. Desk shows live portfolio, activity, add-funds / cash-out, and buy/sell for held tokens  

## Command format

```text
@monexmonad buy 1 mon 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777
```

## Deploy

### Worker (X bot + APIs)

```bash
npm ci
npx wrangler deploy
curl -s https://monad-x-trade-assistant.0xjericd.workers.dev/health
```

### Desk (trade.monexmonad.xyz)

```bash
cd desk
npm ci
npm run build:cloudflare
npx opennextjs-cloudflare deploy
```

Cloudflare Worker name for the desk remains `monad-packs` so the existing custom domain and secrets keep working. The GitHub source of truth is this repo’s `desk/` folder.

## Local development

```bash
# Worker
npm ci
cp .dev.vars.example .dev.vars
npm run dev

# Desk (separate terminal)
cd desk
cp .env.example .env
npm ci
npm run dev
```

## Emergency stop

Set Worker `TRADING_ENABLED=false` (and preferably `TRADE_DRY_RUN=true`), then `npx wrangler deploy`.

## Docs

- [docs/CREDENTIALS.md](docs/CREDENTIALS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/RUNBOOK.md](docs/RUNBOOK.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/NADFUN_INTEGRATION.md](docs/NADFUN_INTEGRATION.md)
- [docs/COMMAND_SPEC.md](docs/COMMAND_SPEC.md)
- [desk/README.md](desk/README.md)

## Demo checklist

1. Open [trade.monexmonad.xyz](https://trade.monexmonad.xyz) → Continue with X → link wallet → add funds  
2. Post a small buy on X to `@monexmonad`  
3. Show bot reply + desk Activity / Portfolio (explorer tx on Activity)  

Add demo video: `<!-- DEMO_VIDEO_URL -->`
