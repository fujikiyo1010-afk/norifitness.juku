import { getResendClient, getFromEmail } from "./resend";

/**
 * 一斉アナウンス バッチ送信 (2026-06-18 C-1)
 *
 * - Resend の bcc を使うと配信先が他人に見えない (= プライバシー保護)
 * - 100 件ずつ分割 (Resend free tier の最大 to 数を超えない安全値)
 * - 失敗時は全体を fail 扱い (= 部分送信を許容しない方が監査としては綺麗)
 *
 * 起動元: src/lib/announcements/actions.ts:sendAnnouncement
 */

const BATCH_SIZE = 50; // Resend は最大 50 (free) ・ 1 通あたりの bcc 上限

export async function sendAnnouncementBatch(input: {
  subject: string;
  body: string;
  recipients: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resend = getResendClient();
    const from = getFromEmail();

    const text = input.body + "\n\n--\n※ このメールは のりfitness 筋肉塾 から受講生全員にお送りしています。\n※ 配信元: juku.norifitness.com";
    const html = bodyToHtml(input.body);

    for (let i = 0; i < input.recipients.length; i += BATCH_SIZE) {
      const slice = input.recipients.slice(i, i + BATCH_SIZE);
      await resend.emails.send({
        from,
        to: from, // 本文は from 宛 (受講生は bcc で見えない)
        bcc: slice,
        subject: input.subject,
        text,
        html,
      });
    }

    return { ok: true };
  } catch (e) {
    console.error("sendAnnouncementBatch error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    };
  }
}

/**
 * プレーンテキスト本文を、 改行 + ヘッダ枠付きで HTML 化する最小実装。
 * 装飾不要 (= 規約 / メンテ / インシデント告知に使う、 シンプルが正解)。
 */
function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size: 14px; color: #333; line-height: 1.8; margin: 0 0 16px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 580px; margin: 0 auto; padding: 24px;">
      <div style="background: #e0f2f1; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 22px;">
        <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
        <div style="font-size: 14px; color: #004d40; font-weight: 700; margin-top: 6px;">受講生のみなさまへ</div>
      </div>
      ${paragraphs}
      <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
        ※ このメールは のりfitness 筋肉塾 から受講生全員にお送りしています。<br>
        ※ 配信元: juku.norifitness.com
      </div>
    </div>
  `.trim();
}
