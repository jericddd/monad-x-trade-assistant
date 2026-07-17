"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogSheet } from "@/components/ui/dialog-sheet";
import { CardArt } from "@/components/ui/card-art";
import { formatTimeRemaining, formatCardLabel } from "@/lib/utils";
import { Package } from "lucide-react";

type RevealData = {
  card: { name: string; displayNumber: number; imageUrl: string; rarityLabel?: string | null };
  pack: { name: string; slug: string };
  opening: { id: string; expiresAt: string };
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function PackOpeningState({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const reducedMotion = useReducedMotion();
  const [minTimeDone, setMinTimeDone] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setTimeout(() => setMinTimeDone(true), 700);
    return () => clearTimeout(id);
  }, [reducedMotion]);

  useEffect(() => {
    if (ready && minTimeDone) onComplete();
  }, [ready, minTimeDone, onComplete]);

  return (
    <DialogSheet open dismissible={false} title="Opening pack">
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div
          className={
            reducedMotion
              ? "flex h-32 w-32 items-center justify-center rounded-2xl bg-mp-surface-raised"
              : "flex h-32 w-32 animate-pack-shake items-center justify-center rounded-2xl bg-gradient-to-br from-mp-violet/30 to-mp-gold/20 shadow-glow"
          }
        >
          <Package className="h-14 w-14 text-mp-violet-bright" aria-hidden />
        </div>
        <p className="font-display text-lg font-semibold text-mp-text">Opening pack…</p>
        {!reducedMotion && (
          <div className="h-1 w-48 overflow-hidden rounded-full bg-mp-surface-raised">
            <div className="h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-mp-violet/60 to-transparent bg-[length:200%_100%]" />
          </div>
        )}
      </div>
    </DialogSheet>
  );
}

function PackRevealModal({ data, onClose }: { data: RevealData; onClose: () => void }) {
  const [remaining, setRemaining] = useState(formatTimeRemaining(new Date(data.opening.expiresAt)));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const id = setInterval(
      () => setRemaining(formatTimeRemaining(new Date(data.opening.expiresAt))),
      1000,
    );
    return () => clearInterval(id);
  }, [data.opening.expiresAt]);

  return (
    <DialogSheet open onClose={onClose} title="Pack opened">
      <div className={reducedMotion ? "space-y-4 text-center" : "animate-reveal-pop space-y-4 text-center"}>
        <p className="text-sm font-semibold uppercase tracking-wide text-mp-violet-bright">You pulled</p>
        <CardArt src={data.card.imageUrl} alt={data.card.name} className="mx-auto w-48 shadow-glow" priority />
        <div>
          <h2 className="font-display text-2xl font-bold text-mp-text">
            {formatCardLabel(data.card.name, data.card.displayNumber)}
          </h2>
          <p className="text-mp-text-secondary">{data.pack.name}</p>
          {data.card.rarityLabel && <p className="mt-1 text-mp-gold">{data.card.rarityLabel}</p>}
        </div>
        <p className="text-sm text-mp-text-secondary">
          Claim within <span className="font-mono text-mp-violet-bright">{remaining}</span>
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button size="lg" onClick={() => (window.location.href = "/collection")}>
            View Pending
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}

export function OpenPackButton({ slug, disabled }: { slug: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const revealRef = useRef<RevealData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPack() {
    setLoading(true);
    setError(null);
    setOpening(true);
    setApiReady(false);
    revealRef.current = null;
    const idempotencyKey = crypto.randomUUID();
    try {
      const res = await fetch(`/api/packs/${slug}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not open pack");
      revealRef.current = {
        card: data.opening.card,
        pack: data.opening.pack,
        opening: { id: data.opening.id, expiresAt: data.opening.expiresAt },
      };
      setApiReady(true);
    } catch (e) {
      setOpening(false);
      setApiReady(false);
      setError(e instanceof Error ? e.message : "Could not open pack");
    } finally {
      setLoading(false);
    }
  }

  function finishOpening() {
    setOpening(false);
    setApiReady(false);
    if (revealRef.current) {
      setReveal(revealRef.current);
      revealRef.current = null;
    }
  }

  return (
    <>
      <Button size="lg" loading={loading || opening} disabled={disabled} onClick={openPack}>
        {loading || opening ? "Opening…" : "Open Pack"}
      </Button>
      {error && <p className="mt-2 animate-fade-in text-sm text-red-400">{error}</p>}
      {opening && <PackOpeningState ready={apiReady} onComplete={finishOpening} />}
      {reveal && <PackRevealModal data={reveal} onClose={() => setReveal(null)} />}
    </>
  );
}
