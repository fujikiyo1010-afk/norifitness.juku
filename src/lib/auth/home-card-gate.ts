import { createClient } from "@/lib/supabase/server";

/**
 * ホーム「今日の身体記録」カード新デザインの先行公開ゲート (2026-07-28)。
 *  - まず藤田さん(きよむ)だけに先行反映。確認後に対象を広げる。
 *
 * この判定が true の時だけ、HomeBeta で:
 *   - 身体カードをリッチ版(緑ヘッダー帯 + 体重/ウエストの2大数字 + チップ4つ + ボタン2つ)に差し替え
 *   - 挨拶帯 + 継続ピル + 掲示板の縦を約80%に圧縮
 * を出す。他の受講生は従来のホームのまま。
 *
 * 対象を広げる時はこのリストに足す。全体公開時は呼び出し側の分岐を外す(常に true)。
 */
const NEW_HOME_CARD_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（きよむ・本番アカウント）
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isNewHomeCardUser(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && NEW_HOME_CARD_EMAILS.includes(email);
}
