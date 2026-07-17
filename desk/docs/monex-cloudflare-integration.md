# Monad Packs ↔ MonEx Cloudflare integration

The `@monexmonad` X bot runs on **Cloudflare Workers** (`monex-api`). Open pack commands are routed from that worker to the Monad Packs API.

## Credentials — where they live

| Secret | Location | Used for |
|--------|----------|----------|
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` | Cloudflare Worker secrets (already set) | X polling + replies |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secrets on `MonEx` repo | Deploy worker |
| `MONAD_PACKS_API_URL` | Cloudflare Worker secret (new) | Monad Packs base URL |
| `MONAD_PACKS_WEBHOOK_SECRET` | Cloudflare Worker secret + Monad Packs `.env` | Webhook auth |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | Monad Packs `.env` | Website X login (separate OAuth app or same app) |

**This cloud agent does not have your X or Cloudflare secrets.** They are only in your Cloudflare dashboard / GitHub repo secrets.

## One-time setup

### 1. Deploy Monad Packs

Deploy the Monad Packs app and note its public URL, e.g. `https://packs.monexmonad.xyz`.

Set on Monad Packs:

```bash
MONAD_PACKS_WEBSITE_URL=https://packs.monexmonad.xyz
X_BOT_WEBHOOK_SECRET=<generate-a-long-random-string>
```

### 2. Configure MonEx Worker

Your OAuth 1.0 bot keys should already be in Cloudflare as:

| Worker secret | X Developer Portal field |
|---------------|-------------------------|
| `X_API_KEY` | Consumer Key |
| `X_API_SECRET` | Consumer Key Secret |
| `X_ACCESS_TOKEN` | Access Token |
| `X_ACCESS_TOKEN_SECRET` | Access Token Secret |

Add the Monad Packs connection (from `MonEx/cloudflare/monex-api`):

```bash
npx wrangler secret put MONAD_PACKS_API_URL
# e.g. https://packs.monexmonad.xyz

npx wrangler secret put MONAD_PACKS_WEBHOOK_SECRET
# must match Monad Packs X_BOT_WEBHOOK_SECRET exactly
```

Or in Cloudflare Dashboard → Workers → `monex-api` → Settings → Variables.

### 3. Deploy MonEx worker

Merge the MonEx PR with open-pack routing, then run the **Deploy Cloudflare API** GitHub Action (manual workflow_dispatch).

## How routing works

```
@monexmonad open pack  →  monex-api worker  →  POST /api/x/webhook  →  Monad Packs
@monexmonad catch 3    →  existing MonEx catch flow (unchanged)
```

- Separate KV dedupe keys: `monex:processed:` vs `monadpacks:processed:`
- Catch limits, Monballs, and activity log are **not** affected by pack opens
- Failed validation on open pack does **not** consume X cooldown (handled in Monad Packs backend)

## Verify

1. Set a featured X pack in Monad Packs admin
2. Post `@monexmonad open pack` from a test account
3. Bot should reply with card reveal + website claim link (no tx hash / wallet address)
