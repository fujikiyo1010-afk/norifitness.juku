import { getResendClient, getFromEmail } from "./resend";

/**
 * メールアドレス変更 ・旧メール宛通知 (2026-06-18 線① #8)
 *
 * 受講生が /account/email で「変更を申請」 した瞬間に、 旧メールに
 * 「変更要求があります、 心当たりなければ即連絡」 を送信。
 * 乗っ取り防止の最初の砦。
 *
 * - 確認メール (= Supabase が新メールに送る) はこの関数とは別系統
 * - エラーは throw せずログのみ (= 主処理を止めない)
 */
export async function sendEmailChangeRequestNotice(params: {
  oldEmail: string;
  newEmail: string;
  userName: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const subject = "メールアドレス変更の申請がありました ・のりfitness 筋肉塾";
    const occurredAtJst = formatJst(new Date());
    const supportEmail =
      process.env.RESEND_FROM_EMAIL ?? "noreply@norifitness.com";

    const text = [
      `${params.userName} 様`,
      ``,
      `のりfitness 筋肉塾です。`,
      ``,
      `あなたのアカウントで、 メールアドレス変更の申請が行われました。`,
      ``,
      `変更先 (= 新メール): ${params.newEmail}`,
      `申請日時: ${occurredAtJst}`,
      ``,
      `新メールアドレス宛に Supabase から確認リンクが届きます。`,
      `そのリンクをクリックすると変更が完了します。`,
      ``,
      `もしご自身による変更でない場合、 第三者による不正アクセスの可能性があります。`,
      `至急 LINE またはメールでサポート (${supportEmail}) までご連絡ください。`,
      `(確認リンクをクリックしなければ、 メールアドレスは現状のままです)`,
      ``,
      `--`,
      `※ このメールはセキュリティ通知のため、 メール通知 OFF の方にも送信しています。`,
      `※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: #e0f2f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 17px; color: #004d40; font-weight: 700; margin-top: 6px;">メールアドレス変更の申請がありました</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          ${escapeHtml(params.userName)} 様<br><br>
          あなたのアカウントで、 メールアドレス変更の申請が行われました。
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #555; line-height: 1.8;">
          <div><strong>変更先:</strong> <span style="font-family: ui-monospace, monospace;">${escapeHtml(params.newEmail)}</span></div>
          <div><strong>申請日時:</strong> <span style="font-family: ui-monospace, monospace;">${occurredAtJst}</span></div>
        </div>
        <p style="font-size: 13px; color: #555; line-height: 1.7;">
          新メールアドレス宛に Supabase から確認リンクが届きます。<br>
          そのリンクをクリックすると変更が完了します。
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #991b1b; line-height: 1.6;">
          <strong>もしご自身による変更でない場合</strong><br>
          第三者による不正アクセスの可能性があります。 至急 LINE またはメールでサポート (<a href="mailto:${supportEmail}" style="color: #991b1b;">${supportEmail}</a>) までご連絡ください。<br>
          <span style="font-size: 12px;">(確認リンクをクリックしなければ、 メールアドレスは現状のままです)</span>
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
      to: params.oldEmail,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (e) {
    console.error("sendEmailChangeRequestNotice error:", e);
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
