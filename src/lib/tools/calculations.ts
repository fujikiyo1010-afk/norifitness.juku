/**
 * ツール 4 種の計算式 (純粋関数、Server/Client 両方で使える)
 */

import type {
  ActivityLevel,
  BodyFatInputs,
  BodyFatOutputs,
  CalorieInputs,
  CalorieOutputs,
} from "./types";

/**
 * 体脂肪率を計算 (アメリカ海軍式)
 *
 * 男性式: BF% = 495 / (1.0324 − 0.19077 × log10(W−N) + 0.15456 × log10(H)) − 450
 * 女性式: BF% = 495 / (1.29579 − 0.35004 × log10(W+Hip−N) + 0.22100 × log10(H)) − 450
 *
 * W = ウエスト (cm)、N = 首回り (cm)、H = 身長 (cm)、Hip = ヒップ (女性式のみ)
 */
export function calculateBodyFat(inputs: BodyFatInputs): BodyFatOutputs {
  const { gender, formula, height_cm, waist_cm, neck_cm, hip_cm, weight_kg } = inputs;

  // 性別 "other" の時は formula を見る、そうでなければ gender 直接
  const useFemale =
    gender === "female" || (gender === "other" && formula === "female");

  if (useFemale && (hip_cm === undefined || hip_cm <= 0)) {
    throw new Error("女性式には ヒップ の入力が必要です");
  }
  if (waist_cm <= 0 || neck_cm <= 0 || height_cm <= 0) {
    throw new Error("身長・ウエスト・首回りに正の値を入れてください");
  }

  let bf: number;
  if (useFemale) {
    const inner = waist_cm + (hip_cm as number) - neck_cm;
    if (inner <= 0) {
      throw new Error("入力値が異常です (ウエスト+ヒップ−首回り ≤ 0)");
    }
    bf =
      495 /
        (1.29579 -
          0.35004 * Math.log10(inner) +
          0.221 * Math.log10(height_cm)) -
      450;
  } else {
    const inner = waist_cm - neck_cm;
    if (inner <= 0) {
      throw new Error("入力値が異常です (ウエスト−首回り ≤ 0)");
    }
    bf =
      495 /
        (1.0324 -
          0.19077 * Math.log10(inner) +
          0.15456 * Math.log10(height_cm)) -
      450;
  }

  if (!isFinite(bf)) {
    throw new Error("計算できませんでした。入力値を確認してください");
  }

  // 0〜60% の範囲にクランプ + 小数 1 桁
  const clamped = Math.max(0, Math.min(60, bf));
  const body_fat_pct = Math.round(clamped * 10) / 10;

  const output: BodyFatOutputs = { body_fat_pct };

  if (weight_kg !== undefined && weight_kg > 0) {
    const body_fat_kg = Math.round((weight_kg * body_fat_pct) / 100 * 10) / 10;
    output.body_fat_kg = body_fat_kg;
    output.lean_mass_kg = Math.round((weight_kg - body_fat_kg) * 10) / 10;
  }

  return output;
}

/**
 * 運動量レベル → 係数 (内部のみで使う、UI には数字を出さない)
 */
export const ACTIVITY_COEFFICIENTS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * 運動量レベルの表示ラベル
 */
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "ほとんど運動しない",
  light: "軽い運動 ・ 週 1〜3 回",
  moderate: "中程度の運動 ・ 週 3〜5 回",
  active: "ハードな運動 ・ 週 6〜7 回",
  very_active: "非常にハード ・ 毎日 2 回など",
};

/**
 * 必要カロリーを計算 (ハリスベネディクト式 改訂版)
 *
 * 男性 BMR = 88.362 + (13.397 × W) + (4.799 × H) − (5.677 × A)
 * 女性 BMR = 447.593 + (9.247 × W) + (3.098 × H) − (4.330 × A)
 *
 * メンテナンス = BMR × 運動量係数
 * ダイエット時 = メンテナンス − 500
 * 増量時     = メンテナンス + 500
 *
 * W = 体重 (kg)、H = 身長 (cm)、A = 年齢 (歳)
 */
export function calculateCalorie(inputs: CalorieInputs): CalorieOutputs {
  const { gender, formula, height_cm, weight_kg, age, activity_level } = inputs;

  if (height_cm <= 0 || weight_kg <= 0 || age <= 0) {
    throw new Error("身長・体重・年齢に正の値を入れてください");
  }

  const useFemale =
    gender === "female" || (gender === "other" && formula === "female");

  const bmrRaw = useFemale
    ? 447.593 + 9.247 * weight_kg + 3.098 * height_cm - 4.33 * age
    : 88.362 + 13.397 * weight_kg + 4.799 * height_cm - 5.677 * age;

  if (!isFinite(bmrRaw) || bmrRaw <= 0) {
    throw new Error("計算できませんでした。入力値を確認してください");
  }

  const coefficient = ACTIVITY_COEFFICIENTS[activity_level];
  const maintenanceRaw = bmrRaw * coefficient;

  const bmr = Math.round(bmrRaw);
  const maintenance = Math.round(maintenanceRaw);
  const diet = Math.round(maintenanceRaw - 500);
  const bulk = Math.round(maintenanceRaw + 500);

  return { bmr, maintenance, diet, bulk };
}
