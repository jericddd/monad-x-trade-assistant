You are building a completely new standalone project from an empty repository.

Do not integrate this into MonEx’s existing game repository.

The project is a private personal trading assistant that receives commands from X and automatically buys Nad.fun tokens on Monad using a dedicated backend-controlled wallet.

The X bot account may still be @monexmonad, but this codebase must remain completely separate from the MonEx game.

# PROJECT NAME

Suggested repository name:

monad-x-trade-assistant

Suggested product name:

MonEx Trade Assistant

# PRIMARY PURPOSE

Build a personal-only X command bot that lets one authorized X account buy tokens launched on Nad.fun without opening Nad.fun, connecting a browser wallet, or manually signing a transaction.

The authorized user posts:

@monexmonad buy 100 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

This must also work:

@monexmonad buy 100mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

Both commands mean:

Spend exactly 100 native MON buying the token at the supplied contract address.

They do not mean buying exactly 100 units of the token.

A dedicated backend wallet signs and submits the transaction automatically.

# IMPORTANT PROJECT BOUNDARIES

This is:

* A standalone repository
* A personal-only tool
* A single-user system
* A backend-controlled hot wallet
* A strict X command parser
* A Nad.fun purchase assistant
* A Monad transaction executor

This is not:

* Part of the MonEx browser game
* A public trading platform
* A custodial wallet service
* A multi-user bot
* A general-purpose wallet
* A general transaction-signing API
* An AI trading agent
* A natural-language trading assistant
* A token discovery tool
* A portfolio manager
* A browser extension

Do not add features outside the defined MVP.

# INITIAL TASK

Create the project foundation first.

Before implementing blockchain execution, generate and explain:

1. Proposed architecture
2. Repository file structure
3. Technology choices
4. Data-storage strategy
5. X API integration strategy
6. Monad and Nad.fun integration strategy
7. Wallet-security strategy
8. Idempotency and concurrency strategy
9. Deployment architecture
10. Rollout phases

After presenting the plan, implement the repository.

Do not ask me to choose basic implementation details unless absolutely necessary.

Use the defaults defined below.

# TECHNOLOGY STACK

Use:

* TypeScript
* Node.js-compatible Cloudflare Workers
* Cloudflare Workers
* Cloudflare Durable Objects
* Cloudflare KV only for non-atomic configuration or cached data
* Viem for EVM interactions
* Vitest for testing
* Wrangler for local development and deployment
* ESLint
* Prettier
* Zod for environment and payload validation
* GitHub Actions for continuous integration
* npm as the package manager

Use strict TypeScript.

Do not use:

* Express
* Next.js
* React
* A frontend framework
* A browser wallet
* Ethers unless a Nad.fun integration absolutely requires it
* JavaScript Number for blockchain values
* Cloudflare KV as a transaction lock
* An LLM for parsing commands

The project does not need a user-facing website for the MVP.

A minimal health-check route is acceptable.

# HIGH-LEVEL ARCHITECTURE

Build the following components:

1. X Mention Poller Worker
2. Command Parser
3. Authorization Validator
4. Trade Coordinator Durable Object
5. Nad.fun Quote Service
6. Monad Transaction Simulator
7. Restricted Transaction Signer
8. Trade Persistence Layer
9. X Reply Service
10. Scheduled Transaction Confirmation Worker
11. Structured Logging and Error Sanitization
12. Emergency Stop Configuration

Conceptual flow:

Authorized X post
↓
X Mention Poller
↓
Author ID validation
↓
Strict command parser
↓
Trade Coordinator Durable Object
↓
Duplicate and spending-limit checks
↓
Nad.fun Lens quote
↓
Router allowlist validation
↓
Transaction simulation
↓
Restricted wallet signing
↓
Monad transaction broadcast
↓
Persist transaction state
↓
Reply to X post
↓
Confirm transaction receipt

# X INTEGRATION

Use the X API to retrieve mentions made to the configured bot account.

The system must support scheduled polling through Cloudflare Cron Triggers.

Do not require the user to submit commands through a website.

