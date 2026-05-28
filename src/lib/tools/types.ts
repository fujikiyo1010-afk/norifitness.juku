/**
 * ツール 4 種の型定義
 *
 * 設計元:
 *   - /tmp/tools_*.html (Phase 2-7 モック)
 *   - supabase/migrations/20260525000002_tool_calculations.sql
 *   - 合意の正典 (2026-05-27 議論で確定: 単独モード = 反映なし、目標シート経由 = モーダル展開)
 */

export type ToolId = "body_fat" | "calorie" | "diet_period" | "pfc_carb";

export type Gender = "male" | "female" | "other";

// =====================================================================
// ツール 1: 体脂肪率計算 (アメリカ海軍式)
// =====================================================================
export type BodyFatInputs = {
  gender: Gender;
  // gender が "other" の時のみ使う (男性式 or 女性式)
  formula?: "male" | "female";
  height_cm: number;
  waist_cm: number;
  neck_cm: number;
  hip_cm?: number; // 女性式の時のみ必須
  weight_kg?: number; // 任意 (体脂肪量/除脂肪量を出す時に使う)
};

export type BodyFatOutputs = {
  body_fat_pct: number; // 小数 1 桁
  body_fat_kg?: number; // weight_kg があれば
  lean_mass_kg?: number; // weight_kg があれば
};

// =====================================================================
// ツール 2: 必要カロリー計算 (ハリスベネディクト式 改訂版)
// =====================================================================

/**
 * 運動量レベル 5 段階
 *
 * 係数は内部のみで管理 (P3 改善: UI には数字を出さない、
 * 受講生に「× 1.2」等を見せても意味不明なため)
 */
export type ActivityLevel =
  | "sedentary" // ほとんど運動しない (1.2)
  | "light" // 軽い運動 ・ 週 1〜3 回 (1.375)
  | "moderate" // 中程度の運動 ・ 週 3〜5 回 (1.55)
  | "active" // ハードな運動 ・ 週 6〜7 回 (1.725)
  | "very_active"; // 非常にハード ・ 毎日 2 回など (1.9)

export type CalorieInputs = {
  gender: Gender;
  // gender が "other" の時のみ使う (男性式 or 女性式)
  formula?: "male" | "female";
  height_cm: number;
  weight_kg: number;
  age: number;
  activity_level: ActivityLevel;
};

export type CalorieOutputs = {
  bmr: number; // 基礎代謝 (kcal/日、整数)
  maintenance: number; // メンテナンス
  diet: number; // ダイエット時 (maintenance - 500)
  bulk: number; // 増量時 (maintenance + 500)
};

// =====================================================================
// ツール 3: 減量期間逆算
// =====================================================================

export type DietPeriodInputs = {
  current_weight_kg: number;
  target_weight_kg: number;
  pace_kg_per_week: number; // デフォルト 0.5 (推奨値)
  start_date: string; // ISO yyyy-mm-dd
};

/**
 * ペース別アドバイスのレベル
 * - moderate: ≤ 0.5 kg/週 (続けやすい)
 * - intense: ≤ 1.0 kg/週 (ややしっかりめ)
 * - extreme: > 1.0 kg/週 (かなり速い)
 */
export type PaceAdviceLevel = "moderate" | "intense" | "extreme";

export type DietPeriodOutputs = {
  needed_kg: number; // 必要な減量 (小数 1 桁)
  weeks: number; // 期間 (週、小数 1 桁)
  days: number; // 期間 (日、整数)
  end_date: string; // 目標到達日 ISO yyyy-mm-dd
  weekly_progress_pct: number; // 1 週間あたりの進捗 % (小数 1 桁)
  pace_advice_level: PaceAdviceLevel;
};

// =====================================================================
// 共通型: tool_calculations の読み取り結果
// =====================================================================
export type ToolCalculation<I = unknown, O = unknown> = {
  inputs: I;
  outputs: O;
  calculatedAt: string; // ISO timestamp
};
