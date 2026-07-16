# Credentials guide

This project uses several environment variables. They come from **three different places**. Do not mix them up.

Secrets are set via Cloudflare (`wrangler secret put`) or locally in `.dev.vars`. Never commit real values to git.

---

## Bot account (`@monexmonad`)

The bot reads mentions and posts replies. These credentials must belong to the **bot X account**.

Mentions use the same pattern as the working MonEx catch bot: **OAuth 1.0a**. Bot user id is always resolved via `/users/me` — there is no `X_BOT_USER_ID` setting.

| Variable                | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `X_API_KEY`             | OAuth 1.0a consumer key                   |
| `X_API_SECRET`          | OAuth 1.0a consumer secret                |
| `X_ACCESS_TOKEN`        | OAuth 1.0a access token for `@monexmonad` |
| `X_ACCESS_TOKEN_SECRET` | OAuth 1.0a access token secret            |

**Where to get them**

1. Create an app at [developer.x.com](https://developer.x.com) (Read + Write permissions).
2. Enable **OAuth 1.0a** with Read + Write.
3. Generate **Consumer Key / Secret** and **Access Token / Secret** while authenticated as **@monexmonad**.

You can reuse the same four OAuth secrets already configured on the MonEx catch Worker (`monex-api`).

Also set (non-secret, already in `wrangler.toml` by default):

- `X_BOT_USERNAME=monexmonad`

If an old `X_BOT_USER_ID` secret still exists in Cloudflare, delete it:

```bash
npx wrangler secret delete X_BOT_USER_ID
```

---

## Authorized accounts (multi-user)

Users who complete **Log in with X → Connect wallet** on `https://packs.monexmonad.xyz` are registered in the `USER_REGISTRY` Durable Object. Their **in-site trading wallet** (derived from `CUSTODIAL_MASTER_SEED`) is what signs buys when they mention `@monexmonad`.

| Variable                | Purpose                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `AUTHORIZED_X_USER_ID`  | Optional bootstrap allowlist (legacy single-user hot wallet)                        |
| `CUSTODIAL_MASTER_SEED` | Master seed for per-user in-site wallets (falls back to `TRADE_WALLET_PRIVATE_KEY`) |
| `SITE_API_SECRET`       | Shared secret for packs.monexmonad.xyz link/withdraw APIs                           |

**Website**

- Deposit: user wallet → in-site trading wallet (browser transfer)
- Withdraw: in-site trading wallet → user wallet (Worker-signed)
- Same `SITE_API_SECRET` must be set on the packs Worker as `TRADE_SITE_API_SECRET`

---

## Monad

| Variable        | Purpose                             |
| --------------- | ----------------------------------- |
| `MONAD_RPC_URL` | HTTP RPC endpoint for Monad mainnet |

**Where to get it**

- Public default: `https://rpc.monad.xyz`
- Or use a provider (Alchemy, QuickNode, etc.) and paste their Monad mainnet URL.

Related non-secrets (in `wrangler.toml` / `.env.example`):

- `MONAD_CHAIN_ID=143`
- `MONAD_EXPLORER_TX_URL`

---

## Live trading only (optional)

| Variable                   | Purpose                                |
| -------------------------- | -------------------------------------- |
| `TRADE_WALLET_PRIVATE_KEY` | Dedicated hot wallet used to sign buys |

**Not required for dry-run.** Create a **new wallet** used only for this bot. Never use your main wallet.

---

## Quick reference

```
Bot (@monexmonad) — OAuth 1.0a (same as MonEx catch bot)
├── X_API_KEY
├── X_API_SECRET
├── X_ACCESS_TOKEN
└── X_ACCESS_TOKEN_SECRET

Authorized account (you) — only account allowed to command buys
└── AUTHORIZED_X_USER_ID

Monad — blockchain RPC
└── MONAD_RPC_URL
```

---

## Set secrets on Cloudflare

After the first deploy:

```bash
npx wrangler secret put X_API_KEY
npx wrangler secret put X_API_SECRET
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_TOKEN_SECRET
npx wrangler secret put AUTHORIZED_X_USER_ID
npx wrangler secret put MONAD_RPC_URL
# remove leftover secret if present:
# npx wrangler secret delete X_BOT_USER_ID
npm run deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [RUNBOOK.md](./RUNBOOK.md) for full setup.
