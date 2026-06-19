import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndSendForUser, type ReminderResult } from "@/lib/reminders/check";
import { sendShipmentAlertsToAdmins } from "@/lib/email/shipment-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 大量受講生想定で 5 分上限

/**
 * リマインド cron エンドポイント (2026-06-18 線① R-1〜R-4 + B-6 ・ Vercel Cron)
 *
 * - daily 9 AM JST (= 0 UTC) に実行
 * - 全 active 受講生に対して 5 種類のリマインド条件をチェック → Push 発火
 * - 認証: Vercel Cron が自動で Authorization: Bearer ${CRON_SECRET} を付与
 *
 * vercel.json:
 *   { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 0 * * *" }] }
 */

export async function GET(req: NextRequest) {
  // ─── 認証 (Vercel Cron + 手動テスト両対応) ───
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const start = Date.now();
  const admin = createAdminClient();

  // ─── 全 active 受講生取得 ───
  const { data: users, error: usersError } = await admin
    .from("users")
    .select("id, joined_at")
    .eq("status", "active");
  if (usersError) {
    return Response.json({ ok: false, error: usersError.message }, { status: 500 });
  }
  if (!users || users.length === 0) {
    return Response.json({ ok: true, message: "no active users", duration_ms: Date.now() - start });
  }

  // ─── 順次チェック (= MVP 規模なので順次で OK、 数千人になったら batch 化) ───
  const results: ReminderResult[] = [];
  for (const user of users) {
    try {
      const r = await checkAndSendForUser({
        id: user.id as string,
        joined_at: user.joined_at as string,
      });
      results.push(r);
    } catch (e) {
      console.error("[cron/reminders] user check failed", user.id, e);
    }
  }

  const totalSent = results.reduce((s, r) => s + r.sent.length, 0);

  // ─── A-2 発送忘れアラート (= cron tick 1 回ぽっきり、 同日 dedup) ───
  // reminder_log に user_id=null + key='a2_shipment_alert_YYYY-MM-DD' で記録
  const today = new Date().toISOString().slice(0, 10);
  const alertKey = `a2_shipment_alert_${today}`;
  let shipmentAlertResult: unknown = null;
  {
    const { data: existing } = await admin
      .from("reminder_log")
      .select("id")
      .eq("reminder_key", alertKey)
      .is("user_id", null)
      .maybeSingle();
    if (!existing) {
      const r = await sendShipmentAlertsToAdmins();
      shipmentAlertResult = r;
      if (r.sent) {
        await admin
          .from("reminder_log")
          .insert({ user_id: null, reminder_key: alertKey });
      }
    } else {
      shipmentAlertResult = { skipped: "already sent today" };
    }
  }

  return Response.json({
    ok: true,
    users_checked: results.length,
    total_sent: totalSent,
    duration_ms: Date.now() - start,
    sample: results.slice(0, 10), // 先頭 10 件だけ詳細
    shipment_alert: shipmentAlertResult,
  });
}
