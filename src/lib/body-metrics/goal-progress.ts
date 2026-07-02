/**
 * 体組成「目標まであと◯kg」の共通計算 (2026-07-02 体組成改修 手順B)
 *
 * 方針(きよむさん 2026-07-02): 距離だけ出す安全版。
 *   - 向き(減量/増量)は判定しない → 誤表示ゼロ。
 *   - 目標体重は goal_sheets.content.goal_selection.target_weight_kg 由来。
 *
 * /record 詳細サマリ(手順B) と ホーム体組成カード(手順C) の両方で使い回す。
 */

export type WeightGoalProgress =
  | { state: "no_target" } // 目標体重 未設定
  | { state: "no_current" } // 体重の記録なし
  | { state: "reached" } // 目標にほぼ到達
  | { state: "remaining"; kg: number }; // 目標までの距離 (kg・絶対値)

export function weightGoalProgress(
  currentWeightKg: number | null | undefined,
  targetWeightKg: number | null | undefined
): WeightGoalProgress {
  if (targetWeightKg == null) return { state: "no_target" };
  if (currentWeightKg == null) return { state: "no_current" };
  const diff = Math.round((currentWeightKg - targetWeightKg) * 10) / 10;
  if (Math.abs(diff) < 0.05) return { state: "reached" };
  return { state: "remaining", kg: Math.abs(diff) };
}
