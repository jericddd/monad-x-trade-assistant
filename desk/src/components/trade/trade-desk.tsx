"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useSignMessage,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { createPublicClient, formatEther, http, parseEther } from "viem";
import {
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getNadFunTokenUrl,
  getVenueTokenUrl,
  monadMainnet,
  type TokenVenue,
} from "@/lib/monad-chain";

const publicBalanceClient = createPublicClient({
  chain: monadMainnet,
  transport: http(monadMainnet.rpcUrls.default.http[0]),
});

type TradeAccountPayload = {
  linked: boolean;
  needsWallet: boolean;
  connectedWallet?: string;
  account: {
    inSiteWallet: `0x${string}`;
    connectedWallet: `0x${string}`;
    xUsername: string;
    walletVersion?: number;
    privateKeyExportedAt?: string | null;
    keyExportAvailable?: boolean;
  } | null;
  balances?: {
    inSiteMon: string;
    connectedMon: string | null;
  };
  error?: string;
};

type KeyModal =
  | { kind: "export"; privateKey: string; address: string }
  | { kind: "renew-confirm" }
  | null;

type TradeModal = {
  action: "buy" | "sell";
  tokenAddress: `0x${string}`;
  symbol: string;
  balance: string;
};

type TradeSuccessModal = {
  action: "buy" | "sell";
  symbol: string;
  /** Primary amount shown under Bought/Sold (MON spent or sell %). */
  amountLabel: string;
  /** Optional secondary line (e.g. estimated MON received on sell). */
  detailLabel?: string;
  dryRun?: boolean;
  txUrl?: string | null;
};

type PortfolioHolding = {
  tokenAddress: `0x${string}`;
  symbol: string;
  balance: string;
  buys: number;
  spentMon: string;
  lastStatus: string;
  lastTxHash?: string;
  lastAt?: string;
  venue?: TokenVenue;
  venueLabel?: string;
};

type PortfolioTrade = {
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

function XMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

function MonadMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/monad-logo.png"
      alt=""
      className={`inline-block shrink-0 rounded-full object-cover ${className}`}
    />
  );
}

