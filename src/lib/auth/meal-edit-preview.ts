/**
 * 食事「過去日の編集」の仮反映 許可リスト (2026-07-18)。
 *
 * ここに列挙したメールのアカウントだけ、本番で過去日の食事を編集できる
 * (ロックなし＝のり添削済みの日も含めて、すべての過去日を直せる)。
 * 他の受講生は従来通り「今日のみ編集可」。
 *
 * ※特典ライブラリの仮反映(tokuten-preview.ts の PREVIEW_EMAILS)とは別リスト。
 *   この4人には「食事編集だけ」を出す(特典ライブラリは出さない)。
 * ★対象を増やす時はこの配列に1行足す。
 * ★全員へ公開する時は meals/page.tsx の canEditPast 判定を外す(常に true)。
 */
export const MEAL_EDIT_PREVIEW_EMAILS = [
  "fujikiyo1010+kiyomu-test@gmail.com", // 藤田さん 本番アカウント
  "fujikiyo1010@gmail.com", // dev テスト用(本番には存在しない)
  "asahakanari260@yahoo.co.jp",
  "icanfly.v3v@icloud.com",
  "hyuuga.morikawa@gmail.com",
];
