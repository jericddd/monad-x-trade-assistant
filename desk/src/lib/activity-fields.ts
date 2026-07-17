import { displayStatus, formatCardLabel, formatRelativeTime, formatTimeRemaining } from "@/lib/utils";

export type ActivityItemFields = {
  xUsername: string;
  cardName: string;
  displayNumber: number;
  packName: string;
  source: "X" | "WEBSITE";
  openedAt: string;
  expiresAt: string;
  status: string;
};

function timeRemainingFor(item: ActivityItemFields): string {
  if (item.status === "CLAIMED") return "Done";
  if (item.status === "EXPIRED") return "0";
  return formatTimeRemaining(new Date(item.expiresAt));
}

/** Mobile activity card field coverage for accessibility/completeness */
export function getMobileActivityFields(item: ActivityItemFields) {
  return {
    user: item.xUsername,
    card: formatCardLabel(item.cardName, item.displayNumber),
    pack: item.packName,
    source: item.source,
    opened: formatRelativeTime(new Date(item.openedAt)),
    status: displayStatus(item.status),
    timeRemaining: timeRemainingFor(item),
  };
}