Use environment variables for all X credentials.

Expected environment variables:

X_BEARER_TOKEN
X_API_KEY
X_API_SECRET
X_ACCESS_TOKEN
X_ACCESS_TOKEN_SECRET
X_BOT_USER_ID
X_BOT_USERNAME
AUTHORIZED_X_USER_ID

Use the numeric X user ID for authorization.

Do not authorize using:

* Username
* Display name
* Profile URL
* Tweet text
* X verification status

The X username may change.

The numeric authorized user ID is the source of truth.

Only process mentions where:

tweet.authorId === AUTHORIZED_X_USER_ID

Ignore every other user.

Do not publicly explain security rules to unauthorized accounts.

# COMMAND GRAMMAR

Do not use AI or an LLM to interpret commands.

Use a strict deterministic parser.

Supported command:

buy <amount> mon of <tokenContract>

Examples that must work:

@monexmonad buy 100 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad buy 100mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad BUY 0.5 MON OF 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

Allow:

* Case-insensitive keywords
* Extra whitespace between words
* No space between the amount and MON
* The exact bot mention before the command
* Leading or trailing whitespace

Reject:

* buy max mon
* buy all mon
* buy around 100 mon
* buy one hundred mon
* buy $100
* buy 100 usd
* buy 100 tokens
* buy 100 mon to
* buy 100 mon of this
* Nad.fun URLs instead of a contract
* Multiple contract addresses
* Multiple commands in one post
* Scientific notation
* Hexadecimal amounts
* Negative amounts
* Zero
* Commas
* More than 18 decimals
* Extra instructions after the contract
* Sell commands
* Transfer commands
* Approval commands
* Withdraw commands
* Arbitrary calldata

After removing the exact bot mention, enforce the full string.

Conceptual regular expression:

^buy\s+(\d+(?:.\d+)?)\s*mon\s+of\s+(0x[a-fA-F0-9]{40})$

Return:

type ParsedBuyCommand = {
action: "buy";
amountMon: string;
tokenAddress: `0x${string}`;
};

Do not convert amountMon using Number or parseFloat.

Use Viem parseEther after validating the decimal string.

# SUPPORTED ACTIONS

The MVP supports only:

BUY

Do not implement:

* Sell
* Transfer
* Withdraw
* Approval
* Bridge
* Limit order
* Stop loss
* Copy trading
* Multiple wallets
* Multiple authorized users
* Token deployment
* Automatic token discovery
* Market scanning
* AI recommendations
* Arbitrary DEX execution
* Wallet imports through a website
* Private-key submission through X

# WALLET MODEL

Use one dedicated hot wallet created specifically for this project.

Never use the user’s main wallet.

Read the private key only from the server-side environment secret:

TRADE_WALLET_PRIVATE_KEY

Never store the private key in:

* Source code
* Git
* GitHub Actions logs
* Cloudflare KV
* Durable Object storage
* A database
* Test fixtures
* X posts
* X replies
* Error messages
* Request payloads
* API responses
* Frontend code

Never log:

* The private key
* A partial private key
* The raw signed transaction
* Authentication headers
* Environment secrets

The wallet signer must remain inside the private trade-execution layer.

Do not expose a public generic function such as:

sendTransaction(to, data, value)

Expose only a restricted internal function similar to:

executeNadfunBuy({
tokenAddress,
amountInWei,
amountOutMin,
routerAddress,
deadline
})

The signer must reject any destination that is not an explicitly allowlisted official Nad.fun router.

# MONAD CONFIGURATION

This project runs only on Monad mainnet.

Expected environment variables:

MONAD_RPC_URL
MONAD_CHAIN_ID
MONAD_EXPLORER_TX_URL
TRADE_WALLET_PRIVATE_KEY

At runtime:

1. Connect to the configured RPC.
2. Read the actual chain ID.
3. Compare it with MONAD_CHAIN_ID.
4. Fail closed if they do not match.
5. Never allow the chain to be changed through X.

Use Viem’s Monad-compatible chain definition where available.

