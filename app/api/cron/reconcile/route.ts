import { createHash, timingSafeEqual } from "node:crypto";
import { chargesRuntime, reconcileOnSchedule } from "@/features/charges";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares the caller's header with the secret in constant time, so timing reveals nothing. */
function hasSecret(request: Request, secret: string): boolean {
  const given = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

/**
 * Reconciles on demand for an external scheduler (GitHub Actions every 15 minutes), since the
 * Vercel Hobby plan runs crons at most once a day. Off until CRON_SECRET is set.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!hasSecret(request, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  await reconcileOnSchedule(chargesRuntime().feature, console);
  return Response.json({ ok: true });
}
