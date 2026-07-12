import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jstTodayStr } from "@/lib/date/jst";

/**
 * ベータ運用(ルール17段2改訂・2026-07-10)の出し分け判定。
 *
 * 受講生に見える変更は、まず固定ベータ4人(users.is_beta=true)だけに本番反映する。
 * サーバコンポーネントでこれを呼び、`isBeta` をクライアントに渡して新旧を分岐する。
 * 全体公開時は分岐を外し、旧コードを削除する(並存は短命に)。
 */
export async function isBetaUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("is_beta")
    .eq("id", user.id)
    .maybeSingle();
  return data?.is_beta === true;
}

/**
 * C(2026-07-12): ルートレイアウト(=アプリを開いた点・1ナビにつき1回)で呼ぶ。
 * isBeta を返しつつ、ログイン済み受講生の `last_seen_at`(=最終利用) を
 * 「JSTの日付が変わっていれば1回だけ」更新する。
 *
 * 往復を増やさない: is_beta と同じ1クエリで last_seen_at も読み、当日更新済みなら書かない。
 * 画面を巻き込まない: 更新は after() でレンダー後に非同期実行し、失敗は握りつぶす。
 * 全受講生対象・isBeta不問(認証済みなら誰でも)。
 */
export async function getLayoutBootState(): Promise<{ isBeta: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isBeta: false };

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("is_beta, last_seen_at")
    .eq("id", user.id)
    .maybeSingle();
  const isBeta = data?.is_beta === true;

  const seenTs = data?.last_seen_at as string | null | undefined;
  const alreadyToday =
    seenTs != null && jstTodayStr(new Date(seenTs).getTime()) === jstTodayStr();
  if (!alreadyToday) {
    const uid = user.id;
    // レンダーをブロックしない。失敗は監視外(画面を巻き込まない)。
    after(async () => {
      try {
        await admin
          .from("users")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", uid);
      } catch {
        /* last_seen_at の更新失敗は無視(表示に影響させない) */
      }
    });
  }
  return { isBeta };
}
