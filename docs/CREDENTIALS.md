# Credentials guide

This project uses several environment variables. They come from **three different places**. Do not mix them up.

Secrets are set via Cloudflare (`wrangler secret put`) or locally in `.dev.vars`. Never commit real values to git.

---

## Bot account (`@monexmonad`)

The bot reads mentions and posts replies. These credentials must belong to the **bot X account**.

| Variable | Purpose |
|----------|---------|
| `X_BEARER_TOKEN` | Read mentions via X API v2 |
| `X_API_KEY` | OAuth 1.0a signing (app consumer key) |
| `X_API_SECRET` | OAuth 1.0a signing (app consumer secret) |
| `X_ACCESS_TOKEN` | Post replies as the bot |
| `X_ACCESS_TOKEN_SECRET` | Post replies as the bot |
| `X_BOT_USER_ID` | Numeric user ID of `@monexmonad` |

**Where to get them**

1. Create an app at [developer.x.com](https://developer.x.com) (Read + Write permissions).
2. Generate **API Key**, **API Secret**, and **Bearer Token** from the app’s **Keys and tokens** page.
3. Generate **Access Token** and **Access Token Secret** while authenticated as **@monexmonad** so replies come from the bot.
4. Look up the bot’s numeric ID (e.g. [tweeterid.com](https://tweeterid.com)) for `X_BOT_USER_ID`.

Also set (non-secret, already in `wrangler.toml` by default):

- `X_BOT_USERNAME=monexmonad`

---

## Authorized account (you)

Only this numeric X user ID may post buy commands. Everyone else is ignored.

| Variable | Purpose |
|----------|---------|
| `AUTHORIZED_X_USER_ID` | Numeric user ID of the one allowed trader |

**Where to get it**

- Look up **your personal X account** numeric ID (the account that will post `@monexmonad buy ...` commands).
- This is **not** the bot account ID.

---

## Monad

| Variable | Purpose |
|----------|---------|
| `MONAD_RPC_URL` | HTTP RPC endpoint for Monad mainnet |

**Where to get it**

- Public default: `https://rpc.monad.xyz`
- Or use a provider (Alchemy, QuickNode, etc.) and paste their Monad mainnet URL.

Related non-secrets (in `wrangler.toml` / `.env.example`):

- `MONAD_CHAIN_ID=143`
- `MONAD_EXPLORER_TX_URL`

---

## Live trading only (optional)

| Variable | Purpose |
|----------|---------|
| `TRADE_WALLET_PRIVATE_KEY` | Dedicated hot wallet used to sign buys |

**Not required for dry-run.** Create a **new wallet** used only for this bot. Never use your main wallet.

---

## Quick reference

```
Bot (@monexmonad) — reads mentions, replies, runs the X app identity
├── X_BEARER_TOKEN
├── X_API_KEY
├── X_API_SECRET
├── X_ACCESS_TOKEN
├── X_ACCESS_TOKEN_SECRET
└── X_BOT_USER_ID

Authorized account (you) — only account allowed to command buys
└── AUTHORIZED_X_USER_ID

Monad — blockchain RPC
└── MONAD_RPC_URL
```

---

## Set secrets on Cloudflare

After the first deploy:

```bash
npx wrangler secret put X_BEARER_TOKEN
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_TOKEN_SECRET
npx wrangler secret put X_BOT_USER_ID
npx wrangler secret put AUTHORIZED_X_USER_ID
npx wrangler secret put MONAD_RPC_URL
npm run deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [RUNBOOK.md](./RUNBOOK.md) for full setup.