function TokenLogo({
  address,
  symbol,
}: {
  address: string;
  symbol: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = `https://dd.dexscreener.com/ds-data/tokens/monad/${address.toLowerCase()}.png`;
  if (failed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mx-surface-2 text-[10px] font-bold text-mx-accent">
        {(symbol || "?").slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-8 w-8 shrink-0 rounded-full bg-mx-surface-2 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

const VENUE_META: Record<
  TokenVenue,
  { label: string; src: string; fallback: string }
> = {
  nadfun: { label: "Nad.fun", src: "/brand/nadfun-logo.png", fallback: "N" },
  flap: { label: "Flap.sh", src: "/brand/flap-logo.png", fallback: "F" },
  uniswap: { label: "Uniswap", src: "/brand/uniswap-logo.png", fallback: "U" },
};

/** Small deployer badge after ticker — hover shows "Deployed from …". */
function VenueBadge({ venue, label }: { venue?: TokenVenue | null; label?: string }) {
  const [failed, setFailed] = useState(false);
  if (!venue) return null;
  const meta = VENUE_META[venue];
  const appName = label ?? meta.label;
  const title = `Deployed from ${appName}`;

  return (
    <span className="group/venue relative inline-flex shrink-0" aria-label={title}>
      {failed ? (
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-mx-surface text-[8px] font-bold text-mx-muted ring-1 ring-mx-border">
          {meta.fallback}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.src}
          alt=""
          className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-mx-border/80"
          onError={() => setFailed(true)}
        />
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-mx-border bg-[#0a1613] px-2 py-1 text-[10px] font-semibold text-[#e8fff6] opacity-0 shadow-lg transition-opacity duration-150 group-hover/venue:opacity-100"
      >
        {title}
      </span>
    </span>
  );
}

function statusTone(status: string): string {
  if (/^CONFIRMED$|^success$/i.test(status)) return "text-emerald-300";
  if (/SUBMITTED|SUBMITTING|PENDING/i.test(status)) return "text-mx-accent";
  if (/DRY_RUN/i.test(status)) return "text-mx-muted";
  if (/FAIL|REJECT/i.test(status)) return "text-red-300";
  if (/UNKNOWN/i.test(status)) return "text-mx-accent";
  return "text-mx-muted";
}

/** User-facing Activity status — never label dry-run as on-chain success. */
function formatActivityStatus(status: string): string {
  if (/^CONFIRMED$/i.test(status)) return "success";
  if (/^SUBMITTED$/i.test(status)) return "submitted";
  if (/DRY_RUN_SUCCESS/i.test(status)) return "dry run";
  if (/FAIL/i.test(status)) return "failed";
  if (/REJECT/i.test(status)) return "rejected";
  if (/UNKNOWN/i.test(status)) return "unknown";
  return status.replace(/_/g, " ").toLowerCase();
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatMon(value: string | null | undefined): string {
  if (value == null || value === "") return "0";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Activity timestamp: date + HH:MM:SS (local). */
function formatActivityWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

function hasPositiveBalance(value: string | null | undefined): boolean {
  const n = Number(value);
  // Ignore dust left after 100% sells / rounding.
  return Number.isFinite(n) && n > 1e-8;
}

/** Leave 1 MON for gas when using Max on add funds / cash out / buy. */
const GAS_RESERVE_MON = 1;

function maxSpendableMon(
  balance: string | null | undefined,
  reserve = GAS_RESERVE_MON,
): string {
  const raw = Number(balance ?? "0");
  if (!Number.isFinite(raw) || raw <= reserve) return "0";
  return String(Number((raw - reserve).toFixed(6)));
}

export function TradeDesk() {
  const { user, loading: authLoading, logout } = useAuth();
  const { address, isConnected, chainId } = useAccount();
  const { isPending: connecting } = useConnect();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  const { sendTransactionAsync, data: depositHash, isPending: depositing } = useSendTransaction();
  const depositReceipt = useWaitForTransactionReceipt({ hash: depositHash });

  const [account, setAccount] = useState<TradeAccountPayload | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [direction, setDirection] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("1");
  const [status, setStatus] = useState<string | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoLinkAttempted, setAutoLinkAttempted] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [recentTrades, setRecentTrades] = useState<PortfolioTrade[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityHasPrev, setActivityHasPrev] = useState(false);
  const [keyModal, setKeyModal] = useState<KeyModal>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [tradeModal, setTradeModal] = useState<TradeModal | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<TradeSuccessModal | null>(null);
  const [tradeAmount, setTradeAmount] = useState("1");
  const [sellPercent, setSellPercent] = useState(100);
  const [tradeBusy, setTradeBusy] = useState(false);
  /** On-chain MON for the linked hot wallet — works even when browser wallet is disconnected. */
  const [hotWalletMon, setHotWalletMon] = useState<string | null>(null);
  const pendingDepositRef = useRef<{ amountMon: string; txHash: `0x${string}` } | null>(null);
  const recordedDepositsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const detail = params.get("detail");
    if (!error) return;
    const messages: Record<string, string> = {
      auth_failed: "X login failed — try again.",
      auth_state_mismatch: "Login expired. Tap Continue with X again.",
      missing_verifier: "Cookies were blocked. Allow cookies and try again.",
      missing_code: "X didn’t finish login. Try again.",
      token_failed: "X login rejected. The app secret may need updating.",
      invalid_client: "X app secret is wrong on the server.",
      invalid_grant: "Login code expired. Try Continue with X once more.",
      unauthorized_client: "X app credentials need updating (client secret).",
      user_failed: "Couldn’t load your X profile. Try Continue with X again.",
      oauth_not_configured: "X login isn’t configured yet.",
      callback_error: "Server error during login. Try again shortly.",
    };
    const base = messages[error] ?? `Login error: ${error}`;
    setStatus(detail ? `${base} (${detail})` : base);
    window.history.replaceState({}, "", "/");
  }, []);

  const refreshAccount = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setAccount(null);
      setAccountReady(false);
      setHoldings([]);
      setRecentTrades([]);
      return;
    }
    if (!opts?.silent) setLoadingAccount(true);
    try {
      const res = await fetch("/api/trade/account");
      const data = (await res.json()) as TradeAccountPayload;
      if (!res.ok) {
        // Keep last-known state on silent poll failures so the desk doesn't flicker.
        if (!opts?.silent) {
          setStatus(data.error ?? "Could not load account");
          setAccount(null);
        }
        return;
      }
      setAccount(data);
    } catch {
      if (!opts?.silent) setStatus("Could not load account");
    } finally {
      if (!opts?.silent) setLoadingAccount(false);
      setAccountReady(true);
    }
  }, [user]);

  const refreshPortfolio = useCallback(
    async (page = activityPage, opts?: { silent?: boolean }) => {
      if (!user) {
        setHoldings([]);
        setRecentTrades([]);
        setActivityTotal(0);
        setActivityTotalPages(1);
        setActivityHasMore(false);
        setActivityHasPrev(false);
        return;
      }
      if (!opts?.silent) setLoadingPortfolio(true);
      try {
        const qs = new URLSearchParams({ page: String(page), limit: "50" });
        const res = await fetch(`/api/trade/portfolio?${qs.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          holdings?: PortfolioHolding[];
          recent?: PortfolioTrade[];
          page?: number;
          total?: number;
          totalPages?: number;
          hasMore?: boolean;
          hasPrev?: boolean;
        };
        setHoldings(data.holdings ?? []);
        setRecentTrades(data.recent ?? []);
        setActivityPage(data.page ?? page);
        setActivityTotal(data.total ?? data.recent?.length ?? 0);
        setActivityTotalPages(data.totalPages ?? 1);
        setActivityHasMore(Boolean(data.hasMore));
        setActivityHasPrev(Boolean(data.hasPrev));
      } catch {
        // Portfolio is best-effort.
      } finally {
        if (!opts?.silent) setLoadingPortfolio(false);
      }
    },
    [user, activityPage],
  );

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  useEffect(() => {
    if (account?.linked) void refreshPortfolio(activityPage);
  }, [account?.linked, activityPage, refreshPortfolio]);

  // Always read the linked browser-wallet balance from chain (not wagmi).
  // After setup, users often disconnect — balance must still show for "Your wallet".
  useEffect(() => {
    const addr = account?.account?.connectedWallet;
    if (!account?.linked || !addr) {
      setHotWalletMon(null);
      return;
    }

    let cancelled = false;
    const refreshHotBalance = async () => {
      try {
        const bal = await publicBalanceClient.getBalance({
          address: addr as `0x${string}`,
        });
        if (!cancelled) setHotWalletMon(formatEther(bal));
      } catch {
        // Fall back to API balance via yourBal below.
      }
    };

    void refreshHotBalance();
    const id = window.setInterval(refreshHotBalance, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshHotBalance();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [account?.linked, account?.account?.connectedWallet]);

  // Live updates for demo UX — poll quietly + refresh when tab is focused.
  useEffect(() => {
    if (!account?.linked) return;

    const tick = () => {
      void refreshAccount({ silent: true });
      void refreshPortfolio(activityPage, { silent: true });
    };

    const id = window.setInterval(tick, 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [account?.linked, activityPage, refreshAccount, refreshPortfolio]);

  useEffect(() => {
    if (!depositReceipt.isSuccess || !depositHash) return;
    setStatus("Deposit confirmed — you’re ready to buy on X");
    setTxUrl(getExplorerTxUrl(depositHash));

    const pending = pendingDepositRef.current;
    const amountMon =
      pending?.txHash?.toLowerCase() === depositHash.toLowerCase()
        ? pending.amountMon
        : null;

    void (async () => {
      if (amountMon && !recordedDepositsRef.current.has(depositHash.toLowerCase())) {
        recordedDepositsRef.current.add(depositHash.toLowerCase());
        try {
          await fetch("/api/trade/transfer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "deposit",
              amountMon,
              txHash: depositHash,
            }),
          });
        } catch {
          // History is best-effort.
        }
        pendingDepositRef.current = null;
      }
      await refreshAccount();
      await refreshPortfolio();
    })();
  }, [depositReceipt.isSuccess, depositHash, refreshAccount, refreshPortfolio]);

  // Reset auto-link when the browser wallet address changes (disconnect / switch).
  useEffect(() => {
    setAutoLinkAttempted(false);
  }, [address]);

  // Auto-prompt ownership signature only when the server says the wallet still
  // needs linking — never on refresh when already verified.
  useEffect(() => {
    if (!user || !isConnected || !address) return;
    if (!accountReady || loadingAccount || verifying || autoLinkAttempted) return;
    if (!account || account.linked) return;
    setAutoLinkAttempted(true);
    void verifyAndLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    isConnected,
    address,
    account,
    accountReady,
    loadingAccount,
    verifying,
    autoLinkAttempted,
  ]);

  async function ensureMonad() {
    if (chainId !== monadMainnet.id) {
      await switchChainAsync({ chainId: monadMainnet.id });
    }
  }

  async function verifyAndLink() {
    if (!user || !address || verifying) return;
    setVerifying(true);
    setStatus(null);
    setTxUrl(null);
    try {
      await ensureMonad();
      const nonceRes = await fetch("/api/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const nonceData = (await nonceRes.json()) as {
        message?: string;
        error?: string;
        alreadyVerified?: boolean;
      };
      if (!nonceRes.ok) {
        throw new Error(nonceData.error ?? "Could not start wallet verify");
      }
      // Already verified for this address — refresh and skip the wallet popup.
      if (nonceData.alreadyVerified) {
        await refreshAccount();
        return;
      }
      if (!nonceData.message) {
        throw new Error(nonceData.error ?? "Could not start wallet verify");
      }
      const signature = await signMessageAsync({ message: nonceData.message });
      const verifyRes = await fetch("/api/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: address, signature }),
      });
      const verifyData = (await verifyRes.json()) as { error?: string };
      if (!verifyRes.ok) {
        throw new Error(verifyData.error ?? "Wallet verification failed");
      }
      setStatus("Wallet linked");
      await refreshAccount();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Wallet connect failed";
      // User rejected signature — don’t spam.
      if (!/rejected|denied|cancel/i.test(msg)) {
        setStatus(msg);
      }
    } finally {
      setVerifying(false);
    }
  }

  async function onTransfer() {
    if (!account?.account || !amount || Number(amount) <= 0) {
      setStatus("Enter an amount");
      return;
    }
    setBusy(true);
    setStatus(null);
    setTxUrl(null);
    try {
      await ensureMonad();
      if (direction === "deposit") {
        if (!isConnected || !address) {
          openWalletPicker();
          throw new Error("Connect your personal wallet, then tap Add funds again");
        }
        const hash = await sendTransactionAsync({
          to: account.account.inSiteWallet,
          value: parseEther(amount),
          chainId: monadMainnet.id,
        });
        pendingDepositRef.current = { amountMon: amount, txHash: hash };
        setStatus("Sending… confirm in your wallet");
        setTxUrl(getExplorerTxUrl(hash));
      } else {
        const res = await fetch("/api/trade/withdraw", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amountMon: amount }),
        });
        const data = (await res.json()) as { txHash?: string; error?: string };
        if (!res.ok || !data.txHash) {
          throw new Error(data.error ?? "Withdraw failed");
        }
        setStatus("Withdraw sent to your wallet");
        setTxUrl(getExplorerTxUrl(data.txHash));
        await refreshAccount();
        await refreshPortfolio();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyTradingAddress() {
    const addr = account?.account?.inSiteWallet;
    if (!addr) return;
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function clearExportModal() {
    // Drop private key from client memory as soon as the modal closes.
    setKeyModal(null);
    setKeyCopied(false);
  }

  async function handleLogout() {
    setStatus(null);
    setTxUrl(null);
    setTradeModal(null);
    setTradeSuccess(null);
    setKeyModal(null);
    setAccount(null);
    setAccountReady(false);
    setHoldings([]);
    setRecentTrades([]);
    setHotWalletMon(null);
    await logout();
  }

  function openTradeModal(action: "buy" | "sell", holding: PortfolioHolding) {
    setTradeModal({
      action,
      tokenAddress: holding.tokenAddress,
      symbol: holding.symbol,
      balance: holding.balance,
    });
    setTradeAmount(action === "buy" ? "1" : "");
    setSellPercent(100);
    setStatus(null);
  }

  async function onConfirmTrade() {
    if (!tradeModal || tradeBusy) return;
    setTradeBusy(true);
    setStatus(null);
    setTxUrl(null);
    const action = tradeModal.action;
    const symbol = tradeModal.symbol;
    const buyAmount = tradeAmount;
    const percent = sellPercent;
    try {
      const body =
        action === "buy"
          ? {
              action: "buy" as const,
              tokenAddress: tradeModal.tokenAddress,
              amountMon: buyAmount,
            }
          : {
              action: "sell" as const,
              tokenAddress: tradeModal.tokenAddress,
              percent,
            };
      const res = await fetch("/api/trade/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: string;
        dryRun?: boolean;
        txHash?: string | null;
        amountMon?: string;
        tokenSymbol?: string | null;
        error?: string;
        message?: string;
      };
      if (!res.ok || data.ok === false) {
        const err = data.message ?? data.error ?? "Trade failed";
        if (data.txHash) {
          setTxUrl(getExplorerTxUrl(data.txHash));
        }
        throw new Error(err);
      }

      const confirmed =
        data.dryRun ||
        data.status === "DRY_RUN_SUCCESS" ||
        data.status === "CONFIRMED";
      if (!confirmed) {
        throw new Error(
          data.status === "SUBMITTED"
            ? "Trade submitted but not confirmed yet — check Activity / explorer"
            : `Trade not confirmed (${data.status ?? "unknown"})`,
        );
      }

      const ticker = (data.tokenSymbol ?? symbol ?? "TOKEN").replace(/^\$/, "");
      const explorerUrl = data.txHash ? getExplorerTxUrl(data.txHash) : null;

      // Optimistic portfolio update so a full sell disappears immediately.
      if (action === "sell") {
        const token = tradeModal.tokenAddress.toLowerCase();
        setHoldings((prev) =>
          prev
            .map((h) => {
              if (h.tokenAddress.toLowerCase() !== token) return h;
              if (percent >= 100) return { ...h, balance: "0" };
              const bal = Number(h.balance);
              if (!Number.isFinite(bal)) return h;
              return { ...h, balance: String(Math.max(0, bal * (1 - percent / 100))) };
            })
            .filter((h) => hasPositiveBalance(h.balance)),
        );
      }

      setTradeModal(null);
      setTradeSuccess({
        action,
        symbol: ticker,
        amountLabel:
          action === "buy" ? `${formatMon(buyAmount)} MON` : `${percent}%`,
        detailLabel:
          action === "sell" && data.amountMon
            ? `~${formatMon(data.amountMon)} MON`
            : undefined,
        dryRun: Boolean(data.dryRun || data.status === "DRY_RUN_SUCCESS"),
        txUrl: explorerUrl,
      });
      setStatus(null);
      setTxUrl(explorerUrl);
      await refreshAccount({ silent: true });
      await refreshPortfolio(activityPage, { silent: true });
      // Chain balance can lag briefly after confirm — refresh again shortly.
      window.setTimeout(() => {
        void refreshPortfolio(activityPage, { silent: true });
      }, 4000);    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trade failed");
    } finally {
      setTradeBusy(false);
    }
  }

  async function onExportPrivateKey() {
    if (!account?.account?.keyExportAvailable || keyBusy) return;
    setKeyBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/trade/export-key", { method: "POST" });
      const data = (await res.json()) as {
        privateKey?: string;
        address?: string;
        error?: string;
      };
      if (!res.ok || !data.privateKey || !data.address) {
        throw new Error(
          data.error === "already_exported"
            ? "Private key already revealed for this wallet"
            : (data.error ?? "Export failed"),
        );
      }
      setKeyModal({ kind: "export", privateKey: data.privateKey, address: data.address });
      await refreshAccount();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setKeyBusy(false);
    }
  }

  async function onConfirmRenew() {
    if (keyBusy) return;
    setKeyBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/trade/renew-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmRenew: true }),
      });
      const data = (await res.json()) as {
        previousInSiteWallet?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Renew failed");
      }
      clearExportModal();
      await refreshAccount();
      setStatus(
        data.previousInSiteWallet
          ? `New trading wallet ready. Old address ${shortAddr(data.previousInSiteWallet)} no longer used for buys.`
          : "New trading wallet ready",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Renew failed");
    } finally {
      setKeyBusy(false);
    }
  }

  function openWalletPicker() {
    setStatus(null);
    void open({ view: "Connect" });
  }

  const linked = Boolean(account?.linked && account.account);

  if (authLoading || (user && !accountReady)) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-semibold tracking-[0.22em] text-mx-accent uppercase">MonEx</p>
        <Loader2 className="mx-spinner h-5 w-5 text-mx-muted" />
      </div>
    );
  }

  // ——— Phase 1: Login ———
  if (!user) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-10">
        <header className="space-y-4 text-center animate-fade-up">
          <p className="text-sm font-semibold tracking-[0.22em] text-mx-accent uppercase">MonEx</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-mx-text md:text-5xl">
            Buy from X.
          </h1>
          <p className="mx-auto max-w-sm text-base leading-relaxed text-mx-muted">
            Log in, add MON, then tweet{" "}
            <span className="text-mx-text">@monexmonad buy …</span> to trade.
          </p>
        </header>

        <div className="flex flex-col items-center gap-4 animate-fade-up-delay">
          <Button
            className="w-full max-w-sm sm:!w-full"
            size="lg"
            onClick={() => (window.location.href = "/api/auth/x")}
          >
            Continue with X
          </Button>
          <p className="text-center text-xs text-mx-muted">Takes about 30 seconds to set up.</p>
        </div>

        {status ? (
          <p className="text-center text-sm text-red-300 animate-fade-up-delay-2">{status}</p>
        ) : null}
      </div>
    );
  }

  // ——— Phase 2: Connect wallet ———
  if (!linked) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-8">
        <div className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-2">
            {user.xProfileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.xProfileImage} alt="" className="h-8 w-8 rounded-full" />
            ) : null}
            <span className="text-sm text-mx-text">@{user.xUsername}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-mx-surface-2 px-2 py-0.5 text-[10px] font-semibold text-mx-accent">
              <Check className="h-3 w-3" /> Linked
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1 text-xs text-mx-muted hover:text-mx-text"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>

        <header className="space-y-3 animate-fade-up-delay">
          <p className="text-xs font-semibold uppercase tracking-widest text-mx-accent">Step 2 of 2</p>
          <h1 className="font-display text-3xl font-bold text-mx-text md:text-4xl">
            Connect your wallet
          </h1>
          <p className="text-base leading-relaxed text-mx-muted">
            This is where you keep your MON. You’ll move some into a trading balance MonEx uses when
            you buy on X.
          </p>
        </header>

        <div className="space-y-3 animate-fade-up-delay-2">
          {!isConnected ? (
            <Button
              className="w-full"
              size="lg"
              loading={connecting}
              onClick={() => openWalletPicker()}
            >
              <Wallet className="h-4 w-4" /> Connect wallet
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-mx-border bg-mx-surface/80 p-5">
              <p className="font-mono text-sm text-mx-text">{shortAddr(address!)}</p>
              <Button className="w-full" size="lg" loading={verifying} onClick={() => void verifyAndLink()}>
                {verifying ? "Confirm in wallet…" : "Confirm ownership"}
              </Button>
              <p className="text-center text-xs text-mx-muted">
                Sign a free message — no transaction, no gas.
              </p>
            </div>
          )}
          {loadingAccount ? (
            <p className="flex items-center justify-center gap-2 text-sm text-mx-muted">
              <Loader2 className="mx-spinner h-4 w-4" /> Setting up trading wallet…
            </p>
          ) : null}
          {status ? <p className="text-center text-sm text-red-300">{status}</p> : null}
        </div>
      </div>
    );
  }

  // ——— Phase 3: Desk (fully onboarded) ———
  const tradingBal = formatMon(account?.balances?.inSiteMon);
  // Prefer live chain read so balance stays visible when browser wallet is disconnected.
  const yourBal = formatMon(hotWalletMon ?? account?.balances?.connectedMon);
  const tradingAddr = account!.account!.inSiteWallet;
  const keyExportAvailable = account?.account?.keyExportAvailable !== false && !account?.account?.privateKeyExportedAt;
  const visibleHoldings = holdings.filter((h) => hasPositiveBalance(h.balance));
  const tradingMonRaw = Number(account?.balances?.inSiteMon ?? "0");
  const maxTransferMon =
    direction === "deposit"
      ? maxSpendableMon(hotWalletMon ?? account?.balances?.connectedMon)
      : maxSpendableMon(account?.balances?.inSiteMon);
  const canMaxTransfer = Number(maxTransferMon) > 0;

  return (
    <div className="mx-auto w-full pb-10">
      <div className="mb-6 flex items-center justify-between animate-fade-up">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-mx-accent uppercase">MonEx</p>
          <p className="mt-1 text-sm text-mx-muted">@{user.xUsername}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mx-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mx-accent opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-mx-accent" />
            </span>
            Live
          </span>
          <button
            type="button"
            onClick={() => {
              void refreshAccount({ silent: true });
              void refreshPortfolio(activityPage, { silent: true });
            }}
            className="text-xs text-mx-muted hover:text-mx-text"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1 text-xs text-mx-muted hover:text-mx-text"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 animate-fade-up-delay">
        {/* Funds sizes to content; Portfolio matches height and scrolls only when needed */}
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-5">
          {/* Funds — no fixed height, no scrollbar */}
          <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-mx-border bg-mx-surface/80 p-4">
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-bold text-mx-text">Funds</h2>
              <p className="text-xs text-mx-muted">
                Add MON, then buy on X with <span className="text-mx-text">@monexmonad</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-mx-border bg-mx-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-mx-muted">Your wallet</p>
                  {isConnected ? (
                    <button
                      type="button"
                      title="Disconnect"
                      onClick={() => disconnect()}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-mx-muted transition hover:bg-mx-accent/10 hover:text-mx-accent"
                    >
                      <LogOut className="h-3 w-3 shrink-0" />
                      <span className="hidden min-[380px]:inline">Disconnect</span>
                    </button>
                  ) : null}
                </div>
                <p className="mt-1.5 font-display text-xl font-bold text-mx-text">
                  {isConnected ? yourBal : "—"}
                </p>
                <p className="text-[11px] text-mx-muted">MON</p>
                {isConnected ? (
                  <p className="mt-1.5 font-mono text-[10px] text-mx-muted">
                    {shortAddr(address ?? account!.account!.connectedWallet)}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] text-mx-muted">Connect personal wallet</p>
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => openWalletPicker()}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-mx-accent/15 px-2 py-1.5 text-[10px] font-semibold text-mx-accent transition hover:bg-mx-accent/25 disabled:opacity-50"
                    >
                      <Wallet className="h-3 w-3 shrink-0" />
                      Connect
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-mx-accent/40 bg-mx-surface-2 p-3 ring-1 ring-mx-accent/20">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-mx-accent">Trading</p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        disabled={!keyExportAvailable || keyBusy}
                        title={
                          keyExportAvailable
                            ? "Export private key (one time)"
                            : "Private key already revealed"
                        }
                        onClick={() => void onExportPrivateKey()}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition ${
                          keyExportAvailable
                            ? "text-mx-accent hover:bg-mx-accent/10"
                            : "cursor-not-allowed text-mx-muted/50"
                        }`}
                      >
                        <KeyRound className="h-3 w-3 shrink-0" />
                        <span className="hidden min-[380px]:inline">
                          {keyExportAvailable ? "Export" : "Revealed"}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={keyBusy}
                        title="Renew trading wallet"
                        onClick={() => setKeyModal({ kind: "renew-confirm" })}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-mx-muted transition hover:bg-mx-accent/10 hover:text-mx-accent"
                      >
                        <RefreshCw className="h-3 w-3 shrink-0" />
                        <span className="hidden min-[380px]:inline">Renew</span>
                      </button>
                    </div>
                  </div>
                  <p className="font-display text-xl font-bold text-mx-accent">{tradingBal}</p>
                  <p className="text-[11px] text-mx-muted">MON · used on X</p>
                  <button
                    type="button"
                    onClick={() => void copyTradingAddress()}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-mx-muted hover:text-mx-text"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {shortAddr(tradingAddr)}
                  </button>
                  {!keyExportAvailable ? (
                    <p className="text-[10px] text-mx-muted/70">One-time key already saved offline</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-mx-border bg-mx-surface-2 p-4">
              <div className="flex rounded-xl bg-mx-bg p-1">
                <button
                  type="button"
                  onClick={() => setDirection("deposit")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${
                    direction === "deposit"
                      ? "bg-mx-accent text-mx-bg"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  <ArrowDown className="h-3.5 w-3.5" /> Add funds
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("withdraw")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${
                    direction === "withdraw"
                      ? "bg-mx-accent text-mx-bg"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5" /> Cash out
                </button>
              </div>

              <p className="text-center text-[11px] text-mx-muted">
                {direction === "deposit"
                  ? "Your wallet → Trading balance"
                  : "Trading balance → Your wallet"}
              </p>

              <div className="flex gap-2">
                {["0.5", "1", "5"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                      amount === preset
                        ? "border-mx-accent text-mx-accent"
                        : "border-mx-border text-mx-muted hover:text-mx-text"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <label className="block space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-mx-muted">Amount (MON)</span>
                  <button
                    type="button"
                    disabled={!canMaxTransfer}
                    onClick={() => setAmount(maxTransferMon)}
                    className="text-[11px] font-semibold text-mx-accent disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      direction === "deposit"
                        ? "Max leaves 1 MON in your wallet for gas"
                        : "Max leaves 1 MON in trading for gas"
                    }
                  >
                    Max
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full rounded-xl border border-mx-border bg-mx-bg px-3 py-2.5 font-mono text-lg text-mx-text outline-none ring-mx-accent focus:ring-1"
                />
                <p className="text-[10px] text-mx-muted">
                  {direction === "deposit"
                    ? "Max leaves 1 MON in your wallet for gas"
                    : "Max leaves 1 MON in trading for gas"}
                  {" · "}
                  you can type any amount
                </p>
              </label>

              <Button
                className="w-full sm:!w-full"
                size="lg"
                loading={busy || depositing || depositReceipt.isLoading}
                onClick={() => void onTransfer()}
              >
                {direction === "deposit" ? "Add to trading" : "Send to my wallet"}
              </Button>

              {!isConnected && direction === "deposit" ? (
                <button
                  type="button"
                  onClick={() => openWalletPicker()}
                  className="w-full text-center text-[11px] text-mx-muted underline-offset-2 hover:underline"
                >
                  Connect personal wallet to add funds
                </button>
              ) : null}
            </div>

            <div className="space-y-1.5 text-center">
              <p className="text-xs font-medium text-mx-text">Then on X:</p>
              <div className="rounded-xl bg-mx-surface-2 px-2 py-2 text-left">
                <p className="mb-1 text-[10px] italic text-mx-muted">example (i.e.)</p>
                <code className="block break-all font-mono text-[11px] italic leading-relaxed text-mx-muted">
                  @monexmonad buy 1 mon 0x0CC9B2e2AcD7BACfF79eb7dB48F5662B622E7777
                </code>
              </div>
            </div>
          </section>

          {/* Portfolio — matches Funds height; themed scroll only when list overflows */}
          <section className="flex min-h-[320px] min-w-0 flex-col rounded-2xl border border-mx-border bg-mx-surface/80 p-4 md:h-full md:min-h-0">
            <div className="mb-3 shrink-0 space-y-1">
              <h2 className="font-display text-2xl font-bold text-mx-text">Portfolio</h2>
              <p className="text-xs text-mx-muted">Buy or sell tokens you already hold</p>
            </div>

            <div className="mx-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-mx-border bg-mx-surface-2">
              {loadingPortfolio ? (
                <p className="flex items-center gap-2 px-4 py-8 text-sm text-mx-muted">
                  <Loader2 className="mx-spinner h-4 w-4" /> Loading…
                </p>
              ) : visibleHoldings.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
                  <p className="text-sm text-mx-text">Portfolio empty</p>
                  <p className="mt-1 text-xs text-mx-muted">Start buying on X</p>
                </div>
              ) : (
                <ul className="divide-y divide-mx-border/70">
                  {visibleHoldings.map((h) => (
                    <li key={h.tokenAddress} className="flex items-center gap-2.5 px-3 py-2.5">
                      <TokenLogo address={h.tokenAddress} symbol={h.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-mx-text">
                            <span className="truncate">{h.symbol}</span>
                            <VenueBadge venue={h.venue} label={h.venueLabel} />
                          </p>
                          <p className="shrink-0 font-mono text-sm text-mx-accent">
                            {formatMon(h.balance)}
                          </p>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-mx-muted">
                          <a
                            href={getVenueTokenUrl(h.tokenAddress, h.venue)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono hover:text-mx-accent"
                            title={h.tokenAddress}
                          >
                            {shortAddr(h.tokenAddress)}
                          </a>
                          <span className="whitespace-nowrap">
                            {h.buys} buy{h.buys === 1 ? "" : "s"} · {h.spentMon} MON
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openTradeModal("buy", h)}
                            className="rounded-lg bg-mx-accent/15 px-2.5 py-1 text-[11px] font-semibold text-mx-accent hover:bg-mx-accent/25"
                          >
                            Buy
                          </button>
                          <button
                            type="button"
                            onClick={() => openTradeModal("sell", h)}
                            className="rounded-lg bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-400/20"
                          >
                            Sell
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Activity — buys + add funds / cash out */}
        <section className="min-w-0">
          <div className="mb-3">
            <h2 className="font-display text-2xl font-bold text-mx-text">Activity</h2>
          </div>

          <div className="rounded-2xl border border-mx-border bg-mx-surface/80 p-4">
            {loadingPortfolio ? (
              <p className="flex items-center gap-2 py-8 text-sm text-mx-muted">
                <Loader2 className="mx-spinner h-4 w-4" /> Loading…
              </p>
            ) : recentTrades.length === 0 ? (
              <p className="py-8 text-center text-xs text-mx-muted">No activity yet.</p>
            ) : (
              <div className="mx-scroll max-h-[320px] overflow-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 bg-mx-surface-2">
                    <tr className="text-mx-muted">
                      <th className="pb-2 pr-3 font-medium">Date</th>
                      <th className="pb-2 pr-3 font-medium">Source</th>
                      <th className="pb-2 pr-3 font-medium">Side</th>
                      <th className="pb-2 pr-3 font-medium">CA</th>
                      <th className="pb-2 pr-3 font-medium">Token</th>
                      <th className="pb-2 pr-3 font-medium">Amount</th>
                      <th className="pb-2 pr-3 font-medium">Status</th>
                      <th className="pb-2 font-medium">Txn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t) => {
                      const label = formatActivityStatus(t.status);
                      const name = t.tokenSymbol || t.tokenName || "Token";
                      const side = t.side ?? "buy";
                      const source = t.source === "app" || t.kind === "transfer" ? "app" : "x";
                      const isTransfer = t.kind === "transfer" || side === "add_funds" || side === "cash_out";
                      const sideLabel =
                        side === "add_funds"
                          ? "add funds"
                          : side === "cash_out"
                            ? "cash out"
                            : side;
                      const sideClass =
                        side === "buy" || side === "add_funds"
                          ? "font-semibold text-emerald-300"
                          : side === "sell" || side === "cash_out"
                            ? "font-semibold text-red-300"
                            : "font-semibold text-mx-text";
                      const caAddress = isTransfer ? t.walletAddress : t.tokenAddress;
                      const rowKey = t.id || t.tweetId || t.txHash || `${side}-${t.createdAt}`;
                      return (
                        <tr key={rowKey} className="border-t border-mx-border/50 text-mx-text">
                          <td
                            className="whitespace-nowrap py-2.5 pr-3 align-middle tabular-nums text-mx-muted"
                            title={t.createdAt}
                          >
                            {formatActivityWhen(t.createdAt)}
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            {source === "x" ? (
                              <span
                                className="inline-flex items-center gap-1 text-mx-text"
                                title="Started on X"
                              >
                                <XMark className="h-3.5 w-3.5" />
                                <span className="sr-only">X</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-mx-accent"
                                title="Started in app"
                              >
                                <AppWindow className="h-3.5 w-3.5" />
                                <span className="sr-only">App</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            <span className={`whitespace-nowrap capitalize ${sideClass}`}>
                              {sideLabel}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 align-middle font-mono">
                            {caAddress ? (
                              isTransfer ? (
                                <a
                                  href={getExplorerAddressUrl(caAddress)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex flex-col gap-0.5 hover:text-mx-accent"
                                  title={caAddress}
                                >
                                  <span className="text-[10px] font-sans font-semibold uppercase tracking-wide text-mx-muted">
                                    {t.walletKind === "hot" ? "hot wallet" : "in-app wallet"}
                                  </span>
                                  <span className="whitespace-nowrap">{caAddress}</span>
                                </a>
                              ) : (
                                <a
                                  href={getNadFunTokenUrl(caAddress)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="whitespace-nowrap hover:text-mx-accent"
                                  title={caAddress}
                                >
                                  {caAddress}
                                </a>
                              )
                            ) : (
                              <span className="text-mx-muted">—</span>
                            )}
                          </td>
                          <td className="max-w-[120px] truncate py-2.5 pr-3 align-middle" title={name}>
                            {name}
                          </td>
                          <td className="py-2.5 pr-3 align-middle">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              <MonadMark className="h-3.5 w-3.5" />
                              {t.amountMon}
                            </span>
                          </td>
                          <td className={`py-2.5 pr-3 align-middle capitalize ${statusTone(t.status)}`}>
                            {label}
                          </td>
                          <td className="py-2.5 align-middle font-mono">
                            {t.txHash ? (
                              <a
                                href={getExplorerTxUrl(t.txHash)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-mx-accent hover:underline"
                                title={t.txHash}
                              >
                                {shortAddr(t.txHash)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-mx-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activityTotal > 0 ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-mx-border/60 pt-3">
                <p className="text-[11px] text-mx-muted">
                  Page {activityPage} of {activityTotalPages}
                  <span className="text-mx-muted/70"> · {activityTotal} total</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!activityHasPrev || loadingPortfolio}
                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-mx-border px-2.5 py-1.5 text-[11px] font-semibold text-mx-muted transition hover:text-mx-text disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-3 w-3" /> Prev
                  </button>
                  <button
                    type="button"
                    disabled={!activityHasMore || loadingPortfolio}
                    onClick={() => setActivityPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-mx-border px-2.5 py-1.5 text-[11px] font-semibold text-mx-muted transition hover:text-mx-text disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {status ? (
        <p
          className={`mt-6 text-center text-sm ${
            /fail|error|could not|invalid|insufficient|rejected/i.test(status)
              ? "text-red-300"
              : "text-mx-accent"
          }`}
        >
          {status}
          {txUrl ? (
            <>
              {" · "}
              <a href={txUrl} target="_blank" rel="noreferrer" className="underline">
                View tx
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {keyModal?.kind === "export" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-mx-border bg-mx-surface-2 p-5 shadow-glow"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-mx-text">Private key</h3>
                <p className="mt-1 text-xs text-mx-muted">
                  Shown once. Copy it now — this app will never show it again.
                </p>
              </div>
              <button
                type="button"
                onClick={clearExportModal}
                className="rounded-md p-1 text-mx-muted hover:text-mx-text"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 font-mono text-[11px] text-mx-muted">{keyModal.address}</p>
            <div className="rounded-xl border border-mx-border bg-mx-bg px-3 py-3">
              <p className="break-all font-mono text-xs text-mx-accent">{keyModal.privateKey}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                className="w-full sm:!w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(keyModal.privateKey);
                  setKeyCopied(true);
                  setTimeout(() => setKeyCopied(false), 1500);
                }}
              >
                {keyCopied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy private key
                  </>
                )}
              </Button>
              <Button
                className="w-full sm:!w-full"
                variant="secondary"
                onClick={clearExportModal}
              >
                I’ve saved it — never show again
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-mx-muted">
              Anyone with this key controls your trading wallet. Store it offline. After you close
              this, Export stays locked for this wallet.
            </p>
          </div>
        </div>
      ) : null}

      {keyModal?.kind === "renew-confirm" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-mx-border bg-mx-surface-2 p-5 shadow-glow"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-mx-text">Renew trading wallet</h3>
                <p className="mt-1 text-xs text-mx-muted">
                  Creates a new in-site wallet with a new one-time private key export.
                </p>
              </div>
              <button
                type="button"
                onClick={clearExportModal}
                className="rounded-md p-1 text-mx-muted hover:text-mx-text"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-3 text-xs leading-relaxed text-red-200">
              <p className="font-semibold text-red-100">Move all funds first</p>
              <p className="mt-1">
                Cash out MON and tokens from the current trading wallet before renewing. Anything
                left on {shortAddr(tradingAddr)} stays there and will not move to the new wallet.
              </p>
              {Number.isFinite(tradingMonRaw) && tradingMonRaw > 0 ? (
                <p className="mt-2 font-medium text-red-100">
                  Current trading balance: {tradingBal} MON
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                className="w-full sm:!w-full"
                loading={keyBusy}
                onClick={() => void onConfirmRenew()}
              >
                I moved my funds — renew wallet
              </Button>
              <Button
                className="w-full sm:!w-full"
                variant="secondary"
                disabled={keyBusy}
                onClick={clearExportModal}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tradeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-mx-border bg-mx-surface-2 p-5 shadow-glow"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-mx-text">
                  {tradeModal.action === "buy" ? "Buy" : "Sell"} {tradeModal.symbol}
                </h3>
                <p className="mt-1 text-xs text-mx-muted">
                  {tradeModal.action === "buy"
                    ? "Spend MON from your trading wallet"
                    : `Balance ${formatMon(tradeModal.balance)} ${tradeModal.symbol}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !tradeBusy && setTradeModal(null)}
                className="rounded-md p-1 text-mx-muted hover:text-mx-text"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {tradeModal.action === "buy" ? (
              <label className="block space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-mx-muted">Amount (MON)</span>
                  <button
                    type="button"
                    disabled={
                      tradeBusy || Number(maxSpendableMon(account?.balances?.inSiteMon)) <= 0
                    }
                    onClick={() =>
                      setTradeAmount(maxSpendableMon(account?.balances?.inSiteMon))
                    }
                    className="text-[11px] font-semibold text-mx-accent disabled:cursor-not-allowed disabled:opacity-40"
                    title="Max leaves 1 MON in trading for gas"
                  >
                    Max
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full rounded-xl border border-mx-border bg-mx-surface-2 px-3 py-2.5 font-mono text-sm text-mx-text outline-none focus:border-mx-accent"
                  placeholder="1"
                  disabled={tradeBusy}
                />
                <p className="text-[10px] text-mx-muted">
                  Max leaves 1 MON for gas · you can type any amount
                </p>
              </label>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-mx-muted">Sell percent</p>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={tradeBusy}
                      onClick={() => setSellPercent(p)}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                        sellPercent === p
                          ? "bg-red-400/25 text-red-200"
                          : "bg-mx-surface-2 text-mx-muted hover:text-mx-text"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <Button
                className="w-full sm:!w-full"
                loading={tradeBusy}
                onClick={() => void onConfirmTrade()}
              >
                {tradeModal.action === "buy"
                  ? `Buy with ${tradeAmount || "…"} MON`
                  : `Sell ${sellPercent}%`}
              </Button>
              <Button
                className="w-full sm:!w-full"
                variant="secondary"
                disabled={tradeBusy}
                onClick={() => setTradeModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tradeSuccess ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-mx-border bg-mx-surface-2 p-6 text-center shadow-glow animate-fade-up"
          >
            <p
              className={`font-display text-3xl font-bold ${
                tradeSuccess.action === "buy" ? "text-mx-accent" : "text-red-300"
              }`}
            >
              {tradeSuccess.action === "buy" ? "Bought" : "Sold"}
            </p>
            <p className="mt-3 font-display text-2xl font-bold text-mx-accent">
              ${tradeSuccess.symbol}
            </p>
            <p className="mt-2 text-lg font-semibold text-mx-text">{tradeSuccess.amountLabel}</p>
            {tradeSuccess.detailLabel ? (
              <p className="mt-1 text-sm text-mx-muted">{tradeSuccess.detailLabel}</p>
            ) : null}
            {tradeSuccess.dryRun ? (
              <p className="mt-3 text-xs text-mx-muted">Dry run — no on-chain transaction</p>
            ) : null}
            {tradeSuccess.txUrl ? (
              <a
                href={tradeSuccess.txUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm text-mx-accent hover:underline"
              >
                View tx <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <Button
              className="mt-5 w-full sm:!w-full"
              onClick={() => setTradeSuccess(null)}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
