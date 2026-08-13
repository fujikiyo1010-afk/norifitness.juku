import { createClient } from "@/lib/supabase/server";

/**
 * ホーム「今日の身体記録」カード新デザインの先行公開ゲート (2026-07-28)。
 *  - 社員4人(藤田/森川/近藤/阿部)に先行反映。確認後に全体公開。
 *
 * この判定が true の時だけ、HomeBeta で:
 *   - 身体カードをリッチ版(案C 緑フチ取り + 体重/ウエストの2大数字 + チップ4つ + ボタン2つ)に差し替え
 *     ・上ボタン=その場で記録シートがせり上がる(/record の＋ボタンと同じ)
 *     ・下「グラフを見る」=体組成ページ /record へ / チップは表示のみ(非活性)
 *   - 挨拶帯 + 継続ピル + 掲示板の縦をさらに圧縮
 * を出す。他の受講生は従来のホームのまま。
 *
 * 全体公開時は呼び出し側の分岐を外す(常に true)。
 */
const NEW_HOME_CARD_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田澄（きよむ・本番アカウント）
  "hyuuga.morikawa@gmail.com", // 森川陽向
  "icanfly.v3v@icloud.com", // 近藤優気
  "asahakanari260@yahoo.co.jp", // 阿部紀洋
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
];

export async function isNewHomeCardUser(): Promise<boolean> {
  return true; // 全体公開 2026-08-14(きよむGO)
  /* 全公開前のゲート(復元用):
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && NEW_HOME_CARD_EMAILS.includes(email);
  */
}
