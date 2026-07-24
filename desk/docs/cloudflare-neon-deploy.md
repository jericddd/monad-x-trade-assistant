# Deploy Monad Packs on Cloudflare + Neon

**Live site:** `https://packs.monexmonad.xyz`  
**Separate from:** `https://monexmonad.xyz` (MonEx game)

Uses your paid Cloudflare plan. Database stays on **Neon** (free Postgres).

---

## Architecture

```text
packs.monexmonad.xyz  →  Cloudflare Worker (OpenNext)
                              ↓
                         Neon Postgres (DATABASE_URL)
                         R2 bucket (pack card images)
                         MonEx worker webhook (open pack on X)
```

---

## Part 1 — Neon (you may already have this)

1. [neon.tech](https://neon.tech) → project `monad-packs`
2. Copy **pooled** connection string
3. Initialize tables:

```bash
DATABASE_URL="your-neon-url" npm run db:push
DATABASE_URL="your-neon-url" npm run db:seed
```

---

## Part 2 — Cloudflare R2 (pack images)

1. Cloudflare Dashboard → **R2** → **Create bucket**
2. Name: `monad-packs-assets` (matches `wrangler.jsonc`)
3. **Settings** → enable **Public access** for the bucket (or custom domain)
4. Copy the public URL, e.g. `https://pub-xxxxx.r2.dev`
5. You’ll set this as `R2_PUBLIC_URL` secret

---

## Part 3 — Deploy the Worker

### Option A — GitHub Actions (recommended)

Add to **MonEx** or **monad-packs** repo secrets:

| Secret | Value |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts Edit** + **R2 Storage Edit** + **Account Settings Read** |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID |

The workflow `.github/workflows/deploy-cloudflare-packs.yml` runs on push to the deploy branch.

### Option B — Manual from your machine

```bash
npm install
npm run build:cloudflare
npx wrangler deploy
```

First time, create R2 bucket if missing:

```bash
npx wrangler r2 bucket create monad-packs-assets
```

### Worker secrets (Dashboard → Workers → monad-packs → Settings → Variables)

Add as **Secrets** (encrypted):

| Secret | Value |
|--------|--------|
| `DATABASE_URL` | Neon pooled connection string |
| `SESSION_SECRET` | random 64-char hex |
| `X_CLIENT_ID` | OAuth 2.0 client id |
| `X_CLIENT_SECRET` | OAuth 2.0 client secret |
| `X_CALLBACK_URL` | `https://packs.monexmonad.xyz/api/auth/x/callback` |
| `X_BOT_WEBHOOK_SECRET` | shared with MonEx worker |
| `ADMIN_X_USER_IDS` | your X user id |
| `CRON_SECRET` | random string (required — cron fails closed without it) |
| `R2_PUBLIC_URL` | R2 public bucket URL |

Optional (for claims later): `NFT_CONTRACT_ADDRESS`, `MINT_WALLET_PRIVATE_KEY`, `MONAD_RPC_URL`

Plaintext vars are already in `wrangler.jsonc` (`NEXT_PUBLIC_*`, `MONAD_PACKS_WEBSITE_URL`).

---

## Part 4 — Custom domain `packs.monexmonad.xyz`

1. Cloudflare Dashboard → **Workers & Pages** → **monad-packs**
2. **Settings** → **Domains & Routes** → **Add Custom Domain**
3. Enter: `packs.monexmonad.xyz`
4. Cloudflare creates DNS automatically (same zone as `monexmonad.xyz`)

Confirm:

- `packs.monexmonad.xyz` → Monad Packs
- `monexmonad.xyz` → MonEx game (unchanged)

---

## Part 5 — X Developer Portal

OAuth 2.0 callback URL (trade desk):

```text
https://trade.monexmonad.xyz/api/auth/x/callback
```

Website login scopes must include `tweet.read users.read offline.access`.  
X requires `tweet.read` for `GET /2/users/me` even when only loading the profile.

---

## Part 6 — MonEx bot webhook

On `monex-api` worker secrets:

```text
MONAD_PACKS_API_URL=https://packs.monexmonad.xyz
MONAD_PACKS_WEBHOOK_SECRET=<same as Monad Packs>
```

Deploy MonEx worker after merging open-pack routing.

---

## Part 7 — Cron (expire pending cards)

`wrangler.jsonc` includes hourly cron. After deploy, verify in:

**Workers → monad-packs → Triggers → Cron Triggers**

Should call the worker hourly; the app handles `/api/cron/expire` with `CRON_SECRET`.

---

## Local development

```bash
cp .env.example .env
# DATABASE_URL = Neon or local Postgres
npm run dev
```

Cloudflare bindings (R2) are simulated in dev via `initOpenNextCloudflareForDev()` — uploads use local `./uploads` folder without R2.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | `npm run build` first; need Node 20+ |
| DB connection error | Set `DATABASE_URL` secret on Worker |
| Images broken after import | Set `R2_PUBLIC_URL`; enable R2 public access |
| X login fails | Callback must be `packs.monexmonad.xyz` exactly |
| Wrong site opens | Check custom domain is on **monad-packs** worker, not Pages for MonEx |

---

## Costs

- **Cloudflare Worker** — included in paid plan
- **R2** — pennies for pack images at MVP scale
- **Neon** — free tier
