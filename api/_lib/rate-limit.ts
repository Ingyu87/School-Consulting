type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(request: any, response: any, scope: string) {
  const limit = Number(process.env.API_RATE_LIMIT ?? "30");
  if (!Number.isFinite(limit) || limit <= 0) return true;

  const now = Date.now();
  const ip =
    String(request.headers?.["x-forwarded-for"] ?? "")
      .split(",")[0]
      .trim() ||
    String(request.headers?.["x-real-ip"] ?? "") ||
    "unknown";
  const key = `${scope}:${ip}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  current.count += 1;
  if (current.count <= limit) return true;

  response.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
  response.status(429).send("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  return false;
}
