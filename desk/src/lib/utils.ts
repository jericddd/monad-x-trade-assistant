import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict, intervalToDuration } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  return distance
    .replace(" seconds", "s")
    .replace(" second", "s")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .concat(" ago");
}

export function formatTimeRemaining(expiresAt: Date, now = new Date()): string {
  if (expiresAt <= now) return "0";
  const duration = intervalToDuration({ start: now, end: expiresAt });
  const parts: string[] = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes !== undefined) parts.push(`${duration.minutes}m`);
  if (!duration.days && !duration.hours && duration.seconds !== undefined) {
    parts.push(`${duration.seconds}s`);
  }
  return parts.join(" ") || "0";
}

export function displayStatus(status: string): string {
  switch (status) {
    case "UNCLAIMED":
      return "Unclaimed";
    case "CLAIMED":
      return "Claimed";
    case "EXPIRED":
      return "Expired";
    case "CLAIMING":
      return "Claiming";
    default:
      return status;
  }
}

/** Card name + pack display number without duplicating `#57` when name already includes it. */
export function formatCardLabel(name: string, displayNumber: number): string {
  const base = name.replace(/\s*#\d+\s*$/, "").trim();
  return `${base} #${displayNumber}`;
}
