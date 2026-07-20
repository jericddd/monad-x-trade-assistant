import type { Hex } from "viem";

const TRADE_WORKER_URL =
  process.env.TRADE_WORKER_URL ?? "https://monad-x-trade-assistant.0xjericd.workers.dev";

export type TradeAccount = {
  xUserId: string;
  xUsername: string;
  connectedWallet: `0x${string}`;
  inSiteWallet: `0x${string}`;
  walletVersion?: number;
  privateKeyExportedAt?: string | null;
  keyExportAvailable?: boolean;
  linkedAt: string;
  updatedAt: string;
};

export type TradeAccountResponse = {
  user: TradeAccount | null;
  balances?: {
    inSiteMon: string;
    connectedMon: string | null;
  };
};

function siteSecret(): string {
  const secret = process.env.TRADE_SITE_API_SECRET ?? process.env.SITE_API_SECRET;
  if (!secret) {
    throw new Error("TRADE_SITE_API_SECRET is not configured");
  }
  return secret;
}

async function tradeFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${TRADE_WORKER_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-site-secret": siteSecret(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function linkTradeUser(input: {
  xUserId: string;
  xUsername: string;
  connectedWallet: string;
}): Promise<TradeAccount> {
  const res = await tradeFetch("/api/v1/users/link", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { user?: TradeAccount; error?: string };
  if (!res.ok || !data.user) {
    throw new Error(data.error ?? "Failed to link trade account");
  }
  return data.user;
}

export async function getTradeAccount(xUserId: string): Promise<TradeAccountResponse> {
  const res = await tradeFetch(`/api/v1/users/${encodeURIComponent(xUserId)}`);
  if (!res.ok) {
    throw new Error("Failed to load trade account");
  }
  return (await res.json()) as TradeAccountResponse;
}

export type PortfolioHolding = {
  tokenAddress: `0x${string}`;
  symbol: string;
  decimals: number;
  balance: string;
  buys: number;
  spentMon: string;
  lastStatus: string;
  lastTxHash?: string;
  lastAt?: string;
  venue?: "nadfun" | "flap" | "uniswap";
  venueLabel?: string;
};

export type PortfolioTrade = {
  id?: string;
  kind?: "trade" | "transfer";
  tweetId?: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  amountMon: string;
  status: string;
  txHash?: string;
  walletAddress?: string;
  walletKind?: "hot" | "in_app";
  createdAt: string;
  side?: "buy" | "sell" | "add_funds" | "cash_out";
  source?: "x" | "app";
};

export type PortfolioResponse = {
  holdings: PortfolioHolding[];
  recent: PortfolioTrade[];
  walletAddress: string | null;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
  hasPrev?: boolean;
};

export async function getTradePortfolio(
  xUserId: string,
  opts?: { page?: number; limit?: number },
): Promise<PortfolioResponse> {
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 50;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await tradeFetch(
    `/api/v1/users/${encodeURIComponent(xUserId)}/portfolio?${qs.toString()}`,
  );
  if (!res.ok) {
    throw new Error("Failed to load portfolio");
  }
  return (await res.json()) as PortfolioResponse;
}

export async function withdrawFromInSite(input: {
  xUserId: string;
  amountMon: string;
  toAddress?: string;
}): Promise<{ ok: true; txHash: Hex; amountMon: string }> {
  const res = await tradeFetch("/api/v1/users/withdraw", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    txHash?: Hex;
    amountMon?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.txHash) {
    throw new Error(data.error ?? "Withdraw failed");
  }
  return { ok: true, txHash: data.txHash, amountMon: data.amountMon ?? input.amountMon };
}

export async function exportInSitePrivateKey(xUserId: string): Promise<{
  privateKey: Hex;
  address: `0x${string}`;
  walletVersion: number;
  exportedAt: string;
  user: TradeAccount;
}> {
  const res = await tradeFetch("/api/v1/users/export-key", {
    method: "POST",
    body: JSON.stringify({ xUserId }),
  });
  const data = (await res.json()) as {
    privateKey?: Hex;
    address?: `0x${string}`;
    walletVersion?: number;
    exportedAt?: string;
    user?: TradeAccount;
    error?: string;
  };
  if (!res.ok || !data.privateKey || !data.address || !data.user) {
    throw new Error(data.error ?? "Export failed");
  }
  return {
    privateKey: data.privateKey,
    address: data.address,
    walletVersion: data.walletVersion ?? 0,
    exportedAt: data.exportedAt ?? new Date().toISOString(),
    user: data.user,
  };
}

export async function recordTradeTransfer(input: {
  xUserId: string;
  type: "deposit";
  amountMon: string;
  txHash: string;
  fromAddress?: string;
  toAddress?: string;
}): Promise<{ ok: true }> {
  const res = await tradeFetch("/api/v1/users/transfers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to record transfer");
  }
  return { ok: true };
}

export async function renewInSiteWallet(xUserId: string): Promise<{
  user: TradeAccount;
  previousInSiteWallet: `0x${string}`;
  warning: string;
}> {
  const res = await tradeFetch("/api/v1/users/renew-wallet", {
    method: "POST",
    body: JSON.stringify({ xUserId, confirmRenew: true }),
  });
  const data = (await res.json()) as {
    user?: TradeAccount;
    previousInSiteWallet?: `0x${string}`;
    warning?: string;
    error?: string;
  };
  if (!res.ok || !data.user || !data.previousInSiteWallet) {
    throw new Error(data.error ?? "Renew failed");
  }
  return {
    user: data.user,
    previousInSiteWallet: data.previousInSiteWallet,
    warning: data.warning ?? "Move all funds before renewing.",
  };
}

export type AppTradeResponse = {
  ok: boolean;
  status: string;
  dryRun?: boolean;
  txHash: Hex | null;
  tradeId: string;
  action: "buy" | "sell";
  source: "app";
  amountMon: string;
  tokenAddress: string;
  tokenSymbol?: string | null;
  expectedAmountOut?: string | null;
  error?: string | null;
  message?: string;
};

export async function executeAppTrade(input: {
  xUserId: string;
  action: "buy" | "sell";
  tokenAddress: string;
  amountMon?: string;
  percent?: number;
  amountToken?: string;
}): Promise<AppTradeResponse> {
  const res = await tradeFetch("/api/v1/users/trade", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as AppTradeResponse & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? "Trade failed");
  }
  return data;
}
