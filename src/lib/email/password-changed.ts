import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * パスワード変更 通知メール (2026-06-18 線① #3-b)
 *
 * - 本人宛: 「パスワードが変更されました」 セキュリティ通知 (= email_notification_enabled に関係なく送る)
 * - admin 宛: 「○○ さんがパスワードを変更しました」 (admin_users.is_active=true 全員)
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

    const occurredAt = new Date();
    const occurredAtJst = formatJst(occurredAt);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "https://juku.norifitness.com";

    // ① 本人宛
    await sendToUser({
      to: user.email,
      name: user.name ?? "受講生",
      occurredAtJst,
      siteUrl,
    });

    // ② admin 全員宛
    const { data: admins } = await supabase
      .from("admin_users")
      .select("id, email, name")
      .eq("is_active", true);
    if (admins && admins.length > 0) {
      const adminUrl = `${siteUrl}/admin/users/${user.id}`;
      await Promise.all(
        admins.map((a) =>
          sendToAdmin({
            to: a.email,
            adminName: a.name ?? "管理者",
            userName: user.name ?? "(氏名未設定)",
            userEmail: user.email,
            occurredAtJst,
            adminUrl,
          })
        )
      );
    }

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
  return f.format(d).replace(/\//g, "/");
}

async function sendToUser(params: {
  to: string;
  name: string;
  occurredAtJst: string;
  siteUrl: string;
}) {
  const subject = "パスワードを変更しました ・ のりfitness 筋肉塾";

  const text = [
    `${params.name} 様`,
    ``,
    `のりfitness 筋肉塾です。`,
    ``,
    `あなたのアカウントのパスワードが変更されました。`,
    ``,
    `変更日時: ${params.occurredAtJst}`,
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
        ${escapeHtml(params.name)} 様<br><br>
        あなたのアカウントのパスワードが変更されました。
      </p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #555;">
        <div><strong>変更日時:</strong> <span style="font-family: ui-monospace, monospace;">${params.occurredAtJst}</span></div>
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
    to: params.to,
    subject,
    text,
    html,
  });
}

async function sendToAdmin(params: {
  to: string;
  adminName: string;
  userName: string;
  userEmail: string;
  occurredAtJst: string;
  adminUrl: string;
}) {
  const subject = `[セキュリティ通知] ${params.userName} さんがパスワードを変更しました`;

  const text = [
    `${params.adminName} 様`,
    ``,
    `受講生がパスワードを変更しました。`,
    ``,
    `氏名: ${params.userName}`,
    `メール: ${params.userEmail}`,
    `変更日時: ${params.occurredAtJst}`,
    ``,
    `▼ 受講生ハブ画面`,
    `${params.adminUrl}`,
    ``,
    `--`,
    `※ このメールは admin_users (is_active=true) 全員に送信しています。`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
      <div style="background: #fef3c7; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 18px;">
        <div style="font-size: 11px; color: #92400e; font-weight: 700; letter-spacing: 2px;">セキュリティ通知</div>
        <div style="font-size: 15px; color: #78350f; font-weight: 700; margin-top: 6px;">受講生がパスワードを変更しました</div>
      </div>
      <p style="font-size: 14px; color: #333; line-height: 1.7;">
        ${escapeHtml(params.adminName)} 様
      </p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #555; line-height: 1.8;">
        <div><strong>氏名:</strong> ${escapeHtml(params.userName)}</div>
        <div><strong>メール:</strong> <span style="font-family: ui-monospace, monospace;">${escapeHtml(params.userEmail)}</span></div>
        <div><strong>変更日時:</strong> <span style="font-family: ui-monospace, monospace;">${params.occurredAtJst}</span></div>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${params.adminUrl}"
           style="display: inline-block; background: #00897b; color: white; text-decoration: none; font-weight: 700; padding: 10px 26px; border-radius: 999px; font-size: 13px;">
          受講生ハブ画面を開く →
        </a>
      </div>
      <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 24px;">
        ※ このメールは admin_users (is_active=true) 全員に送信しています。
      </div>
    </div>
  `.trim();

  const resend = getResendClient();
  await resend.emails.send({
    from: getFromEmail(),
    to: params.to,
    subject,
    text,
    html,
  });
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
