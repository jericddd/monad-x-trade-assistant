const REDACT_KEYS = new Set([
  "authorization",
  "x_bearer_token",
  "x_api_secret",
  "x_access_token",
  "x_access_token_secret",
  "trade_wallet_private_key",
  "privatekey",
  "private_key",
]);

const REDACT_PATTERNS = [/0x[a-fA-F0-9]{64}/g, /Bearer\s+[A-Za-z0-9._-]+/gi];

export function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      return "[REDACTED]";
    }

    let sanitized = value;
    for (const pattern of REDACT_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactObject(entry));
  }

  if (value && typeof value === "object") {
    return redactObject(value as Record<string, unknown>);
  }

  return value;
}

export function redactObject<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = redactValue(key, value);
  }
  return output as T;
}
