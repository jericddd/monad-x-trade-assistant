export const PRODUCT_ERRORS = {
  PENDING_CARD:
    "You already have a pending card. Claim it or wait for it to expire before opening another pack.",
  X_COOLDOWN:
    "You can open another pack on X when your 24-hour cooldown ends. You can still visit the site to explore available packs.",
  EXPIRED: "This card expired and can no longer be claimed.",
  NO_FEATURED_PACK: "There is no featured X pack available right now.",
  SOLD_OUT: "This pack currently has no available cards.",
  CLAIM_FAILURE:
    "Your card is still reserved. The claim could not be completed, so please try again.",
  AUTH_REQUIRED: "Please log in with X to continue.",
  WALLET_REQUIRED: "Please connect and verify your wallet to claim.",
  WRONG_NETWORK: "Please switch to Monad Mainnet to claim your card.",
  NETWORK_REJECTED: "Network switch was rejected. Please switch to Monad Mainnet to claim.",
  NO_PACKS: "No packs are available right now.",
  NO_ACTIVITY: "No packs have been opened yet.",
  NO_CLAIMED: "Your claimed collection will appear here.",
  NO_EXPIRED: "You have no expired cards.",
  NO_PENDING: "You do not have a pending card.",
} as const;

export class ProductError extends Error {
  constructor(
    message: string,
    public code: keyof typeof PRODUCT_ERRORS | string,
    public status = 400,
  ) {
    super(message);
    this.name = "ProductError";
  }
}
