# MonEx Trade Desk (`desk/`)

Web UI for MonEx Trade Assistant. Lives in the **monad-x-trade-assistant** monorepo.

**Live:** [https://trade.monexmonad.xyz](https://trade.monexmonad.xyz)

## Develop

```bash
cp .env.example .env
npm ci
npm run dev
```

## Deploy

```bash
npm ci
npm run build:cloudflare
npx opennextjs-cloudflare deploy
```

Uses Cloudflare Worker name `monad-packs` (legacy name) so `trade.monexmonad.xyz` and existing secrets stay attached.

## X OAuth callback

```text
https://trade.monexmonad.xyz/api/auth/x/callback
```
