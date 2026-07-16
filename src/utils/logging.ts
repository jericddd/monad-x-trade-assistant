export type LogContext = Record<string, string | number | boolean | undefined>;

export function logInfo(event: string, context: LogContext = {}): void {
  console.log(JSON.stringify({ level: "info", event, ...context }));
}

export function logError(event: string, context: LogContext = {}): void {
  console.error(JSON.stringify({ level: "error", event, ...context }));
}

export function logWarn(event: string, context: LogContext = {}): void {
  console.warn(JSON.stringify({ level: "warn", event, ...context }));
}
