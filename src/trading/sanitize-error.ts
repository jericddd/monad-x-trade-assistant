import { TradeError, type TradeErrorCode } from "./errors.js";

const SECRET_PATTERNS = [
  /private[_-]?key\s*=\s*0x[a-fA-F0-9]+/gi,
  /private[_-]?key/i,
  /bearer\s+[a-z0-9._-]+/i,
  /0x[a-fA-F0-9]{64}/g,
  /api[_-]?secret/i,
  /access[_-]?token/i,
];

export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized.replace(/0x[a-fA-F0-9]+/g, "[REDACTED]");
}

export function toSafePublicReason(error: unknown): string {
  if (error instanceof TradeError) {
    return error.safeMessage;
  }

  return "an internal error occurred";
}

export function toFailureCode(error: unknown): TradeErrorCode {
  if (error instanceof TradeError) {
    return error.code;
  }

  return "CONFIGURATION_ERROR";
}