Do not guess RPC URLs or chain IDs.

Document required values clearly in `.env.example`.

# NAD.FUN CONFIGURATION

Use official Nad.fun contract ABIs and verified deployment addresses.

Expected environment variables:

NADFUN_LENS_ADDRESS
NADFUN_ALLOWED_ROUTER_ADDRESSES

Keep ABI definitions in:

src/blockchain/nadfun/abis/

Keep verified addresses and validation in:

src/blockchain/nadfun/config.ts

Do not guess or invent contract addresses.

Do not use addresses copied from random posts or unverified websites.

Document the exact official source used for:

* Lens ABI
* Bonding-curve router ABI
* Graduated-token or DEX router ABI
* Mainnet contract addresses

# NAD.FUN BUY FLOW

For every valid buy command:

1. Convert requested MON into wei.
2. Verify the token address is valid.
3. Reject the zero address.
4. Retrieve contract bytecode.
5. Reject the address if no contract bytecode exists.
6. Query the official Nad.fun Lens contract.
7. Call the appropriate official quote function, expected conceptually as:

getAmountOut(tokenAddress, amountIn, true)

8. Retrieve:

   * Expected output
   * Correct router
9. Confirm expected output is greater than zero.
10. Confirm the returned router is allowlisted.
11. Check locked or unavailable status when supported by the official Lens.
12. Calculate minimum output using configured slippage.
13. Set the recipient to the dedicated trading wallet.
14. Create a short transaction deadline.
15. Simulate the exact transaction.
16. Estimate gas.
17. Verify wallet balance and reserve.
18. Check the emergency stop again.
19. Sign the transaction.
20. Broadcast it.
21. Persist the hash before waiting for confirmation.
22. Reply with a safe submitted status.
23. Confirm the receipt asynchronously through scheduled processing.

Do not send MON directly to the token contract.

Use the router returned by the official Nad.fun Lens.

Support both:

* Tokens still using the Nad.fun bonding curve
* Nad.fun tokens that graduated to the supported DEX

Do not invent routing rules.

# SLIPPAGE

Use basis points.

Expected environment variable:

DEFAULT_SLIPPAGE_BPS

Default:

300

This means 3%.

Calculate using bigint:

amountOutMin =
expectedAmountOut *
BigInt(10000 - slippageBps) /
10000n

Reject configuration where:

slippageBps < 0
slippageBps > 1000

Do not allow the user to specify slippage through X in the MVP.

Never use floating-point arithmetic for blockchain amounts.

# SPENDING AND SAFETY LIMITS

Expected environment variables:

TRADING_ENABLED
TRADE_DRY_RUN
MAX_MON_PER_TRADE
MAX_MON_PER_DAY
MAX_TRADES_PER_HOUR
DEFAULT_SLIPPAGE_BPS
MAX_PRICE_IMPACT_BPS
TRADE_DEADLINE_SECONDS
MIN_WALLET_RESERVE_MON

Provide these safe example defaults:

TRADING_ENABLED=false
TRADE_DRY_RUN=true
MAX_MON_PER_TRADE=10
MAX_MON_PER_DAY=30
MAX_TRADES_PER_HOUR=3
DEFAULT_SLIPPAGE_BPS=300
MAX_PRICE_IMPACT_BPS=1000
TRADE_DEADLINE_SECONDS=120
MIN_WALLET_RESERVE_MON=1

Trading must be disabled by default.

Dry-run mode must be enabled by default.

When TRADE_DRY_RUN=true:

* Parse the command
* Validate the author
* Validate the contract
* Query Nad.fun
* Calculate expected output
* Calculate minimum output
* Simulate the transaction
* Persist the dry-run result
* Reply with the estimated result
* Never sign
* Never broadcast

TRADE_DRY_RUN=true must override TRADING_ENABLED=true.

# WALLET RESERVE

Before submitting:

1. Read the wallet’s native MON balance.
2. Estimate gas cost.
3. Calculate the post-transaction balance.

Require:

