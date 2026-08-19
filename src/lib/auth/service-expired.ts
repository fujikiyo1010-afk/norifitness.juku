import { createClient } from "@/lib/supabase/server";

/** サービス期間(日数)。開始日 + この日数 を過ぎたら満了版へ自動切替(C1)。 */
export const SERVICE_PERIOD_DAYS = 180;

/**
 * サービス期間(180日)満了ユーザーの部分閉鎖ゲート (2026-08-14 / 自動切替化 2026-08-19)。
 *
 * 判定: users.service_started_at + 180日 を過ぎたら満了。全会員に自動適用。
 *       開始日が空の保険として、下の手動リストも常に満了扱い。
 *
 * 対象: アプリは渡すが、期間つきサポート機能を閉じる受講生。
 * 閉じるもの: 月次添削 / フォーム添削 / カルテ更新リクエスト(=メニュー希望) / 目標シート
 * 開けたまま: 記録系・週間トレ・カレンダー・学習・特典・過去の閲覧・
 *             デイリー食事添削(特別扱い・〜2026-9月末)・アプリ内のやりとり
 *
 * 将来: 卒業運用が設計されたら DB カラム化する想定の土台。
 * 9月末(特別食事添削の終了)や、10月以降に180日を迎える人の追加も、まずこのリストで運用する。
 */
export const SERVICE_EXPIRED_EMAILS = [
  "k-kosiro@ezweb.ne.jp", // 川口甲士郎（2025-09 サポート開始・180日満了）
  "m_masato0926@icloud.com", // 田中雅人（2025-07 サポート開始・180日満了）
];

export async function isServiceExpiredUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // 手動リスト(保険・grace対象の明示)は常に満了扱い
  const email = user.email?.toLowerCase();
  if (email && SERVICE_EXPIRED_EMAILS.includes(email)) return true;

  // 開始日 + 180日 を過ぎたら満了(全会員に自動適用・C1)
  const { data } = await supabase
    .from("users")
    .select("service_started_at")
    .eq("id", user.id)
    .maybeSingle();
  const started = data?.service_started_at as string | null | undefined;
  if (!started) return false;
  return Date.now() >= new Date(started).getTime() + SERVICE_PERIOD_DAYS * 86_400_000;
}
