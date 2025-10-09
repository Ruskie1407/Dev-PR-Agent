import crypto from "node:crypto";

// Accept multiple possible env var names (any one is fine)
const TOKEN =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  process.env.GH_FINEGRAINED_TOKEN ||
  "";

export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
export const GITHUB_TOKEN = TOKEN;

export function verifySignature(raw: string, sigHeader: string | null): boolean {
  if (!WEBHOOK_SECRET || !sigHeader) return false;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sigHeader));
  } catch {
    return false;
  }
}

export async function ghFetch(path: string, init: RequestInit = {}) {
  if (!GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "dev-pr-agent",
      ...(init.headers || {}),
    },
  });
}
