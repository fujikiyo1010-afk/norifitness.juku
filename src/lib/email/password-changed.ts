import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * パスワード変更 通知メール (2026-06-18 線① #3-b)
 *
 * - 本人宛のみ送信 (= セキュリティ通知 = email_notification_enabled に関係なく送る)
 * - admin 宛は noise になるので送らない (2026-06-18 きよむさん確定)
 * - エラーは throw せずログのみ (updatePassword の主処理を止めない)
 *
 * 起動元: src/lib/account/actions.ts:updatePassword
 */
export async function sendPasswordChangedEmail(
  userId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!user) return { sent: false, reason: "user not found" };

    const occurredAtJst = formatJst(new Date());

    const name = user.name ?? "受講生";
    const subject = "パスワードを変更しました ・ のりfitness 筋肉塾";

    const text = [
      `${name} 様`,
      ``,
      `のりfitness 筋肉塾です。`,
      ``,
      `あなたのアカウントのパスワードが変更されました。`,
      ``,
      `変更日時: ${occurredAtJst}`,
      ``,
      `もしご自身による変更でない場合、 第三者による不正アクセスの可能性があります。`,
      `至急 LINE またはメールでサポート (${supportEmail()}) までご連絡ください。`,
      ``,
      `--`,
      `※ このメールはセキュリティ通知のため、 メール通知 OFF の方にも送信しています。`,
      `※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: #e0f2f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 17px; color: #004d40; font-weight: 700; margin-top: 6px;">パスワードを変更しました</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          ${escapeHtml(name)} 様<br><br>
          あなたのアカウントのパスワードが変更されました。
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #555;">
          <div><strong>変更日時:</strong> <span style="font-family: ui-monospace, monospace;">${occurredAtJst}</span></div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #991b1b; line-height: 1.6;">
          <strong>もしご自身による変更でない場合</strong><br>
          第三者による不正アクセスの可能性があります。 至急 LINE またはメールでサポート (<a href="mailto:${supportEmail()}" style="color: #991b1b;">${supportEmail()}</a>) までご連絡ください。
        </div>
        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          ※ このメールはセキュリティ通知のため、 メール通知 OFF の方にも送信しています。<br>
          ※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)
        </div>
      </div>
    `.trim();

    const resend = getResendClient();
    await resend.emails.send({
      from: getFromEmail(),
      to: user.email,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (e) {
    console.error("sendPasswordChangedEmail error:", e);
    return { sent: false, reason: e instanceof Error ? e.message : "unknown error" };
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

function supportEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? "noreply@norifitness.com";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