walletBalance >=
tradeAmount +
estimatedGasCost +
minimumWalletReserve

Reject the trade if this condition is not met.

Do not post the wallet’s full balance publicly.

# PRICE IMPACT

Use official Nad.fun contract data where reliable price-impact information is available.

Reject the trade when price impact exceeds:

MAX_PRICE_IMPACT_BPS

Do not invent price-impact calculations.

When reliable calculation is unavailable, document this limitation and rely on:

* Maximum trade size
* Slippage
* Quote validation
* Simulation
* Router allowlist
* Wallet reserve

# IDEMPOTENCY

One X post must never create more than one purchase.

Use the X tweet ID as the primary idempotency key.

Suggested Durable Object record key:

trade:v1:tweet:<tweetId>

Persist a trade record before blockchain submission.

Use these statuses:

RECEIVED
VALIDATING
QUOTED
SIMULATING
DRY_RUN_SUCCESS
DRY_RUN_FAILED
SUBMITTING
SUBMITTED
CONFIRMED
FAILED
REJECTED
UNKNOWN

Suggested type:

type TradeRecord = {
version: 1;
tweetId: string;
authorId: string;
commandTextHash: string;
action: "buy";
requestedAmountMon: string;
requestedAmountWei: string;
tokenAddress: string;
walletAddress: string;
routerAddress?: string;
expectedAmountOut?: string;
minimumAmountOut?: string;
slippageBps?: number;
reservedAmountWei?: string;
status:
| "RECEIVED"
| "VALIDATING"
| "QUOTED"
| "SIMULATING"
| "DRY_RUN_SUCCESS"
| "DRY_RUN_FAILED"
| "SUBMITTING"
| "SUBMITTED"
| "CONFIRMED"
| "FAILED"
| "REJECTED"
| "UNKNOWN";
txHash?: string;
blockNumber?: string;
failureCode?: string;
failureMessageSafe?: string;
createdAt: string;
updatedAt: string;
};

Never resubmit when the status is:

SUBMITTING
SUBMITTED
CONFIRMED
UNKNOWN

If the network times out after transaction submission, do not assume failure.

Mark the record UNKNOWN and investigate using:

* Known transaction hash
* Wallet nonce
* Receipt lookup
* Recent wallet transactions where supported

Never automatically make a replacement purchase for the same tweet.

# CONCURRENCY

Use a Cloudflare Durable Object named:

TradeCoordinator

It must:

* Serialize transactions from the wallet
* Prevent nonce collisions
* Enforce tweet idempotency
* Enforce hourly limits atomically
* Enforce daily limits atomically
* Reserve spending during submission
* Store transaction state
* Prevent two simultaneous broadcasts
* Sanitize results before returning them

Do not use:

* An in-memory mutex
* Cloudflare KV as a lock
* Race-prone read-then-write checks

Only one transaction may enter the signing and submission stage at a time.

# RATE AND SPENDING WINDOWS

Use UTC.

Enforce:

* Maximum MON per trade
* Maximum MON submitted per UTC day
* Maximum number of trades in a rolling hour
* One transaction per tweet
* One wallet transaction at a time

Reserve the requested amount when a trade enters SUBMITTING.

Release the reservation when execution fails before broadcasting.

Do not release a reservation simply because receipt confirmation is delayed.

# X POLLING

Create a scheduled Worker handler that polls X mentions.

Suggested default cron frequency:

Every one minute

The poller must save the latest processed mention cursor or tweet ID.

Do not rely only on timestamps.

Process mentions in oldest-to-newest order.

Do not lose newer mentions when one command fails.

Do not stop the entire batch because one mention is invalid.

Prevent overlapping poll runs where possible.

The poller must:

1. Fetch new mentions.
2. Filter replies or posts based on the required command model.
3. Verify the numeric author ID.
4. Ignore already-seen tweet IDs.
5. Parse the command.
6. Send valid commands to TradeCoordinator.
7. Reply with the sanitized result.
8. Mark the mention as handled.

# X REPLY BEHAVIOR

Dry run:

dry run successful

