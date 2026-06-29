/**
 * エラー報告ヘルパー (2026-06-29 ・ 直接POST方式へ切替)
 *
 * 背景: Next.js 16 のサーバーレス環境では Sentry SDK の captureException が
 *   送信前にプロセス終了で取りこぼされ、ダッシュボードに届かないことを実機確認
 *   (SDK経由の [diag] が着弾せず、唯一「直接POST」だけ着弾した)。
 *
 * 対策: SDK を介さず Sentry の取り込みエンドポイントへ直接 HTTP POST する。
 *   await で送信完了を待つため、サーバーレスでも取りこぼさない。
 *
 * 送信先は NEXT_PUBLIC_SENTRY_DSN から導出 (DSN は元々ブラウザ公開される値)。
 */

type Dsn = { key: string; host: string; projectId: string };

function parseDsn(dsn: string): Dsn | null {
  // https://<publicKey>@<host>/<projectId>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!m) return null;
  return { key: m[1], host: m[2], projectId: m[3] };
}

function eventId(): string {
  try {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  } catch {
    // フォールバック (衝突しても監視用途なので許容)
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }
}

async function postEvent(payload: Record<string, unknown>): Promise<void> {
  // dev ノイズ回避: 本番のみ送信 (DSN が無ければ何もしない)
  if (process.env.NODE_ENV !== "production") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const p = parseDsn(dsn);
  if (!p) return;

  const url = `https://${p.host}/api/${p.projectId}/store/?sentry_key=${p.key}&sentry_version=7`;
  const body = JSON.stringify({
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: "node",
    environment:
      process.env.VERCEL_ENV ??
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      "production",
    server_name: "vercel-server",
    ...payload,
  });

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

export async function reportError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const err =
      error instanceof Error ? error : new Error(String(error));
    await postEvent({
      level: "error",
      exception: {
        values: [
          {
            type: err.name || "Error",
            value: err.message,
          },
        ],
      },
      extra: {
        ...(context ?? {}),
        stack: err.stack ?? null,
      },
    });
  } catch {
    // 監視の失敗で本処理を巻き込まない
  }
}

export async function reportMessage(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await postEvent({
      level: "info",
      message,
      extra: context ?? {},
    });
  } catch {
    // noop
  }
}
