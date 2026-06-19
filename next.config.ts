import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry でラップ (= 2026-06-19 線① D-β)
// - NEXT_PUBLIC_SENTRY_DSN が未設定なら何もしない (= dev で安全)
// - prod でのみエラーが Sentry に送信される (= sentry.*.config.ts の enabled で制御)
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
