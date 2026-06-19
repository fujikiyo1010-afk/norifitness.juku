import { getResendClient, getFromEmail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 発送忘れアラート (admin 宛 ・ 2026-06-19 線① A-2)
 *
 * - cron daily で 「未発送のまま 2 日以上経過した shipments」 を集計
 * - 1 件以上あれば admin 全員に bcc メール 1 通送信
 * - エラーは throw せず log のみ
 *
 * 起動元: /api/cron/reminders/route.ts の最後に 1 回呼ぶ
 */

const STALE_DAYS = 2;

export type ShipmentAlertResult =
  | { sent: true; stale_count: number }
  | { sent: false; reason: string };

export async function sendShipmentAlertsToAdmins(): Promise<ShipmentAlertResult> {
  try {
    const supabase = createAdminClient();

    // ① 滞留 shipments 取得
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400 * 1000).toISOString();
    const { data: stale, error: staleError } = await supabase
      .from("shipments")
      .select(
        "id, user_id, recipient_name, prefecture, city, address_line, created_at, users(name)"
      )
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true });
    if (staleError) {
      return { sent: false, reason: `shipments query: ${staleError.message}` };
    }
    if (!stale || stale.length === 0) {
      return { sent: false, reason: "no stale shipments" };
    }

    // ② admin 宛先取得
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

    // ③ メール本文構築
    const subject = `[筋肉塾] 発送忘れアラート: 未発送 ${stale.length} 件 (2 日以上経過)`;
    const occurredAtJst = formatJst(new Date());

    const lines = stale.map((s, i) => {
      const userObj = (s as { users?: { name?: string | null } | null }).users;
      const userName = userObj?.name ?? "(不明)";
      const recipient = (s as { recipient_name?: string | null }).recipient_name ?? userName;
      const addr = `${(s as { prefecture?: string }).prefecture ?? ""}${(s as { city?: string }).city ?? ""}${(s as { address_line?: string }).address_line ?? ""}`;
      const createdAt = (s as { created_at: string }).created_at;
      const days = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / (86400 * 1000)
      );
      return `${i + 1}. ${userName} (宛先: ${recipient}) ・ ${addr} ・ 受付 ${createdAt.slice(0, 10)} (${days} 日経過)`;
    });

    const text = [
      `のりfitness 筋肉塾 発送忘れアラート`,
      ``,
      `${stale.length} 件の shipments が未発送のまま 2 日以上経過しています。`,
      ``,
      ...lines,
      ``,
      `集計日時: ${occurredAtJst}`,
      ``,
      `■ 対応`,
      `管理画面 (https://juku.norifitness.com/admin/shipments) で「発送済」 マークしてください。`,
      ``,
      `--`,
      `※ このメールは管理者全員に送信されています。`,
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; max-width: 580px; margin: 0 auto; padding: 24px;">
        <div style="background: #fef2f2; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 18px;">
          <div style="font-size: 11px; color: #991b1b; font-weight: 700; letter-spacing: 2px;">のりfitness 筋肉塾</div>
          <div style="font-size: 17px; color: #7f1d1d; font-weight: 700; margin-top: 8px;">発送忘れアラート</div>
        </div>
        <p style="font-size: 14px; color: #333; line-height: 1.7;">
          <strong>${stale.length} 件</strong> の shipments が未発送のまま 2 日以上経過しています。
        </p>
        <ol style="font-size: 13px; color: #333; line-height: 1.8; padding-left: 24px; margin: 0 0 18px;">
          ${stale
            .map((s) => {
              const userObj = (s as { users?: { name?: string | null } | null }).users;
              const userName = escapeHtml(userObj?.name ?? "(不明)");
              const recipient = escapeHtml(
                (s as { recipient_name?: string | null }).recipient_name ?? userObj?.name ?? "(不明)"
              );
              const addr = escapeHtml(
                `${(s as { prefecture?: string }).prefecture ?? ""}${(s as { city?: string }).city ?? ""}${(s as { address_line?: string }).address_line ?? ""}`
              );
              const createdAt = (s as { created_at: string }).created_at;
              const days = Math.floor(
                (Date.now() - new Date(createdAt).getTime()) / (86400 * 1000)
              );
              return `<li><strong>${userName}</strong> (宛先: ${recipient}) ・ ${addr} ・ 受付 ${createdAt.slice(0, 10)} <span style="color:#991b1b; font-weight: 700;">(${days} 日経過)</span></li>`;
            })
            .join("")}
        </ol>
        <div style="text-align: center; margin: 22px 0;">
          <a href="https://juku.norifitness.com/admin/shipments" style="display: inline-block; background: #00897b; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700;">発送管理画面を開く →</a>
        </div>
        <div style="font-size: 11px; color: #888; line-height: 1.7; border-top: 1px solid #eee; padding-top: 14px; margin-top: 28px;">
          集計日時: ${occurredAtJst}<br>
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

    return { sent: true, stale_count: stale.length };
  } catch (e) {
    console.error("sendShipmentAlertsToAdmins error:", e);
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
