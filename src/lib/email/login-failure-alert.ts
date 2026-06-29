import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ログイン連続失敗アラート (admin 宛 ・ 2026-06-29 D-2)
 *
 * - signIn が連続 N 回失敗した email について、管理者全員へ 1 通通知
 * - 困っている受講生に先回りで気付くのが目的 (= ハードロックはしない)
 * - エラーは throw せず log のみ (ログイン本処理を巻き込まない)
 */
export type LoginFailureAlertResult =
  | { sent: true }
  | { sent: false; reason: string };

export async function sendLoginFailureAlert(input: {
  email: string;
  failedCount: number;
  lastFailedAt: string;
}): Promise<LoginFailureAlertResult> {
  try {
    const supabase = createAdminClient();

    const { data: admins } = await supabase
      .from("admin_users")
      .select("email")
      .eq("is_active", true);
    const toList = (admins ?? [])
      .map((a) => (a as { email?: string | null }).email)
      .filter((e): e is string => !!e);
    if (toList.length === 0) {
      return { sent: false, reason: "no admin emails" };
    }

    // 該当 email が登録ユーザーかどうか (= 本人が困っている vs 不審アクセス の判断材料)
    const { data: matchedUser } = await supabase
      .from("users")
      .select("name")
      .eq("email", input.email)
      .maybeSingle();
    const known = !!matchedUser;
    const userName = (matchedUser as { name?: string | null } | null)?.name ?? null;

    const occurredAtJst = formatJst(new Date(input.lastFailedAt));
    const who = userName ? `${userName} さん (${input.email})` : input.email;
    const subject = `[筋肉塾] ログイン失敗アラート: ${input.email} で ${input.failedCount} 回連続失敗`;

    const text = [
      `のりfitness 筋肉塾 ログイン失敗アラート`,
      ``,
      `${who} のアカウントで ${input.failedCount} 回連続のログイン失敗を検知しました。`,
      known
        ? `→ 登録済みの受講生です。パスワードを忘れている可能性があります。`
        : `→ 登録ユーザーと一致しないメールです。不審なアクセスの可能性があります。`,
      ``,
      `最終失敗: ${occurredAtJst}`,
      ``,
      `■ 対応の目安`,
      known
        ? `本人なら、ログイン画面の「パスワードを忘れた方」から再設定を案内してください。`
        : `心当たりがなければ静観で問題ありません (Supabase 側で連続失敗は自動制限されます)。`,
      ``,
      `--`,
      `※ このメールは管理者全員に送信されています。`,
    ].join("\n");

    const accent = known ? "#92400e" : "#991b1b";
    const bg = known ? "#fffbeb" : "#fef2f2";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 580px; margin: 0 auto; padding: 24px;">
        <div style="background: ${bg}; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: ${accent}; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 17px; color: ${accent}; font-weight: 700; margin-top: 8px;">ログイン失敗アラート</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          <strong>${escapeHtml(who)}</strong> のアカウントで <strong>${input.failedCount} 回</strong>連続のログイン失敗を検知しました。
        </p>
        <p style="font-size: 13px; color: #555; line-height: 1.7;">
          ${
            known
              ? "登録済みの受講生です。パスワードを忘れている可能性があります。"
              : "登録ユーザーと一致しないメールです。不審なアクセスの可能性があります。"
          }
        </p>
        <div style="font-size: 13px; color: #333; line-height: 1.8; background:#f8f8f8; border-radius:8px; padding:12px 16px; margin: 14px 0;">
          最終失敗: ${occurredAtJst}
        </div>
        <p style="font-size: 13px; color: #555; line-height: 1.7;">
          ${
            known
              ? "本人なら、ログイン画面の「パスワードを忘れた方」から再設定を案内してください。"
              : "心当たりがなければ静観で問題ありません (Supabase 側で連続失敗は自動制限されます)。"
          }
        </p>
        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          ※ このメールは管理者全員に送信されています。
        </div>
      </div>
    `.trim();

    const resend = getResendClient();
    await resend.emails.send({
      from: getFromEmail(),
      to: toList,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (e) {
    console.error("sendLoginFailureAlert error:", e);
    return { sent: false, reason: e instanceof Error ? e.message : "unknown" };
  }
}

function formatJst(d: Date): string {
  const f = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return f.format(d);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
