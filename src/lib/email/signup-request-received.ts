import { getResendClient, getFromEmail } from "./resend";

/**
 * 新規入会申請 受領通知メール (申請者本人宛 ・ 2026-06-19 線① B-2)
 *
 * - /request 申請完了の瞬間に発火 (= A-1 admin 通知と同タイミング、 別宛先)
 * - 「申請を受け付けました、 確認後ご連絡します」 のシンプルな受領確認
 * - エラーは throw せず log のみ (submitSignupRequest の主処理を止めない)
 *
 * 起動元: src/app/request/actions.ts:submitSignupRequest
 */
export async function sendSignupRequestReceivedEmail(input: {
  name: string;
  email: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const subject = "ご応募ありがとうございます ・ のりfitness 筋肉塾";
    const occurredAtJst = formatJst(new Date());

    const text = [
      `${input.name} 様`,
      ``,
      `のりfitness 筋肉塾です。`,
      ``,
      `この度はご応募いただき、 誠にありがとうございます。`,
      `下記の内容で申請を受け付けました。`,
      ``,
      `氏名: ${input.name}`,
      `メールアドレス: ${input.email}`,
      `受付日時: ${occurredAtJst}`,
      ``,
      `確認後、 担当者よりご連絡いたします。`,
      `しばらくお待ちください。`,
      ``,
      `■ ご不明な点があれば`,
      `公式 LINE までお気軽にお問い合わせください。`,
      ``,
      `--`,
      `※ このメールは応募受領のお知らせです。 ご返信は不要です。`,
      `※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #e0f2f1 0%, #fffbe6 100%); border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 18px; color: #004d40; font-weight: 700; margin-top: 8px;">ご応募ありがとうございます</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          ${escapeHtml(input.name)} 様<br><br>
          この度はご応募いただき、 誠にありがとうございます。<br>
          下記の内容で申請を受け付けました。
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-size: 13px; color: #555; line-height: 1.9;">
          <div><strong>氏名:</strong> ${escapeHtml(input.name)}</div>
          <div><strong>メール:</strong> ${escapeHtml(input.email)}</div>
          <div><strong>受付日時:</strong> <span style="font-family: ui-monospace, monospace;">${occurredAtJst}</span></div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          確認後、 担当者よりご連絡いたします。<br>
          しばらくお待ちください。
        </p>
        <div style="background: #fffbe6; border: 1px solid rgba(255,235,59,0.55); border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #6b5f1a; line-height: 1.7;">
          <strong>ご不明な点があれば</strong><br>
          公式 LINE までお気軽にお問い合わせください。
        </div>
        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          ※ このメールは応募受領のお知らせです。 ご返信は不要です。<br>
          ※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)
        </div>
      </div>
    `.trim();

    const resend = getResendClient();
    await resend.emails.send({
      from: getFromEmail(),
      to: input.email,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (e) {
    console.error("sendSignupRequestReceivedEmail error:", e);
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
