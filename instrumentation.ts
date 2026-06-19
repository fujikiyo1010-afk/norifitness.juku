/**
 * Next.js 16 / Sentry 10 ・ instrumentation hook
 * (= server + edge runtime での Sentry 初期化エントリ ・ 2026-06-19 D-β)
 *
 * - Node.js runtime → sentry.server.config.ts を読み込む
 * - Edge runtime → sentry.edge.config.ts を読み込む
 * - Client は 別経路 (= sentry.client.config.ts は自動 inject される)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
