/**
 * ログイン連続失敗の記録 + 管理者通知 (D-2 ・ 2026-06-29)
 *
 * - recordLoginFailure: signIn 失敗時に呼ぶ。email 単位で失敗を数え、
 *   閾値(=5)に達したら管理者へ通知メール (再通知は間引く)。
 * - clearLoginFailures: ログイン成功時に呼んでリセット。
 *
 * 失敗しても本処理(ログイン)を絶対に巻き込まないよう全て try/catch。
 * 書き込みは service role (createAdminClient) で行う (= 未認証コンテキストのため)。
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginFailureAlert } from "@/lib/email/login-failure-alert";

const THRESHOLD = 5; // 連続失敗の通知閾値
const WINDOW_MS = 30 * 60 * 1000; // この時間 失敗が空けばカウントリセット
const RENOTIFY_MS = 60 * 60 * 1000; // 同一 email への再通知を抑制する間隔

export async function recordLoginFailure(rawEmail: string): Promise<void> {
  try {
    const email = rawEmail.toLowerCase().trim();
    if (!email.includes("@")) return;

    const admin = createAdminClient();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const { data: row } = await admin
      .from("login_attempts")
      .select("failed_count, first_failed_at, notified_at")
      .eq("email", email)
      .maybeSingle();

    let failedCount: number;
    let firstFailedAt: string;
    let notifiedAt: string | null;

    const r = row as
      | { failed_count: number; first_failed_at: string | null; notified_at: string | null }
      | null;

    if (!r || !r.first_failed_at || now - new Date(r.first_failed_at).getTime() > WINDOW_MS) {
      // 新しい失敗ウィンドウを開始
      failedCount = 1;
      firstFailedAt = nowIso;
      notifiedAt = null;
    } else {
      failedCount = r.failed_count + 1;
      firstFailedAt = r.first_failed_at;
      notifiedAt = r.notified_at;
    }

    let doNotify = false;
    if (failedCount >= THRESHOLD) {
      if (!notifiedAt || now - new Date(notifiedAt).getTime() > RENOTIFY_MS) {
        doNotify = true;
        notifiedAt = nowIso;
      }
    }

    await admin.from("login_attempts").upsert(
      {
        email,
        failed_count: failedCount,
        first_failed_at: firstFailedAt,
        last_failed_at: nowIso,
        notified_at: notifiedAt,
      },
      { onConflict: "email" }
    );

    if (doNotify) {
      await sendLoginFailureAlert({
        email,
        failedCount,
        lastFailedAt: nowIso,
      });
    }
  } catch (e) {
    console.error("recordLoginFailure error:", e);
  }
}

export async function clearLoginFailures(rawEmail: string): Promise<void> {
  try {
    const email = rawEmail.toLowerCase().trim();
    const admin = createAdminClient();
    await admin.from("login_attempts").delete().eq("email", email);
  } catch (e) {
    console.error("clearLoginFailures error:", e);
  }
}
