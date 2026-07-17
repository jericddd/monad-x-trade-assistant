import { formatUnits, getAddress, type Hex } from "viem";
import type { Env } from "../worker.js";
import { createPublicBlockchainClient } from "../blockchain/client.js";
import { parseEnvLenient } from "../env.js";
import type { TradeRecord } from "../trading/trade-record.js";
import { assertSiteSecret, listTransfersViaRegistry } from "./api-users.js";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

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
};

export type PortfolioActivity = {
  id: string;
  kind: "trade" | "transfer";
  /** buy | sell | add_funds | cash_out */
  side: "buy" | "sell" | "add_funds" | "cash_out";
  /** x = X mention, app = site/app */
  source: "x" | "app";
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  /** Address shown in the CA column */
  walletAddress?: string;
  /** hot = browser wallet, in_app = trading wallet */
  walletKind?: "hot" | "in_app";
  amountMon: string;
  status: string;
  txHash?: string;
  createdAt: string;
  /** @deprecated prefer id; kept for older clients */
  tweetId?: string;
};

function coordinatorStub(env: Env): DurableObjectStub {
  return env.TRADE_COORDINATOR.get(env.TRADE_COORDINATOR.idFromName("primary"));
}

export async function handlePortfolioApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/users\/(\d+)\/portfolio$/);
  if (!match || request.method !== "GET") {
    return null;
  }

  if (!assertSiteSecret(request, env)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const xUserId = match[1]!;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50), 50);
  const stub = coordinatorStub(env);
  const res = await stub.fetch(
    `https://coordinator/list-by-author?authorId=${encodeURIComponent(xUserId)}&limit=200`,
  );
  const body = (await res.json()) as { trades?: TradeRecord[] };
  const trades = body.trades ?? [];
  const transfers = await listTransfersViaRegistry(env, xUserId, 200);

  // Holdings only from real buys (dry-run never received tokens on-chain).
  const successStatuses = new Set(["CONFIRMED", "SUBMITTED"]);
  const byToken = new Map<
    string,
    {
      buys: number;
      spentMon: number;
      last: TradeRecord;
    }
  >();

  for (const trade of trades) {
    if (!successStatuses.has(trade.status)) continue;
    const key = trade.tokenAddress.toLowerCase();
    const prev = byToken.get(key);
    const isSell = trade.action === "sell";
    const spent = isSell ? 0 : Number(trade.requestedAmountMon) || 0;
    if (!prev) {
      byToken.set(key, {
        buys: isSell ? 0 : 1,
        spentMon: spent,
        last: trade,
      });
    } else {
      if (!isSell) {
        prev.buys += 1;
        prev.spentMon += spent;
      }
      if (trade.createdAt > prev.last.createdAt) prev.last = trade;
    }
  }

  const walletAddress = trades.find((t) => t.walletAddress)?.walletAddress;
  const holdings: PortfolioHolding[] = [];

  if (byToken.size > 0 && walletAddress) {
    try {
      const publicClient = createPublicBlockchainClient(
        parseEnvLenient(env as unknown as Record<string, unknown>),
      );
      for (const [token, agg] of byToken) {
        const tokenAddress = getAddress(token) as `0x${string}`;
        let symbol = shortSymbol(tokenAddress);
        let decimals = 18;
        let balance = "0";
        try {
          const [bal, dec, sym] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [walletAddress as Hex],
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "decimals",
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "symbol",
            }),
          ]);
          decimals = Number(dec);
          symbol = String(sym);
          balance = formatUnits(bal as bigint, decimals);
        } catch {
          // Token metadata/balance is best-effort.
        }
        holdings.push({
          tokenAddress,
          symbol,
          decimals,
          balance,
          buys: agg.buys,
          spentMon: agg.spentMon.toFixed(4).replace(/\.?0+$/, ""),
          lastStatus: agg.last.status,
          lastTxHash: agg.last.txHash,
          lastAt: agg.last.createdAt,
        });
      }
    } catch {
      for (const [token, agg] of byToken) {
        const tokenAddress = getAddress(token) as `0x${string}`;
        holdings.push({
          tokenAddress,
          symbol: shortSymbol(tokenAddress),
          decimals: 18,
          balance: "0",
          buys: agg.buys,
          spentMon: agg.spentMon.toFixed(4).replace(/\.?0+$/, ""),
          lastStatus: agg.last.status,
          lastTxHash: agg.last.txHash,
          lastAt: agg.last.createdAt,
        });
      }
    }
  }

  holdings.sort((a, b) => (a.lastAt && b.lastAt && a.lastAt < b.lastAt ? 1 : -1));

  const metaCache = new Map<string, { name: string; symbol: string }>();
  try {
    const publicClient = createPublicBlockchainClient(
      parseEnvLenient(env as unknown as Record<string, unknown>),
    );
    const uniqueTokens = [...new Set(trades.slice(0, 20).map((t) => t.tokenAddress.toLowerCase()))];
    await Promise.all(
      uniqueTokens.map(async (token) => {
        const tokenAddress = getAddress(token) as `0x${string}`;
        try {
          const [name, symbol] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "name",
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "symbol",
            }),
          ]);
          metaCache.set(token, { name: String(name), symbol: String(symbol) });
        } catch {
          metaCache.set(token, {
            name: shortSymbol(tokenAddress),
            symbol: shortSymbol(tokenAddress),
          });
        }
      }),
    );
  } catch {
    // Metadata is best-effort.
  }

  const tradeActivities: PortfolioActivity[] = trades.map((t) => {
    const meta = metaCache.get(t.tokenAddress.toLowerCase());
    return {
      id: t.tweetId,
      kind: "trade",
      tweetId: t.tweetId,
      side: t.action === "sell" ? "sell" : "buy",
      source: t.source === "app" ? "app" : "x",
      tokenAddress: t.tokenAddress,
      tokenName: meta?.name ?? shortSymbol(t.tokenAddress),
      tokenSymbol: meta?.symbol ?? shortSymbol(t.tokenAddress),
      amountMon: t.requestedAmountMon,
      status: t.status,
      txHash: t.txHash,
      createdAt: t.createdAt,
    };
  });

  const transferActivities: PortfolioActivity[] = transfers.map((t) => {
    const isDeposit = t.type === "deposit";
    return {
      id: t.id,
      kind: "transfer",
      side: isDeposit ? "add_funds" : "cash_out",
      source: "app",
      // Destination wallet of the transfer, labeled hot vs in-app.
      walletAddress: isDeposit ? t.inSiteWallet : t.hotWallet,
      walletKind: isDeposit ? "in_app" : "hot",
      tokenName: "MON",
      tokenSymbol: "MON",
      amountMon: t.amountMon,
      status: t.status,
      txHash: t.txHash,
      createdAt: t.createdAt,
    };
  });

  const allRecent = [...tradeActivities, ...transferActivities].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  const total = allRecent.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const recent = allRecent.slice(start, start + limit);

  return Response.json({
    holdings,
    recent,
    walletAddress: walletAddress ?? null,
    page: safePage,
    limit,
    total,
    totalPages,
    hasMore: safePage < totalPages,
    hasPrev: safePage > 1,
  });
}

function shortSymbol(address: string): string {
  return `TOK-${address.slice(2, 6).toUpperCase()}`;
}
