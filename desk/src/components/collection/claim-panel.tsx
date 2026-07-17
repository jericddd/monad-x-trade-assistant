"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { monadMainnet } from "@/lib/monad-chain";
import { Button } from "@/components/ui/button";
import { PRODUCT_ERRORS } from "@/lib/errors";

type Props = {
  openingId: string;
  onClaimed?: () => void;
};

export function ClaimPanel({ openingId, onClaimed }: Props) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureNetwork() {
    if (chainId !== monadMainnet.id) {
      try {
        await switchChainAsync({ chainId: monadMainnet.id });
      } catch {
        throw new Error(PRODUCT_ERRORS.NETWORK_REJECTED);
      }
    }
  }

  async function verifyWallet() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      await ensureNetwork();
      const nonceRes = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.message ?? "Verification failed");

      const signature = await signMessageAsync({ message: nonceData.message });
      const verifyRes = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, signature }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.message ?? "Verification failed");
      }
      setVerified(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : PRODUCT_ERRORS.CLAIM_FAILURE);
    } finally {
      setLoading(false);
    }
  }

  async function claim() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      await ensureNetwork();
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingId, walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? PRODUCT_ERRORS.CLAIM_FAILURE);
      onClaimed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : PRODUCT_ERRORS.CLAIM_FAILURE);
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-mp-text-secondary">Connect your wallet on Monad Mainnet to claim.</p>
        <Button size="lg" onClick={() => connect({ connector: connectors[0] })}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="truncate font-mono text-xs text-mp-muted">{address}</p>
      {chainId !== monadMainnet.id && (
        <p className="text-sm text-amber-400">{PRODUCT_ERRORS.WRONG_NETWORK}</p>
      )}
      {!verified ? (
        <Button size="lg" loading={loading} onClick={verifyWallet}>
          Verify Wallet
        </Button>
      ) : (
        <Button size="lg" loading={loading} onClick={claim}>
          Claim Card
        </Button>
      )}
      <Button variant="ghost" size="sm" disabled={loading} onClick={() => disconnect()}>
        Disconnect
      </Button>
      {error && <p className="animate-fade-in text-sm text-red-400">{error}</p>}
    </div>
  );
}
