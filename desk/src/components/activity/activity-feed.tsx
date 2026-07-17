"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { displayStatus, formatRelativeTime, formatTimeRemaining, formatCardLabel } from "@/lib/utils";
import {
  formatDateTime,
  monadExplorerAddressUrl,
  monadExplorerTxUrl,
  truncateAddress,
} from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { DialogSheet } from "@/components/ui/dialog-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardArt } from "@/components/ui/card-art";
import { Activity } from "lucide-react";

export type ActivityItem = {
  id: string;
  xUsername: string;
  cardName: string;
  displayNumber: number;
  packName: string;
  source: "X" | "WEBSITE";
  openedAt: string;
  expiresAt: string;
  status: string;
  cardImage?: string;
  rarityLabel?: string | null;
  tokenId?: string | null;
  contractAddress?: string | null;
  transactionHash?: string | null;
  claimedAt?: string | null;
};

function SourceIcon({ source }: { source: "X" | "WEBSITE" }) {
  if (source === "X") {
    return (
      <span className="inline-flex items-center gap-1 text-mp-text-secondary" title="Opened on X">
        <span className="font-bold text-xs" aria-hidden>
          𝕏
        </span>
        <span className="sr-only">Opened on X</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-mp-text-secondary" title="Opened on Website">
      <Globe className="h-4 w-4" aria-hidden />
      <span className="sr-only">Opened on Website</span>
    </span>
  );
}

function Countdown({ expiresAt, status }: { expiresAt: string; status: string }) {
  const [remaining, setRemaining] = useState(() =>
    status === "CLAIMED" ? "Done" : status === "EXPIRED" ? "0" : formatTimeRemaining(new Date(expiresAt)),
  );

  useEffect(() => {
    if (status !== "UNCLAIMED") return;
    const tick = () => setRemaining(formatTimeRemaining(new Date(expiresAt)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, status]);

  return <span className="font-mono text-mp-violet-bright">{remaining}</span>;
}

export function ActivityTable({ items }: { items: ActivityItem[] }) {
  const [selected, setSelected] = useState<ActivityItem | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No packs have been opened yet."
        description="Activity from X and the website will show up here."
      />
    );
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-mp-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mp-border bg-mp-surface-raised/50 text-left text-mp-text-secondary">
              <th className="py-3 pl-4 pr-4 font-medium">User</th>
              <th className="py-3 pr-4 font-medium">Card</th>
              <th className="py-3 pr-4 font-medium">Pack</th>
              <th className="py-3 pr-4 font-medium">Source</th>
              <th className="py-3 pr-4 font-medium">Opened</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Time Remaining</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-mp-border/60 hover:bg-mp-surface-raised/40 cursor-pointer transition-colors"
                onClick={() => setSelected(item)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(item)}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${item.cardName} opened by @${item.xUsername}`}
              >
                <td className="py-3 pl-4 pr-4 text-mp-text">@{item.xUsername}</td>
                <td className="py-3 pr-4 text-mp-text">
                  {formatCardLabel(item.cardName, item.displayNumber)}
                </td>
                <td className="py-3 pr-4 text-mp-text-secondary">{item.packName}</td>
                <td className="py-3 pr-4">
                  <SourceIcon source={item.source} />
                </td>
                <td className="py-3 pr-4 text-mp-text-secondary">
                  {formatRelativeTime(new Date(item.openedAt))}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="py-3 pr-4">
                  <Countdown expiresAt={item.expiresAt} status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer mp-hover-lift hover:border-mp-violet/40"
            onClick={() => setSelected(item)}
            data-testid="activity-mobile-card"
          >
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-mp-text">@{item.xUsername}</span>
                <StatusBadge status={item.status} />
              </div>
              <div>
                <p className="font-medium text-mp-text">
                  {formatCardLabel(item.cardName, item.displayNumber)}
                </p>
                <p className="truncate text-sm text-mp-text-secondary">{item.packName}</p>
              </div>
              <div className="flex items-center justify-between text-sm text-mp-text-secondary">
                <SourceIcon source={item.source} />
                <span>{formatRelativeTime(new Date(item.openedAt))}</span>
              </div>
              <div className="flex items-center justify-between border-t border-mp-border pt-3">
                <span className="text-xs uppercase tracking-wide text-mp-muted">Time Remaining</span>
                <Countdown expiresAt={item.expiresAt} status={item.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ActivityDetail item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-mp-muted">{label}</dt>
      <dd className="text-right text-mp-text">{children}</dd>
    </div>
  );
}

function ActivityDetail({ item, onClose }: { item: ActivityItem | null; onClose: () => void }) {
  if (!item) return null;

  return (
    <DialogSheet open={Boolean(item)} onClose={onClose} title={`${item.cardName} details`}>
      <div className="space-y-4 pt-2">
        {item.cardImage && (
          <CardArt src={item.cardImage} alt={item.cardName} className="mx-auto w-48 shadow-glow" />
        )}
        <div>
          <h2 className="font-display text-xl font-bold text-mp-text">
            {formatCardLabel(item.cardName, item.displayNumber)}
          </h2>
          <p className="text-mp-text-secondary">{item.packName}</p>
        </div>

        <dl className="divide-y divide-mp-border rounded-xl border border-mp-border bg-mp-surface-raised/50 px-4">
          <DetailRow label="User">@{item.xUsername}</DetailRow>
          <DetailRow label="Source">
            {item.source === "X" ? "Opened on X" : "Opened on Website"}
          </DetailRow>
          <DetailRow label="Status">{displayStatus(item.status)}</DetailRow>
          <DetailRow label="Opened">{formatDateTime(item.openedAt)}</DetailRow>
          <DetailRow label="Expires">{formatDateTime(item.expiresAt)}</DetailRow>
          {item.claimedAt && <DetailRow label="Claimed">{formatDateTime(item.claimedAt)}</DetailRow>}
          {item.rarityLabel && <DetailRow label="Rarity">{item.rarityLabel}</DetailRow>}
          {item.tokenId && (
            <DetailRow label="Token ID">
              <span className="font-mono text-xs">{item.tokenId}</span>
            </DetailRow>
          )}
          {item.contractAddress && (
            <DetailRow label="Contract">
              <a
                href={monadExplorerAddressUrl(item.contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-mp-violet-bright hover:underline"
              >
                {truncateAddress(item.contractAddress)}
              </a>
            </DetailRow>
          )}
          {item.transactionHash && (
            <DetailRow label="Transaction">
              <a
                href={monadExplorerTxUrl(item.transactionHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-mp-violet-bright hover:underline"
              >
                {truncateAddress(item.transactionHash, 8)}
              </a>
            </DetailRow>
          )}
        </dl>

        <Button variant="secondary" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </DialogSheet>
  );
}
