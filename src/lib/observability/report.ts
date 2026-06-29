/**
 * エラー報告ヘルパー (2026-06-29 監視の穴ふさぎ)
 *
 * 目的: アプリ内で「想定内だが起きてはいけない失敗」(= catch して {ok:false} で
 *   返すような失敗) を Sentry に確実に送る。Server Action / API route 用。
 *
 * なぜ flush するか:
 *   サーバーレス環境は処理完了で即終了するため、captureException だけだと
 *   送信前にプロセスが落ちて取りこぼす。await flush で送信完了を待ってから返す。
 */
import * as Sentry from "@sentry/nextjs";

export async function reportError(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
    // 送信完了を最大2秒待つ (= サーバーレスでの取りこぼし防止)
    await Sentry.flush(2000);
  } catch {
    // 監視の失敗で本処理を巻き込まない
  }
}

/** 任意メッセージ(非例外)を送る。重要イベントの可視化用。 */
export async function reportMessage(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    Sentry.captureMessage(message, context ? { extra: context } : undefined);
    await Sentry.flush(2000);
  } catch {
    // noop
  }
}