would spend: 5 MON
estimated tokens: 1,284,392
minimum tokens: 1,245,860
no transaction was submitted

Submitted:

trade submitted

spent: 5 MON
token: 0x978A...7777
minimum tokens: 1,245,860
tx: 0xabc123...

Confirmed:

trade confirmed

spent: 5 MON
received: 1,284,392 TOKEN
token: 0x978A...7777
tx: 0xabc123...

Rejected:

trade rejected

reason: amount exceeds the 10 MON per-trade limit

Failed before broadcast:

trade failed before submission

reason: transaction simulation failed
no transaction was submitted

Unknown:

trade status requires verification

the network response was unclear after submission
the command will not be retried automatically

Requirements:

* Reply to the original post
* Keep replies concise
* Never include private information
* Never include full wallet balance
* Never include stack traces
* Never include RPC URLs
* Never include secrets
* Never claim no funds were spent after a transaction may have been broadcast
* Shorten token addresses for display
* Include an explorer link only from trusted configuration
* Avoid duplicate replies for the same status

# ERROR CODES

Create a typed error-code union containing:

TRADING_DISABLED
DRY_RUN_ENABLED
UNAUTHORIZED_AUTHOR
INVALID_COMMAND
INVALID_AMOUNT
AMOUNT_TOO_SMALL
AMOUNT_TOO_LARGE
INVALID_TOKEN_ADDRESS
TOKEN_NOT_CONTRACT
TOKEN_NOT_SUPPORTED
TOKEN_LOCKED
QUOTE_FAILED
ZERO_OUTPUT
ROUTER_NOT_ALLOWED
SLIPPAGE_INVALID
PRICE_IMPACT_TOO_HIGH
INSUFFICIENT_WALLET_BALANCE
MINIMUM_RESERVE_VIOLATION
HOURLY_LIMIT_EXCEEDED
DAILY_LIMIT_EXCEEDED
DUPLICATE_TWEET
TRADE_ALREADY_IN_PROGRESS
SIMULATION_FAILED
GAS_ESTIMATION_FAILED
CHAIN_ID_MISMATCH
TRANSACTION_REVERTED
SUBMISSION_FAILED
SUBMISSION_UNKNOWN
CONFIRMATION_TIMEOUT
CONFIGURATION_ERROR
INTERNAL_AUTH_FAILED
X_API_ERROR
X_REPLY_FAILED

Separate:

* Technical internal errors
* Safe public messages

# LOGGING

Use structured JSON logs.

Include:

* Request ID
* Tweet ID
* Author ID
* Trade status
* Token address
* Requested amount
* Router
* Transaction hash
* Failure code
* Duration

Never include:

* Private key
* X secrets
* Internal authentication secrets
* Raw signed transaction
* Authorization headers
* Full environment object

Create a central redaction utility.

# REPOSITORY STRUCTURE

Create a clean repository similar to:

monad-x-trade-assistant/
.github/
workflows/
ci.yml
deploy.yml
docs/
ARCHITECTURE.md
COMMAND_SPEC.md
SECURITY.md
DEPLOYMENT.md
RUNBOOK.md
NADFUN_INTEGRATION.md
src/
index.ts
env.ts
worker.ts
routes/
health.ts
x/
client.ts
types.ts
mentions.ts
polling.ts
replies.ts
cursor.ts
commands/
types.ts
parse-buy-command.ts
validate-buy-command.ts
trading/
types.ts
errors.ts
sanitize-error.ts
trade-service.ts
trade-record.ts
limits.ts
idempotency.ts
replies.ts
durable-objects/
trade-coordinator.ts
blockchain/
client.ts
chain.ts
wallet.ts
balances.ts
gas.ts
receipts.ts
nadfun/
config.ts
lens.ts
quote.ts
build-buy.ts
simulate-buy.ts
execute-buy.ts
abis/
lens.ts
bonding-curve-router.ts
dex-router.ts
utils/
hash.ts
bigint.ts
address.ts
time.ts
logging.ts
redaction.ts
tests/
parser.test.ts
authorization.test.ts
limits.test.ts
idempotency.test.ts
concurrency.test.ts
quote.test.ts
simulation.test.ts
execution.test.ts
dry-run.test.ts
redaction.test.ts
.dev.vars.example
.env.example
.gitignore
eslint.config.js
prettier.config.js
package.json
tsconfig.json
vitest.config.ts
wrangler.toml
README.md

