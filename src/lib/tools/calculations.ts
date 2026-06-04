/**
 * ツール 4 種の計算式 (純粋関数、Server/Client 両方で使える)
 */

import type {
  ActivityLevel,
  BodyFatInputs,
  BodyFatOutputs,
  CalorieInputs,
  CalorieOutputs,
  DietPeriodInputs,
  DietPeriodOutputs,
  PaceAdviceLevel,
  PfcCarbInputs,
  PfcCarbOutputs,
  TrainingIntensity,
  WeekDay,
} from "./types";
import { WEEK_DAYS } from "./types";

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

/**
 * 減量ペースをアドバイスレベルに分類
 */
export function classifyPace(paceKgPerWeek: number): PaceAdviceLevel {
  if (paceKgPerWeek <= 0.5) return "moderate";
  if (paceKgPerWeek <= 1.0) return "intense";
  return "extreme";
}

/**
 * 節目週リスト (1ヶ月/3ヶ月/5ヶ月/7ヶ月/9ヶ月) ・ おおよそ 4 週/月
 * P5 改善: 全週ではなく節目だけ + 開始/到達は別途
 */
export const MILESTONE_WEEKS: ReadonlyArray<{ week: number; label: string }> = [
  { week: 5, label: "1 ヶ月の目安" },
  { week: 13, label: "3 ヶ月の目安" },
  { week: 21, label: "5 ヶ月の目安" },
  { week: 29, label: "7 ヶ月の目安" },
  { week: 37, label: "9 ヶ月の目安" },
];

/**
 * 減量期間を逆算 (目標体重 + ペース + 開始日 → 期間 + 到達日)
 *
 * 必要な減量 = 現在体重 − 目標体重 (kg)
 * 期間 (週) = 減量 / ペース
 * 期間 (日) = 週 × 7 (整数に切り上げ)
 * 到達日 = 開始日 + 日数
 *
 * 注: このツールは「減量」前提のため、目標体重 < 現在体重を要求。
 *   目標体重 ≥ 現在体重 はエラー (増量モードは扱わない)。
 */
export function calculateDietPeriod(
  inputs: DietPeriodInputs
): DietPeriodOutputs {
  const { current_weight_kg, target_weight_kg, pace_kg_per_week, start_date } =
    inputs;

  if (current_weight_kg <= 0 || target_weight_kg <= 0) {
    throw new Error("体重に正の値を入れてください");
  }
  if (target_weight_kg >= current_weight_kg) {
    throw new Error("目標体重は現在体重より小さい値にしてください");
  }
  if (pace_kg_per_week <= 0) {
    throw new Error("ペースに正の値を入れてください");
  }
  if (!start_date) {
    throw new Error("開始日を入れてください");
  }

  // ISO yyyy-mm-dd を Date に
  const start = new Date(`${start_date}T00:00:00`);
  if (isNaN(start.getTime())) {
    throw new Error("開始日の形式が不正です");
  }

  const needed_kg = Math.round((current_weight_kg - target_weight_kg) * 10) / 10;
  const weeksRaw = needed_kg / pace_kg_per_week;
  const weeks = Math.round(weeksRaw * 10) / 10;
  const days = Math.ceil(weeksRaw * 7);

  // 到達日 = 開始日 + days
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  const end_date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

  // 1 週間あたりの進捗 % = ペース / 必要な減量 × 100
  const weekly_progress_pct =
    Math.round((pace_kg_per_week / needed_kg) * 100 * 10) / 10;

  return {
    needed_kg,
    weeks,
    days,
    end_date,
    weekly_progress_pct,
    pace_advice_level: classifyPace(pace_kg_per_week),
  };
}

/**
 * カーボサイクル強度ごとの係数
 * 高 = 1.85倍 / 中 = 1.0倍 / 低 = 0.5倍
 */
export const INTENSITY_COEFFICIENTS: Record<TrainingIntensity, number> = {
  high: 1.85,
  mid: 1.0,
  low: 0.5,
};

