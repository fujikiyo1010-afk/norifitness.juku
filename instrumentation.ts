/**
 * Next.js 16 / Sentry 10 ・ instrumentation hook
 * (= server + edge runtime での Sentry 初期化エントリ ・ 2026-06-19 D-β)
 *
 * - Node.js runtime → sentry.server.config.ts を読み込む
 * - Edge runtime → sentry.edge.config.ts を読み込む
 * - Client は 別経路 (= sentry.client.config.ts は自動 inject される)
 */
import { reportError } from "@/lib/observability/report";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * 未処理エラー(サーバー側クラッシュ)の自動捕捉。
 * SDK の captureRequestError は serverless で取りこぼすため、直接POST方式の
 * reportError に置き換えている (2026-06-29 実機検証で SDK 不達を確認)。
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string }
) {
  await reportError(error, {
    where: "onRequestError",
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    routeType: context?.routeType,
  });
}
