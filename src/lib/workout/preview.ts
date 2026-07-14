/**
 * 筋トレメニュー改修の「仮反映」ゲート（2026-07-14）。
 *
 * 全員 is_beta=true の今、この改修だけを きよむ(藤田) さんのアカウントに限定して
 * 先行表示するための一時ゲート。ここに載っている user_id の人だけ、新しい実施記録
 * (WorkoutTodayClientV2) と関連の新UI(完了フルスクリーン等)を見る。
 *
 * 他の受講生は現行の実施記録のまま＝影響ゼロ。DB変更なし。
 * きよむさんの確認 → 承認 が出たら、この判定を撤去して全員へ公開する。
 */
const WORKOUT_PREVIEW_USER_IDS = new Set<string>([
  "eb5aab17-1379-43fa-9a79-d699b43591bb", // 藤田澄（きよむ）
]);

export function isWorkoutPreviewUser(userId: string | null | undefined): boolean {
  return !!userId && WORKOUT_PREVIEW_USER_IDS.has(userId);
}
