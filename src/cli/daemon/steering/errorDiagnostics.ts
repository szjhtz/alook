/**
 * Runtime error diagnostics — classify a runtime failure into a stable class
 * and reason, decide whether it needs user action (re-auth), and build a
 * scrubbed telemetry envelope.
 *
 * Classification priority:
 *   1. An explicit `XxxError` / `XxxException` token in the message.
 *   2. HTTP status code (429/401/403/404/5xx/other 4xx).
 *   3. Text-pattern regexes (rate limit, timeout, connection, …).
 *   4. Fallback: `RuntimeError`.
 */

export type ErrorClass =
  | "RateLimitError"
  | "AuthError"
  | "NotFoundError"
  | "ModelConfigError"
  | "TimeoutError"
  | "ProviderConnectionError"
  | "ProviderStreamError"
  | "ProviderServerError"
  | "ProviderApiError"
  | "RuntimeError";

export type ErrorAction = "retry" | "retry_backoff" | "retry_jitter" | "abort" | "report";

export interface ClassifiedError {
  errorClass: ErrorClass;
  action: ErrorAction;
  reason: string;
}

const ACTION_BY_CLASS: Record<ErrorClass, ErrorAction> = {
  RateLimitError: "retry_backoff",
  AuthError: "abort",
  NotFoundError: "report",
  ModelConfigError: "abort",
  TimeoutError: "retry",
  ProviderConnectionError: "retry_jitter",
  ProviderStreamError: "retry",
  ProviderServerError: "retry",
  ProviderApiError: "report",
  RuntimeError: "report",
};

const EXPLICIT_TOKEN_RE = /\b([A-Z][A-Za-z0-9_]*(?:Error|Exception))\b/;

const EXPLICIT_TOKEN_MAP: Record<string, ErrorClass> = {
  RateLimitError: "RateLimitError",
  TooManyRequestsError: "RateLimitError",
  AuthenticationError: "AuthError",
  AuthorizationError: "AuthError",
  PermissionError: "AuthError",
  NotFoundError: "NotFoundError",
  ModelNotFoundError: "ModelConfigError",
  TimeoutError: "TimeoutError",
  ConnectionError: "ProviderConnectionError",
  APIConnectionError: "ProviderConnectionError",
  StreamError: "ProviderStreamError",
  InternalServerError: "ProviderServerError",
  APIError: "ProviderApiError",
  BadRequestError: "ProviderApiError",
};

export function extractHttpStatus(message: string): number | null {
  const labeled = /\b(?:HTTP|status(?:\s+code)?|API\s+Error)[:\s]+([45]\d{2})\b/i.exec(message);
  if (labeled) return Number(labeled[1]);
  const semantic = /\b([45]\d{2})\s+(?:Unauthorized|Forbidden|Not Found|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout)\b/i.exec(
    message,
  );
  return semantic ? Number(semantic[1]) : null;
}

export const AUTH_ACTION_REQUIRED_PATTERNS: RegExp[] = [
  /access token could not be refreshed/i,
  /\btoken_(?:revoked|invalidated)\b/i,
  /refresh token was already used/i,
  /access token.*invalidated/i,
  /authentication token has been invalidated/i,
  /logged out or signed in to another account/i,
  /not logged in/i,
  /not signed in/i,
  /login required/i,
  /log in first/i,
  /please log in/i,
  /authentication failed/i,
  /auth(?:entication)? failed/i,
  /authentication timed out/i,
  /missing (?:api )?token/i,
  /no (?:api )?token/i,
  /missing credentials/i,
  /credentials? not found/i,
  /invalid api key/i,
  /api key (?:is )?not set/i,
  /token revoked/i,
  /refresh token expired/i,
  /session expired/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid.?token/i,
];

const RATE_LIMIT_PATTERNS = [
  /too many requests/i,
  /rate.?limit/i,
  /quota.?exceeded/i,
  /overloaded/i,
];

const MODEL_CONFIG_PATTERNS = [
  /model.?not.?(?:found|supported|available)/i,
  /invalid.?model/i,
  /does not exist/i,
];

const TIMEOUT_PATTERNS = [
  /timeout/i,
  /ETIMEDOUT/,
  /timed.?out/i,
  /deadline.?exceeded/i,
];

