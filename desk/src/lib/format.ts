import { format } from "date-fns";

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy · h:mm a");
}

export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function monadExplorerTxUrl(hash: string): string {
  return `https://monadvision.com/tx/${hash}`;
}

export function monadExplorerAddressUrl(address: string): string {
  return `https://monadvision.com/address/${address}`;
}
