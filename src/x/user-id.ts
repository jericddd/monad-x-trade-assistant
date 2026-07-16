export function normalizeNumericUserId(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is not configured`);
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a numeric user id`);
  }

  return trimmed;
}

export function normalizeOptionalNumericUserId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}