const CONNECTION_PATTERNS = [
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ENETUNREACH/,
  /EHOSTUNREACH/,
  /EAI_AGAIN/,
  /ENOTFOUND/,
  /connection.?refused/i,
  /connection.?reset/i,
  /network.?error/i,
  /Unable to connect to API/i,
];

const STREAM_PATTERNS = [
  /stream.?error/i,
  /stream closed before response/i,
  /error decoding response body/i,
  /premature.?close/i,
  /aborted/i,
];

const SERVER_PATTERNS = [
  /internal.?server/i,
  /bad.?gateway/i,
  /service.?unavailable/i,
];

function classifyByExplicitToken(message: string): ErrorClass | null {
  const match = EXPLICIT_TOKEN_RE.exec(message);
  if (!match) return null;
  const token = match[1];
  return EXPLICIT_TOKEN_MAP[token] ?? null;
}

function classifyByHttpStatus(httpStatus: number): ErrorClass {
  if (httpStatus === 429) return "RateLimitError";
  if (httpStatus === 401 || httpStatus === 403) return "AuthError";
  if (httpStatus === 404) return "NotFoundError";
  if (httpStatus >= 500) return "ProviderServerError";
  return "ProviderApiError";
}

function classifyByTextPatterns(message: string): ErrorClass | null {
  for (const pat of RATE_LIMIT_PATTERNS) {
    if (pat.test(message)) return "RateLimitError";
  }
  for (const pat of AUTH_ACTION_REQUIRED_PATTERNS) {
    if (pat.test(message)) return "AuthError";
  }
  for (const pat of MODEL_CONFIG_PATTERNS) {
    if (pat.test(message)) return "ModelConfigError";
  }
  for (const pat of TIMEOUT_PATTERNS) {
    if (pat.test(message)) return "TimeoutError";
  }
  for (const pat of CONNECTION_PATTERNS) {
    if (pat.test(message)) return "ProviderConnectionError";
  }
  for (const pat of STREAM_PATTERNS) {
    if (pat.test(message)) return "ProviderStreamError";
  }
  for (const pat of SERVER_PATTERNS) {
    if (pat.test(message)) return "ProviderServerError";
  }
  return null;
}

export function classifyRuntimeError(message: string, httpStatus?: number | null): ClassifiedError {
  // 1. Explicit Error/Exception token
  const byToken = classifyByExplicitToken(message);
  if (byToken) {
    return { errorClass: byToken, action: ACTION_BY_CLASS[byToken], reason: message };
  }

  // 2. HTTP status code
  const status = httpStatus ?? extractHttpStatus(message);
  if (status !== null && status !== undefined) {
    const cls = classifyByHttpStatus(status);
    return { errorClass: cls, action: ACTION_BY_CLASS[cls], reason: message };
  }

  // 3. Text patterns
  const byPattern = classifyByTextPatterns(message);
  if (byPattern) {
    return { errorClass: byPattern, action: ACTION_BY_CLASS[byPattern], reason: message };
  }

  // 4. Fallback
  return { errorClass: "RuntimeError", action: "report", reason: message };
}

/**
 * Redact sensitive data from diagnostic text for safe logging/telemetry.
 * Redacts: API tokens, emails, URL credentials, file paths with home dirs.
 */
export function scrubDiagnosticText(text: string): string {
  let scrubbed = text;

  // API tokens
  scrubbed = scrubbed.replace(/sk-ant-[a-zA-Z0-9_-]+/g, "sk-ant-***");
  scrubbed = scrubbed.replace(/sk-proj-[a-zA-Z0-9_-]+/g, "sk-proj-***");
  scrubbed = scrubbed.replace(/sk-[a-zA-Z0-9_-]{20,}/g, "sk-***");
  scrubbed = scrubbed.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer ***");

  // Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***.***");

  // URL credentials (user:pass@host)
  scrubbed = scrubbed.replace(/:\/\/[^:@\s]+:[^@\s]+@/g, "://***:***@");

  // Home directory paths
  scrubbed = scrubbed.replace(/\/(?:Users|home)\/[a-zA-Z0-9._-]+/g, "/***");

  return scrubbed;
}
