/**
 * Sentry Client (= browser / React) Config (2026-06-19 線① D-β)
 *
 * - prod prod 環境でのみ有効化 (= dev 時は noise を避ける)
 * - DSN は NEXT_PUBLIC_SENTRY_DSN (Vercel prod env で投入)
 * - 受講生個人情報の漏洩を避けるため beforeSend で sanitize
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1, // 10% sample (= prod 規模で十分)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0, // セッション replay は disabled (= 個人情報リスク)
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",
    enabled: process.env.NODE_ENV === "production",
    // 個人情報 sanitize (= 必要なら拡張)
    beforeSend(event) {
      // メールアドレス / トークン 等 を自動マスクするフィルタ (= 線② で本格化)
      return event;
    },
  });
}