Adjust where necessary, but keep responsibilities separated.

# CONFIGURATION VALIDATION

Use Zod to validate all environment variables.

Fail closed when required configuration is missing.

Production startup must reject:

* Invalid private-key format
* Invalid X user IDs
* Invalid contract addresses
* Empty router allowlist
* Invalid chain ID
* Invalid numeric limits
* Slippage above the hard maximum
* Negative values
* Trading enabled without a private key
* Real trading enabled while required Nad.fun addresses are missing

Do not expose secret values in validation errors.

# HEALTH ROUTE

Create:

GET /health

It may return:

{
"ok": true,
"service": "monad-x-trade-assistant",
"tradingEnabled": false,
"dryRun": true
}

Do not expose:

* Wallet address unless deliberately configured as public
* Wallet balance
* Contract addresses
* RPC URL
* X account IDs
* Secrets

# TESTING

Use Vitest.

Add unit tests for the parser.

Must accept:

@monexmonad buy 100 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad buy 100mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad BUY 0.5 MON OF 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

Must reject:

@monexmonad buy all mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad buy -10 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad buy 0 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad buy 10 usd of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

@monexmonad buy 10 mon of invalid

@monexmonad buy 10 mon of 0x0000000000000000000000000000000000000000

@monexmonad buy 10 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777 then sell

@monexmonad sell 10 mon of 0x978Ae7298D48Cf0f8d1fdB26abC12bfACFcC7777

Also test:

* Wrong X author ID
* Duplicate tweet
* Trading disabled
* Dry-run override
* Per-trade limit
* Hourly limit
* Daily limit
* Invalid token address
* No contract bytecode
* Lens quote failure
* Zero output
* Router not allowlisted
* Locked token
* Insufficient wallet balance
* Minimum reserve violation
* Simulation failure
* Successful simulation
* Successful submission
* Transaction revert
* Unknown submission result
* Duplicate event while submitting
* Concurrent commands
* Nonce serialization
* Bigint slippage calculation
* Chain ID mismatch
* Error sanitization
* Secret redaction
* X reply deduplication
* Mention cursor persistence
* One failed mention not blocking the next mention

Mock all network services in automated tests.

Never use a real funded wallet in CI.

Never execute a real Monad transaction in CI.

# GITHUB ACTIONS

Create:

.github/workflows/ci.yml

Run on pull requests and pushes to main:

* npm ci
* npm run format:check
* npm run lint
* npm run typecheck
* npm test
* npm run build

Create:

.github/workflows/deploy.yml

Requirements:

* Manual workflow dispatch initially
* Deploy through Wrangler
* Use GitHub environment secrets
* Do not print Cloudflare or application secrets
* Production deployment must not automatically enable trading
* Document all required GitHub secrets

# PACKAGE SCRIPTS

Create scripts similar to:

npm run dev
npm run build
npm run test
npm run test:watch
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
npm run deploy
npm run tail

# DOCUMENTATION

Create a useful README.md with:

* Project summary
* Warning that this controls a funded hot wallet
* Dedicated-wallet requirement
* Architecture
* Command format
* Local setup
* Environment setup
* Dry-run setup
* Test commands
* Cloudflare setup
* Deployment
* How to enable trading
* How to stop trading
* Current limitations

Create docs/ARCHITECTURE.md with:

* Full system diagram
* Worker responsibilities
* Durable Object responsibilities
* Blockchain execution flow
* Data flow
* Trust boundaries

Create docs/SECURITY.md with:

* Threat model
* X account compromise
* Private-key compromise
* RPC compromise
* Duplicate X delivery
* Replay attacks
* Nonce collisions
* Malicious token contracts
* Router allowlisting
* Logging restrictions
* Wallet-funding recommendations
* Incident response

