import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 月次添削 公開メール (2026-06-17 線① ・ メール作戦)
 *
 * のり氏が月次添削の動画を公開した瞬間に受講生にメール送信。
 * - 受講生の users.email_notification_enabled = false の人は送らない
 * - エラーは失敗 throw せずログのみ (upload finalize の主処理を止めない)
 *
 * 起動元: src/app/api/vimeo/upload/finalize/route.ts (公開 = 動画 upload 完了の瞬間)
 */

export async function sendMonthlyAuditPublishedEmail(
  auditId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: audit } = await supabase
      .from("monthly_audits")
      .select("id, user_id, target_month")
      .eq("id", auditId)
      .maybeSingle();
    if (!audit) return { sent: false, reason: "audit not found" };

    const { data: user } = await supabase
      .from("users")
      .select("name, email, email_notification_enabled")
      .eq("id", audit.user_id)
      .maybeSingle();
    if (!user) return { sent: false, reason: "user not found" };
    if (!user.email_notification_enabled) {
      return { sent: false, reason: "email_notification_enabled=false" };
    }

    const targetMonthLabel = audit.target_month.substring(0, 7).replace("-", "/");
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://juku.norifitness.com";
    const detailUrl = `${siteUrl}/monthly-review/detail/${audit.target_month}`;

    const subject = `${targetMonthLabel} 月次添削の返信が届きました ・ のりfitness 筋肉塾`;

    const text = [
      `${user.name} さん`,
      ``,
      `のりfitness 筋肉塾です。`,
      ``,
      `先日提出いただいた ${targetMonthLabel} の月次添削について、 のり氏から動画で返信が届きました。`,
      `下記のリンクから受講生ページにログインしてご視聴ください。`,
      ``,
      `▼ 添削動画を見る`,
      `${detailUrl}`,
      ``,
      `--`,
      `※ このメールは月次添削が公開された時点で自動送信されています。`,
      `※ メール通知を停止する場合は受講生ページの [設定 → 通知 → メール通知] でオフにできます。`,
      `※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: #e0f2f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 17px; color: #004d40; font-weight: 700; margin-top: 6px;">月次添削の返信が届きました</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          ${user.name} さん<br><br>
          先日提出いただいた <strong>${targetMonthLabel}</strong> の月次添削について、 のり氏から動画で返信が届きました。<br>
          下のボタンから受講生ページにログインしてご視聴ください。
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${detailUrl}"
             style="display: inline-block; background: #00897b; color: white; text-decoration: none; font-weight: 700; padding: 12px 32px; border-radius: 999px; font-size: 14px;">
            添削動画を見る →
          </a>
        </div>
        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          ※ このメールは月次添削が公開された時点で自動送信されています。<br>
          ※ メール通知を停止する場合は受講生ページの [設定 → 通知 → メール通知] でオフにできます。<br>
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
    console.error("sendMonthlyAuditPublishedEmail error:", e);
    return { sent: false, reason: e instanceof Error ? e.message : "unknown error" };
  }
}
