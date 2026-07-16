# Runbook

## Initial setup

1. Create a dedicated wallet for this project only.
2. Configure Cloudflare secrets from `.env.example`.
3. Configure X API credentials and `AUTHORIZED_X_USER_ID`.
4. Configure Monad RPC URL and chain ID `143`.
5. Configure verified Nad.fun Lens + router allowlist.
6. Deploy with `TRADING_ENABLED=false` and `TRADE_DRY_RUN=true`.
7. Post test buy commands from the authorized X account.
8. Validate dry-run replies and quote estimates against Nad.fun.
9. Fund the dedicated wallet with a small MON amount.
10. Set conservative limits and enable live trading only when ready.

## Emergency stop

11. Disable trading immediately:

```bash
npx wrangler secret put TRADING_ENABLED
# value: false
# or update [vars] TRADING_ENABLED = "false" and redeploy
```

Also set `TRADE_DRY_RUN=true`.

## Investigations

12. Investigate failed trades via Durable Object trade records (`/get-record?tweetId=`).
13. Investigate `UNKNOWN` trades using tx hash, wallet nonce, and receipt lookup — never auto-retry.
14. Check whether a tweet already executed before manual intervention.

## Rotations

15. Rotate wallet private key if compromise is suspected (drain old wallet first if needed).
16. Rotate X credentials if the bot account is compromised.
17. Update router allowlists when Nad.fun publishes new verified routers.

## Deploy / rollback

18. Deploy through GitHub Actions manual workflow or `npm run deploy`.
19. Roll back by redeploying the previous Worker version and disabling trading.

## Stress testing checklist

- [ ] Unauthorized X users are ignored (no detailed security replies)
- [ ] Invalid grammar is rejected
- [ ] `100 mon` and `100mon` both work
- [ ] Dry-run never broadcasts
- [ ] Duplicate tweet IDs never double-spend
- [ ] Per-trade / hourly / daily limits reject overspend
- [ ] Locked / zero-output / bad-router tokens fail closed
- [ ] Confirmed replies arrive after SUBMITTED once receipt is mined
- [ ] Overlapping cron polls do not run concurrently
