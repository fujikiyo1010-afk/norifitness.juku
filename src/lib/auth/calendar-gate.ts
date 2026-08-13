import { createClient } from "@/lib/supabase/server";

/**
 * カレンダー(1日ビュー)の先行公開ゲート。
 *  - 2026-07-25: 藤田だけ先行(新規実装の初回確認)。
 *
 * 下部ナビ「筋トレ」→「カレンダー」の置換もこのゲートで出し分ける
 * (藤田=カレンダー / 他=従来の筋トレ /workout)。
 * 対象を広げる時はこのリストに足す。全公開に切り替える時は呼び出し側の条件を外す
 * (常に true)だけ。/workout は全公開後も再入口として残す(連携メモ §0a ガード④)。
 */
export const CALENDAR_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（きよむ・本番アカウント）
  "hyuuga.morikawa@gmail.com", // 森川陽向
  "icanfly.v3v@icloud.com", // 近藤優気
  "asahakanari260@yahoo.co.jp", // 阿部紀洋
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isCalendarUser(): Promise<boolean> {
  return true; // 全体公開 2026-08-14(きよむGO)
  /* 全公開前のゲート(復元用):
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && CALENDAR_PREVIEW_EMAILS.includes(email);
  */
}
