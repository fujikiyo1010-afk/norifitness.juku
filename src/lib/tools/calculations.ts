/**
 * ツール 4 種の計算式 (純粋関数、Server/Client 両方で使える)
 */

import type { BodyFatInputs, BodyFatOutputs } from "./types";

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
