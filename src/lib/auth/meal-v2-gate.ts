import { createClient } from "@/lib/supabase/server";

/**
 * 食事新装(V2)の先行公開ゲート(2026-08-19)。
 *  - まず社員4人だけ新しい食事画面(885品・DayDetailV2/MealSheetV2)。
 *  - 他の受講生は従来の食事画面(Legacy)のまま(候補リストだけ885品に増える)。
 * 対象を広げる時はこのリストに足す。全公開に切り替える時は isMealV2User を
 * 常に true にして、Legacy 2ファイル(DayDetailLegacy/MealSheetLegacy)を削除する。
 */
export const MEAL_V2_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（きよむ・本番アカウント）
  "hyuuga.morikawa@gmail.com", // 森川陽向
  "icanfly.v3v@icloud.com", // 近藤優気
  "asahakanari260@yahoo.co.jp", // 阿部紀洋
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
  "test-student-001@example.com", // dev テスト用(本番には存在しない)
];

export async function isMealV2User(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && MEAL_V2_PREVIEW_EMAILS.includes(email);
}
