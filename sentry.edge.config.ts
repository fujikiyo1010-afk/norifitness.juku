/**
 * Sentry Edge (= middleware / edge runtime) Config (2026-06-19 線① D-β)
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",
    enabled: process.env.NODE_ENV === "production",
  });
}
