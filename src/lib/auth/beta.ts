import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
