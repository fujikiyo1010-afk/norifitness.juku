import { getResendClient, getFromEmail } from "./resend";

/**
 * 入会完了 Welcome メール (2026-06-18 線① B-1)
 *
 * - 招待マジックリンク → PW 設定完了の瞬間 (acceptInvitation 終端) に発火
 * - 受講生本人宛のみ送信
 * - users.email_notification_enabled に関係なく**必ず送る** (= 入会必須通知)
 * - エラーは throw せず log のみ (acceptInvitation の主処理を止めない)
 *
 * 起動元: src/app/invite/actions.ts:acceptInvitation
 */
export async function sendWelcomeEmail(input: {
  email: string;
  name: string;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const subject = "ご入会ありがとうございます ・ のりfitness 筋肉塾";

    const text = [
      `${input.name} 様`,
      ``,
      `のりfitness 筋肉塾へのご入会、 誠にありがとうございます。`,
      ``,
      `これから一緒に、 理想の身体と健康な毎日を作っていきましょう。`,
      ``,
      `■ まずやってほしいこと`,
      `ホーム画面追加 (= アプリ化) ・ Safari の共有メニューから「ホーム画面に追加」`,
      ``,
      `アプリ化が済んだら、 そのままアプリの案内に沿って進めてください。`,
      `カルテ記入 ・ 目標シート ・ 通知設定 など、 はじめに必要なことはすべてアプリ内でご案内します。`,
      ``,
      `■ アクセス`,
      `https://juku.norifitness.com/`,
      ``,
      `■ サポート`,
      `ご不明な点があれば、 アプリ内チャットでいつでもご質問ください。`,
      ``,
      `--`,
      `※ このメールは入会完了の確認のため、 メール通知設定に関係なくお送りしています。`,
      `※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #e0f2f1 0%, #fffbe6 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 19px; color: #004d40; font-weight: 700; margin-top: 8px;">ご入会ありがとうございます</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          ${escapeHtml(input.name)} 様<br><br>
          のりfitness 筋肉塾へのご入会、 誠にありがとうございます。<br>
          これから一緒に、 理想の身体と健康な毎日を作っていきましょう。
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 18px; margin: 22px 0;">
          <div style="font-size: 12px; color: #00695c; font-weight: 700; letter-spacing: 1px; margin-bottom: 12px;">まずやってほしいこと</div>
          <div style="font-size: 13px; color: #333; line-height: 1.8;">
            <strong>ホーム画面追加 (= アプリ化)</strong><br>
            Safari の共有メニューから「ホーム画面に追加」 をタップ
          </div>
          <div style="font-size: 12px; color: #555; line-height: 1.7; margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            アプリ化が済んだら、 そのままアプリの案内に沿って進めてください。<br>
            カルテ記入 ・ 目標シート ・ 通知設定 など、 はじめに必要なことはすべてアプリ内でご案内します。
          </div>
        </div>

        <p style="font-size: 13px; color: #555; line-height: 1.7;">
          ご不明な点があれば、 アプリ内チャットでいつでもご質問ください。
        </p>

        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          ※ このメールは入会完了の確認のため、 メール通知設定に関係なくお送りしています。<br>
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
    console.error("sendWelcomeEmail error:", e);
    return {
      sent: false,
      reason: e instanceof Error ? e.message : "unknown error",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
