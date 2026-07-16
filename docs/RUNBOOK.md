# Runbook

1. Create a dedicated wallet for this project only.
2. Configure Cloudflare secrets from `.env.example`.
3. Configure X API credentials and `AUTHORIZED_X_USER_ID`.
4. Configure Monad RPC URL and chain ID.
5. Configure verified Nad.fun Lens and router allowlist.
6. Deploy with `TRADING_ENABLED=false` and `TRADE_DRY_RUN=true`.
7. Post test buy commands from the authorized X account.
8. Validate dry-run replies and quote estimates.
9. Fund the dedicated wallet with a small MON amount.
10. Set conservative limits and enable live trading only when ready.
11. Disable trading immediately if anything looks wrong.
12. Investigate failed trades using Durable Object trade records.
13. Investigate `UNKNOWN` trades using tx hash, nonce, and receipt lookup.
14. Check whether a tweet already executed before manual intervention.
15. Rotate wallet private key if compromise is suspected.
16. Rotate X credentials if the bot account is compromised.
17. Update router allowlists when Nad.fun publishes new verified routers.
18. Deploy through GitHub Actions manual workflow.
19. Roll back by redeploying the previous Worker version and disabling trading.
