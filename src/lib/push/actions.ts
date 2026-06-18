"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "./send";

/**
 * Web Push 関連 Server Actions (2026-06-18 #2 push 基盤)
 *
 * 受講生 (Client) から呼ばれて:
 *   - saveSubscription : 端末から取得した PushSubscription を DB に upsert
 *   - deleteSubscription: 解除時に DB から削除
 *   - sendTestPushToMe : 「テスト通知を送る」 デモボタン用 (自分宛 1 通)
 *
 * 補足:
 *   - getUser で認証ガード
 *   - user_agent はデバッグ用に保持 (どの端末か判別)
 */

type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export type ActionResult =
  | { ok: true; meta?: Record<string, unknown> }
  | { ok: false; error: string };

export async function saveSubscription(
  sub: SubscriptionInput
): Promise<ActionResult> {
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    return { ok: false, error: "subscription の必須項目が不足しています" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  // 同 endpoint が他ユーザー紐付けで残ってる可能性 (端末再共有等) → 一旦 endpoint で delete してから insert
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);

  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    user_agent: sub.userAgent ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSubscription(
  endpoint: string
): Promise<ActionResult> {
  if (!endpoint) return { ok: false, error: "endpoint が空です" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

type TestPushOptions = {
  delaySec?: number;     // Server Action 内で待機 (= 10 秒後送信デモ用、 推奨 0-30)
  url?: string;          // タップで開く URL (= リンク付き通知デモ用)
  title?: string;        // 上書き
  body?: string;         // 上書き
  tag?: string;          // 同 tag は端末側で上書き
};

async function _sendTestPush(opts: TestPushOptions): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  try {
    if (opts.delaySec && opts.delaySec > 0) {
      const ms = Math.min(opts.delaySec, 50) * 1000; // Vercel 60s 制限手前で頭打ち
      await new Promise((r) => setTimeout(r, ms));
    }
    const result = await sendPushToUser(user.id, {
      title: opts.title ?? "筋肉塾 ・ テスト通知",
      body: opts.body ?? "通知の動作確認です。 これが見えれば成功!",
      url: opts.url ?? "/",
      tag: opts.tag ?? "test",
    });
    if (result.attempted === 0) {
      return {
        ok: false,
        error: "送信先 subscription がありません。 先に通知を有効にしてください",
      };
    }
    return { ok: true, meta: { ...result } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "送信に失敗しました",
    };
  }
}

export async function sendTestPushToMe(): Promise<ActionResult> {
  return _sendTestPush({});
}

export async function sendTestPushDelayed(): Promise<ActionResult> {
  return _sendTestPush({
    delaySec: 10,
    title: "筋肉塾 ・ 10 秒後テスト",
    body: "ロック中でも届きました。 タップでアプリが開きます",
    tag: "test-delayed",
  });
}

export async function sendTestPushWithLink(): Promise<ActionResult> {
  return _sendTestPush({
    title: "筋肉塾 ・ リンク付きテスト",
    body: "タップ or 左スワイプ → 「開く」 で 筋トレ画面 へ",
    url: "/workout",
    tag: "test-link",
  });
}

/**
 * 自分の subscription 件数を返す (UI で 「有効」 表示の根拠)。
 */
export async function getMySubscriptionCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  return count ?? 0;
}
