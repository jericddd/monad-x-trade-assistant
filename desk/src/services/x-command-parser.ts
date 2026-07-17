/**
 * Strict X command parser for Monad Packs.
 * Only exact "open pack" command is accepted (after bot mention stripping).
 */
export function parseXCommand(text: string): "open pack" | "catch" | null {
  const normalized = text
    .toLowerCase()
    .replace(/@\w+/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized === "open pack") return "open pack";
  if (normalized === "catch" || normalized.startsWith("catch ")) return "catch";
  return null;
}

export function routeXCommand(text: string): "MONAD_PACKS" | "MONEX" | null {
  const command = parseXCommand(text);
  if (command === "open pack") return "MONAD_PACKS";
  if (command === "catch") return "MONEX";
  return null;
}
