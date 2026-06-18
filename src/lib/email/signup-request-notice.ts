import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 新規入会申請 admin 宛通知メール (2026-06-18 線① A-1 ・ Q1 採用分)
 *
 * - 受講生が /request から申請完了の瞬間に発火
 * - 全 active admin (admin_users.is_active=true) に bcc で 1 通送信
 * - エラーは throw せず log のみ (submitSignupRequest の主処理を止めない)
 * - Push (sendPushToAllAdmins) は同時に発火する設計、 メールは記録として補完
 *
 * 起動元: src/app/request/actions.ts:submitSignupRequest
 */
export async function sendSignupRequestNoticeToAdmins(input: {
  name: string;
  email: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = createAdminClient();
    const { data: admins } = await supabase
      .from("admin_users")
      .select("email")
      .eq("is_active", true);
    if (!admins || admins.length === 0) {
      return { sent: false, reason: "no active admins" };
    }
    const toList = admins
      .map((a) => (a as { email?: string | null }).email)
      .filter((e): e is string => !!e);
    if (toList.length === 0) {
      return { sent: false, reason: "no admin emails" };
    }

    const subject = `[筋肉塾] 新規入会申請: ${input.name} さん`;
    const occurredAtJst = formatJst(new Date());

    const text = [
      `のりfitness 筋肉塾です。`,
      ``,
      `受講生申請フォームから新規申請がありました。`,
      ``,
      `氏名: ${input.name}`,
      `メール: ${input.email}`,
      `受信: ${occurredAtJst}`,
      ``,
      `管理画面で承認 → 招待マジックリンク発行をお願いします。`,
      `URL: https://juku.norifitness.com/admin/invitations`,
      ``,
      `--`,
      `※ このメールは管理者全員に送信されています。`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: #e0f2f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 17px; color: #004d40; font-weight: 700; margin-top: 6px;">新規入会申請</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          受講生申請フォームから新規申請がありました。
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #555; line-height: 1.8;">
          <div><strong>氏名:</strong> ${escapeHtml(input.name)}</div>
          <div><strong>メール:</strong> ${escapeHtml(input.email)}</div>
          <div><strong>受信:</strong> <span style="font-family: ui-monospace, monospace;">${occurredAtJst}</span></div>
        </div>
        <p style="font-size: 13px; color: #555; line-height: 1.7; margin: 18px 0 6px;">
          管理画面で承認 → 招待マジックリンク発行をお願いします。
        </p>
        <a href="https://juku.norifitness.com/admin/invitations" style="display: inline-block; background: #00897b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700;">招待管理画面を開く →</a>
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
    console.error("sendSignupRequestNoticeToAdmins error:", e);
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "unknown error",
    };
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
