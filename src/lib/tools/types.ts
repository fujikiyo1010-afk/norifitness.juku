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
// 共通型: tool_calculations の読み取り結果
// =====================================================================
export type ToolCalculation<I = unknown, O = unknown> = {
  inputs: I;
  outputs: O;
  calculatedAt: string; // ISO timestamp
};
