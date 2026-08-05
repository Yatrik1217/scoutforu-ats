// Lightweight in-memory rate limiter for public (unauthenticated) endpoints.
// The ATS runs as a single pm2 process, so a per-process Map is sufficient.
// If the app is ever scaled to multiple instances, move this to a shared store
// (e.g. Redis) so limits are enforced across processes.

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Occasional cleanup so the Map can't grow unbounded under abuse.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

// Best-effort client IP behind nginx (which sets x-forwarded-for / x-real-ip).
export function ipFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
