export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  requestId?: string,
  userId?: string
): void {
  if (path === "/health" || path === "/api/health") return;

  const attrs: Record<string, unknown> = {
    method,
    path,
    status,
    duration: `${durationMs}ms`,
  };
  if (requestId) attrs.request_id = requestId;
  if (userId) attrs.user_id = userId;

  if (status >= 500) console.error("http request", attrs);
  else if (status >= 400) console.warn("http request", attrs);
  else console.info("http request", attrs);
}