Create docs/RUNBOOK.md with:

1. Create a dedicated wallet.
2. Configure Cloudflare secrets.
3. Configure X API credentials.
4. Configure Monad RPC.
5. Configure verified Nad.fun contracts.
6. Run in dry-run mode.
7. Validate quotes.
8. Enable simulation-only mode.
9. Fund the wallet with a small amount.
10. Enable low-limit live trading.
11. Disable trading immediately.
12. Investigate failed trades.
13. Investigate UNKNOWN trades.
14. Check whether a tweet already executed.
15. Rotate the wallet private key.
16. Rotate X credentials.
17. Update router allowlists.
18. Deploy through GitHub Actions.
19. Roll back a deployment.

# IMPLEMENTATION PHASES

Implement the repository so that it supports phased rollout.

Phase 1:

* Project scaffolding
* Environment validation
* Parser
* X author authorization
* X polling abstraction
* Durable Object storage
* Idempotency
* Mock quote provider
* Dry-run responses
* Tests

Phase 2:

* Real Monad RPC client
* Official Nad.fun Lens integration
* Contract bytecode validation
* Router allowlist
* Real quote generation
* Real simulation
* No signing or broadcasting by default

Phase 3:

* Restricted signer
* Dedicated test wallet
* Live transaction submission
* Very low spending limit
* Transaction receipt confirmation

Phase 4:

* Production deployment
* Monitoring
* Emergency stop
* Key-rotation procedure
* Operational runbook

# MVP ACCEPTANCE CRITERIA

The MVP is complete when:

1. The repository is fully standalone.
2. It does not import or depend on the MonEx game repository.
3. Only the configured numeric X user ID may trade.
4. Both “100 mon” and “100mon” work.
5. The parser rejects anything outside the strict grammar.
6. Blockchain amounts use bigint.
7. The wallet private key exists only in backend secrets.
8. The signer only interacts with approved Nad.fun routers.
9. One tweet can never produce two purchases.
10. Transactions are serialized through a Durable Object.
11. Per-trade, hourly, and daily limits are atomic.
12. Dry-run mode never broadcasts.
13. Trading is disabled by default.
14. The token contract is validated before execution.
15. The official Nad.fun Lens determines the router and expected output.
16. The router must be allowlisted.
17. The transaction is simulated before signing.
18. Wallet reserve is enforced.
19. Unknown submission results are never automatically retried.
20. X replies contain only safe information.
21. Tests, linting, formatting, type checking, and build pass.
22. GitHub Actions workflows are included.
23. Cloudflare deployment documentation is complete.
24. Existing MonEx game code is not required or modified.

# OUT OF SCOPE

Do not implement:

* A frontend
* User accounts
* Multiple users
* Multiple wallets
* Wallet import UI
* Selling
* Transfers
* Approvals
* Bridging
* Limit orders
* Stop losses
* AI command interpretation
* Token recommendations
* Automatic token discovery
* Portfolio tracking
* Public access
* Subscription billing
* Mobile application
* Telegram or Discord support
* Arbitrary smart-contract calls

# FINAL RESPONSE AFTER IMPLEMENTATION

When finished, report:

1. Final architecture
2. Complete file tree
3. Files created
4. Environment variables required
5. Cloudflare resources required
6. Durable Object bindings
7. Cron trigger configuration
8. Official Nad.fun contracts and ABIs used
9. Security controls
10. Tests created
11. Test results
12. Type-check results
13. Lint results
14. Build results
15. Local setup commands
16. Cloudflare setup commands
17. GitHub secrets required
18. Deployment commands
19. Manual steps I must complete
20. Features intentionally left out
21. Remaining risks

Begin by scaffolding the standalone repository and implementing Phase 1.

Do not enable real transaction broadcasting yet.

Use mock blockchain services where necessary until the foundation, parser, idempotency, authorization, concurrency, and dry-run behavior are complete and tested.
