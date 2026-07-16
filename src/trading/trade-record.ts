export type TradeStatus =
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

export type TradeRecord = {
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
  status: TradeStatus;
  txHash?: string;
  blockNumber?: string;
  failureCode?: string;
  failureMessageSafe?: string;
  lastReplyStatus?: TradeStatus;
  createdAt: string;
  updatedAt: string;
};

export const NON_RETRYABLE_STATUSES: ReadonlySet<TradeStatus> = new Set([
  "SUBMITTING",
  "SUBMITTED",
  "CONFIRMED",
  "UNKNOWN",
]);

export function tradeRecordKey(tweetId: string): string {
  return `trade:v1:tweet:${tweetId}`;
}

export function createTradeRecord(input: {
  tweetId: string;
  authorId: string;
  commandTextHash: string;
  requestedAmountMon: string;
  requestedAmountWei: string;
  tokenAddress: string;
  walletAddress: string;
}): TradeRecord {
  const now = new Date().toISOString();
  return {
    version: 1,
    tweetId: input.tweetId,
    authorId: input.authorId,
    commandTextHash: input.commandTextHash,
    action: "buy",
    requestedAmountMon: input.requestedAmountMon,
    requestedAmountWei: input.requestedAmountWei,
    tokenAddress: input.tokenAddress,
    walletAddress: input.walletAddress,
    status: "RECEIVED",
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTradeRecord(record: TradeRecord, patch: Partial<TradeRecord>): TradeRecord {
  return {
    ...record,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}
