import { formatUnits, getAddress, type Hex } from "viem";
import type { Env } from "../worker.js";
import { createPublicBlockchainClient } from "../blockchain/client.js";
import { parseEnvLenient } from "../env.js";
import type { TradeRecord } from "../trading/trade-record.js";
import { assertSiteSecret } from "./api-users.js";

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

export type PortfolioTrade = {
  tweetId: string;
  tokenAddress: string;
  amountMon: string;
  status: string;
  txHash?: string;
  createdAt: string;
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
  const stub = coordinatorStub(env);
  const res = await stub.fetch(
    `https://coordinator/list-by-author?authorId=${encodeURIComponent(xUserId)}&limit=50`,
  );
  const body = (await res.json()) as { trades?: TradeRecord[] };
  const trades = body.trades ?? [];

  const successStatuses = new Set(["CONFIRMED", "SUBMITTED", "DRY_RUN_SUCCESS"]);
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
    const spent = Number(trade.requestedAmountMon) || 0;
    if (!prev) {
      byToken.set(key, { buys: 1, spentMon: spent, last: trade });
    } else {
      prev.buys += 1;
      prev.spentMon += spent;
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

  const recent: PortfolioTrade[] = trades.slice(0, 20).map((t) => ({
    tweetId: t.tweetId,
    tokenAddress: t.tokenAddress,
    amountMon: t.requestedAmountMon,
    status: t.status,
    txHash: t.txHash,
    createdAt: t.createdAt,
  }));

  return Response.json({
    holdings,
    recent,
    walletAddress: walletAddress ?? null,
  });
}

function shortSymbol(address: string): string {
  return `TOK-${address.slice(2, 6).toUpperCase()}`;
}
