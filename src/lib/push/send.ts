import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Web Push 送信 サーバ側ヘルパー (2026-06-18 #2 push 基盤)
 *
 * 役割:
 *   - VAPID 鍵を web-push に渡す初期化
 *   - sendPushToUser(userId, payload) で 対象受講生の全 subscription にバナー通知
 *   - 410/404 で失効と判明した subscription は自動 delete
 *
 * 環境変数:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   - WEB_PUSH_VAPID_PRIVATE_KEY (sensitive)
 *   - WEB_PUSH_VAPID_SUBJECT (例 mailto:fujikiyo1010@gmail.com)
 *
 * 補足:
 *   - createAdminClient (= service_role) は RLS をバイパス (送信は admin/system 行為のため)
 *   - run-once 初期化のため module top で setVapidDetails
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.WEB_PUSH_VAPID_SUBJECT;

if (VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type SendPushResult = {
  attempted: number;
  succeeded: number;
  expired: number;
  failed: number;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<SendPushResult> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
    throw new Error("VAPID 鍵が未設定です (環境変数を確認)");
  }
  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  if (!subs || subs.length === 0) {
    return { attempted: 0, succeeded: 0, expired: 0, failed: 0 };
  }

  let succeeded = 0;
  let expired = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload)
        );
        succeeded++;
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // 失効 → DB から削除
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", s.id);
          expired++;
        } else {
          failed++;
          console.error("[push] send failed", { sub: s.id, status, err });
        }
      }
    })
  );

  return { attempted: subs.length, succeeded, expired, failed };
}

/**
 * 全 active admin (= admin_users.is_active=true) に push 配信。
 * 内部で sendPushToUser を呼ぶだけだが「全 admin に通知」 という意図を明示するため別関数。
 * チャット新着 / signup_request 等 「admin が即気付きたい」 通知の入口。
 */
export async function sendPushToAllAdmins(
  payload: PushPayload
): Promise<SendPushResult> {
  const supabase = createAdminClient();
  const { data: admins, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("is_active", true);
  if (error) throw error;
  if (!admins || admins.length === 0) {
    return { attempted: 0, succeeded: 0, expired: 0, failed: 0 };
  }
  const results = await Promise.all(
    admins.map((a) => sendPushToUser(a.id as string, payload))
  );
  return results.reduce(
    (acc, r) => ({
      attempted: acc.attempted + r.attempted,
      succeeded: acc.succeeded + r.succeeded,
      expired: acc.expired + r.expired,
      failed: acc.failed + r.failed,
    }),
    { attempted: 0, succeeded: 0, expired: 0, failed: 0 }
  );
}
