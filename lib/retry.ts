/**
 * fetchWithRetry: exponential backoff + jitter
 * Retries on 429, 408, 425, and 5xx, and on network errors.
 * Honors Retry-After header when present.
 */
export type RetryOpts = {
  retries?: number;        // total attempts (including first) default 4
  baseDelayMs?: number;    // initial delay before 2nd try           300
  maxDelayMs?: number;     // cap the delay                           5000
  timeoutMs?: number;      // per-request timeout (AbortController)   30000
  onRetry?: (info: { attempt: number; delayMs: number; status?: number; error?: any }) => void;
};

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function computeDelay(attempt: number, base: number, max: number) {
  // attempt: 1 means first retry (2nd request)
  const exp = Math.min(max, base * Math.pow(2, attempt - 1));
  const jitter = Math.random() * 0.4 + 0.8; // 0.8x .. 1.2x
  return Math.min(max, Math.floor(exp * jitter));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: RetryOpts = {}
): Promise<Response> {
  const {
    retries = 4,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    timeoutMs = 30000,
    onRetry,
  } = opts;

  let lastErr: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...init, signal: ac.signal });
      clearTimeout(t);

      // Success path
      if (res.ok) return res;

      // Retryable statuses
      const retryable = [429, 408, 425];
      if ((res.status >= 500 && res.status <= 599) || retryable.includes(res.status)) {
        let delayMs = computeDelay(attempt + 1, baseDelayMs, maxDelayMs);

        // Honor Retry-After if provided
        const ra = res.headers.get("retry-after");
        if (ra) {
          const n = Number(ra);
          if (!Number.isNaN(n)) delayMs = Math.max(delayMs, n * 1000);
        }

        if (attempt < retries - 1) {
          onRetry?.({ attempt: attempt + 1, delayMs, status: res.status });
          await sleep(delayMs);
          continue;
        }
      }

      // Non-retryable
      return res;
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      // Network/timeout → retry
      if (attempt < retries - 1) {
        const delayMs = computeDelay(attempt + 1, baseDelayMs, maxDelayMs);
        onRetry?.({ attempt: attempt + 1, delayMs, error: e });
        await sleep(delayMs);
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("fetchWithRetry: exhausted retries");
}
