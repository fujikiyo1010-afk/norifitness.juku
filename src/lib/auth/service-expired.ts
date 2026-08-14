import { createClient } from "@/lib/supabase/server";

/**
 * サービス期間(180日)満了ユーザーの部分閉鎖ゲート (2026-08-14)。
 *
 * 対象: アプリは渡すが、期間つきサポート機能を閉じる受講生。
 * 閉じるもの: 月次添削 / フォーム添削 / カルテ更新リクエスト(=メニュー希望) / 目標シート
 * 開けたまま: 記録系・週間トレ・カレンダー・学習・特典・過去の閲覧・
 *             デイリー食事添削(特別扱い・〜2026-10月末)・アプリ内のやりとり
 *
 * 将来: 卒業運用が設計されたら DB カラム化する想定の土台。
 * 10月末(特別食事添削の終了)や、11月以降に180日を迎える人の追加も、まずこのリストで運用する。
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
  const email = user?.email?.toLowerCase();
  return !!email && SERVICE_EXPIRED_EMAILS.includes(email);
}
