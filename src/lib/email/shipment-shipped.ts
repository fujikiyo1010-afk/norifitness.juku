import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 発送完了 通知メール (2026-06-18 線① B-5)
 *
 * - admin が markAsShipped 実行の瞬間に発火
 * - 受講生本人宛のみ送信
 * - users.email_notification_enabled = false の人には送らない
 * - エラーは throw せず log のみ (markAsShipped の主処理を止めない)
 *
 * 起動元: src/lib/admin/shipment-actions.ts:markAsShipped
 */
export async function sendShipmentShippedEmail(
  shipmentId: string
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const supabase = createAdminClient();

    const { data: shipment } = await supabase
      .from("shipments")
      .select(
        "id, user_id, postal_code, prefecture, city, address_line, recipient_name, shipped_at"
      )
      .eq("id", shipmentId)
      .maybeSingle();
    if (!shipment) return { sent: false, reason: "shipment not found" };

    const { data: user } = await supabase
      .from("users")
      .select("id, name, email, email_notification_enabled")
      .eq("id", shipment.user_id)
      .maybeSingle();
    if (!user) return { sent: false, reason: "user not found" };

    if (user.email_notification_enabled === false) {
      return { sent: false, reason: "email_notification_enabled is false" };
    }

    const name = user.name ?? "受講生";
    const subject = "プロテインを発送しました ・ のりfitness 筋肉塾";

    const text = [
      `${name} 様`,
      ``,
      `のりfitness 筋肉塾です。`,
      ``,
      `ご入会の歓迎ギフト (プロテイン) を本日発送しました。`,
      `通常 1〜3 日以内にお届け予定です。`,
      ``,
      `■ お届け先`,
      `〒${shipment.postal_code ?? ""}`,
      `${shipment.prefecture ?? ""}${shipment.city ?? ""}${shipment.address_line ?? ""}`,
      `${shipment.recipient_name ?? name} 様`,
      ``,
      `お受け取りをお願いいたします。`,
      ``,
      `--`,
      `※ このメールは発送通知のためお送りしています (メール通知 ON の方のみ)。`,
      `※ 配信元: のりfitness 筋肉塾 (juku.norifitness.com)`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #e0f2f1 0%, #fffbe6 100%); border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 18px; color: #004d40; font-weight: 700; margin-top: 8px;">プロテインを発送しました</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          ${escapeHtml(name)} 様<br><br>
          ご入会の歓迎ギフト (プロテイン) を本日発送しました。<br>
          通常 1〜3 日以内にお届け予定です。
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px 18px; margin: 18px 0; font-size: 13px; color: #555; line-height: 1.8;">
          <div style="font-size: 11px; color: #00695c; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">お届け先</div>
          <div>〒${escapeHtml(shipment.postal_code ?? "")}</div>
          <div>${escapeHtml(shipment.prefecture ?? "")}${escapeHtml(shipment.city ?? "")}${escapeHtml(shipment.address_line ?? "")}</div>
          <div style="margin-top: 4px;"><strong>${escapeHtml(shipment.recipient_name ?? name)}</strong> 様</div>
        </div>
        <p style="font-size: 13px; color: #555; line-height: 1.7;">
          お受け取りをお願いいたします。
        </p>
        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          ※ このメールは発送通知のためお送りしています (メール通知 ON の方のみ)。<br>
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
    console.error("sendShipmentShippedEmail error:", e);
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
