"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardArt } from "@/components/ui/card-art";
import { formatTimeRemaining, formatCardLabel } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

function LiveCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => formatTimeRemaining(new Date(expiresAt)));

  useEffect(() => {
    const tick = () => setRemaining(formatTimeRemaining(new Date(expiresAt)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <span className="font-mono text-mp-violet-bright">{remaining}</span>;
}

export function PendingBanner() {
  const { user } = useAuth();
  const [pending, setPending] = useState<{
    card: { name: string; displayNumber: number; imageUrl: string };
    pack: { name: string };
    expiresAt: string;
    id: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/collection")
      .then((r) => r.json())
      .then((data) => {
        if (data.pending) setPending(data.pending);
      })
      .catch(() => {});
  }, [user]);

  if (!pending) return null;

  return (
    <Card className="animate-slide-up border-mp-violet/40 bg-gradient-to-r from-mp-violet/10 to-transparent mp-glow-pulse">
      <CardContent className="flex flex-col items-center gap-4 py-4 sm:flex-row">
        <CardArt
          src={pending.card.imageUrl}
          alt={pending.card.name}
          className="w-16 shrink-0 shadow-card sm:w-20"
        />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-mp-violet-bright">Pending card</p>
          <p className="font-display font-semibold text-mp-text">
            {formatCardLabel(pending.card.name, pending.card.displayNumber)}
          </p>
          <p className="text-sm text-mp-text-secondary">
            {pending.pack.name} · Claim within <LiveCountdown expiresAt={pending.expiresAt} />
          </p>
        </div>
        <Link href="/collection">
          <Button size="lg">Claim Now</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