/**
 * PFC + カーボサイクル統合計算
 *
 * STEP 1 (PFC):
 *   P (g) = 体重 × 2 ・ P (kcal) = P × 4   (P9 で たんぱく質係数 = 2 固定)
 *   F (kcal) = カロリー × 脂質比率 ・ F (g) = F / 9
 *   C (kcal) = カロリー − (P + F) ・ C (g) = C / 4
 *
 * STEP 2 (カーボサイクル配分):
 *   週合計 = C × 7 (g)
 *   係数合計 = Σ (各日の係数)
 *   各日の糖質 (g) = (係数 × C × 7) / 係数合計
 *
 * 警告 (順序優先):
 *   - 高 7 日   → カロリーオーバー
 *   - 低 7 日   → 筋肉が育たない
 *   - 高 5 日以上 → ハイカーボ日が多すぎ (週 2-3 日推奨)
 */
export function calculatePfcCarb(inputs: PfcCarbInputs): PfcCarbOutputs {
  const { weight_kg, target_calorie, fat_ratio, intensities } = inputs;

  if (weight_kg <= 0) {
    throw new Error("体重に正の値を入れてください");
  }
  if (target_calorie <= 0) {
    throw new Error("摂取カロリーに正の値を入れてください");
  }
  if (fat_ratio !== 0.2 && fat_ratio !== 0.25 && fat_ratio !== 0.3) {
    throw new Error("脂質比率は 20%/25%/30% から選んでください");
  }

  // 強度の未入力チェック (7 日とも選択必須)
  for (const d of WEEK_DAYS) {
    if (!intensities[d]) {
      throw new Error("月〜日 すべての曜日の強度を選んでください");
    }
  }

  // ----- STEP 1: PFC -----
  const proteinG = Math.round(weight_kg * 2);
  const proteinKcal = proteinG * 4;

  const fatKcal = Math.round(target_calorie * fat_ratio);
  const fatG = Math.round(fatKcal / 9);

  const carbKcal = target_calorie - proteinKcal - fatKcal;
  if (carbKcal <= 0) {
    throw new Error(
      "カロリーが少なすぎます (糖質分が確保できません)。値を見直してください"
    );
  }
  const carbG = Math.round(carbKcal / 4);

  const pct = (kcal: number) =>
    Math.round((kcal / target_calorie) * 100 * 10) / 10;

  // ----- STEP 2: カーボサイクル配分 -----
  let coefSum = 0;
  for (const d of WEEK_DAYS) {
    coefSum += INTENSITY_COEFFICIENTS[intensities[d]];
  }
  const weeklyTotal = carbG * 7;

  const dailyCarbs = {} as Record<WeekDay, number>;
  for (const d of WEEK_DAYS) {
    const g =
      (INTENSITY_COEFFICIENTS[intensities[d]] * weeklyTotal) / coefSum;
    dailyCarbs[d] = Math.round(g);
  }
  const dailyCarbTotal = WEEK_DAYS.reduce((sum, d) => sum + dailyCarbs[d], 0);
  const avg = Math.round(dailyCarbTotal / 7);

  // ----- 警告 -----
  const highCount = WEEK_DAYS.filter(
    (d) => intensities[d] === "high"
  ).length;
  const lowCount = WEEK_DAYS.filter((d) => intensities[d] === "low").length;

  const warnings: string[] = [];
  if (highCount === 7) {
    warnings.push("毎日ハイカーボ日です。カロリーオーバーのリスクがあります");
  } else if (highCount >= 5) {
    warnings.push(
      "ハイカーボ日が多すぎます。週 2〜3 日にすると効果が出やすいです"
    );
  }
  if (lowCount === 7) {
    warnings.push("毎日ローカーボ日です。エネルギー不足で筋肉が育ちにくくなります");
  }

  return {
    protein_g: proteinG,
    protein_kcal: proteinKcal,
    protein_pct: pct(proteinKcal),
    fat_g: fatG,
    fat_kcal: fatKcal,
    fat_pct: pct(fatKcal),
    carb_g: carbG,
    carb_kcal: carbKcal,
    carb_pct: pct(carbKcal),
    daily_carbs: dailyCarbs,
    weekly_carb_total: dailyCarbTotal,
    daily_carb_avg: avg,
    warnings,
  };
}
