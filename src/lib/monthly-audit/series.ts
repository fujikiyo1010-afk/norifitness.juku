/**
 * 月次添削データから時系列を抽出するヘルパー
 *
 * 用途: ハブ画面の体組成推移 sparkline 等。
 *
 * 設計方針:
 *   - 受講生 1 人の monthly_audits 配列 (新しい順前提) を受け取り、
 *     古い → 新しい 順の数値配列にして返す
 *   - データが欠落した月は null (sparkline 側で「途切れ」表現)
 */

import {
  AUDIT_QUESTIONS,
  type MonthlyAuditRow,
  type MonthlyAuditItems,
  type AuditCategoryKey,
} from "./types";

export type SeriesPoint = {
  targetMonth: string;        // "2026-05-01"
  value: number | null;       // 未測定 = null
};

/**
 * audits 配列から「Q1 体重 (current_value)」の時系列を取り出す。
 * audits は target_month 降順 (新しい順) で渡される前提。
 * 返り値は古い順。
 */
export function extractWeightSeries(audits: MonthlyAuditRow[]): SeriesPoint[] {
  return [...audits].reverse().map((a) => ({
    targetMonth: a.target_month,
    value: a.items?.q1?.current_value ?? null,
  }));
}

/**
 * audits 配列から「Q2 ウエスト (current_value)」の時系列を取り出す。
 * audits は target_month 降順 (新しい順) で渡される前提。
 * 返り値は古い順。
 */
export function extractWaistSeries(audits: MonthlyAuditRow[]): SeriesPoint[] {
  return [...audits].reverse().map((a) => ({
    targetMonth: a.target_month,
    value: a.items?.q2?.current_value ?? null,
  }));
}

/**
 * 直近の有効値 (null を除いた最新の数値) と、その 1 つ前の有効値を返す。
 * 「現在値 / 前回値」の差分表示用。
 */
export function getLatestAndPrevious(
  series: SeriesPoint[]
): { latest: number | null; previous: number | null } {
  const valid = series.filter((p) => p.value !== null) as Array<{
    targetMonth: string;
    value: number;
  }>;
  if (valid.length === 0) return { latest: null, previous: null };
  const latest = valid[valid.length - 1].value;
  const previous =
    valid.length >= 2 ? valid[valid.length - 2].value : null;
  return { latest, previous };
}

/**
 * "2026-05-01" → "5月" のような短い月ラベル。
 */
export function formatShortMonth(targetMonth: string): string {
  const d = new Date(targetMonth);
  return `${d.getMonth() + 1}月`;
}

// =====================================================================
// カテゴリ別スコア平均 (Q3-Q15)
// =====================================================================

/**
 * 1 audit の items から、指定カテゴリの平均スコアを計算。
 * 該当 Q が 1 つも記入されていなければ null。
 *
 * 対象: type='score' の項目のみ (Q3-Q15)
 */
function avgCategoryScore(
  items: MonthlyAuditItems,
  category: AuditCategoryKey
): number | null {
  const scores: number[] = [];
  for (const q of AUDIT_QUESTIONS) {
    if (q.category !== category) continue;
    if (q.type !== "score") continue;
    const ans = items[q.key as keyof MonthlyAuditItems];
    const s = (ans as { score?: number } | undefined)?.score;
    if (typeof s === "number") scores.push(s);
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export type CategoryAverages = {
  food: { latest: number | null; previous: number | null };
  exercise: { latest: number | null; previous: number | null };
  rest: { latest: number | null; previous: number | null };
  mind: { latest: number | null; previous: number | null };
};

/**
 * 直近 audits から「最新月平均 / 前月平均」を 4 カテゴリで計算。
 * audits は target_month 降順 (新しい順) で渡される前提。
 * 提出済 (submitted_at あり) の audits のみ意味があるが、フィルタは呼び出し側で行う想定。
 */
export function extractCategoryAverages(
  audits: MonthlyAuditRow[]
): CategoryAverages {
  const latest = audits[0]?.items ?? {};
  const previous = audits[1]?.items ?? {};
  return {
    food: {
      latest: avgCategoryScore(latest, "diet"),
      previous: avgCategoryScore(previous, "diet"),
    },
    exercise: {
      latest: avgCategoryScore(latest, "exercise"),
      previous: avgCategoryScore(previous, "exercise"),
    },
    rest: {
      latest: avgCategoryScore(latest, "rest"),
      previous: avgCategoryScore(previous, "rest"),
    },
    mind: {
      latest: avgCategoryScore(latest, "mind_learning"),
      previous: avgCategoryScore(previous, "mind_learning"),
    },
  };
}

// =====================================================================
// BMI 計算
// =====================================================================

export type BMICategory = "低体重" | "適正" | "肥満1度" | "肥満2度以上";

export function classifyBMI(bmi: number): BMICategory {
  if (bmi < 18.5) return "低体重";
  if (bmi < 25) return "適正";
  if (bmi < 30) return "肥満1度";
  return "肥満2度以上";
}

/**
 * 体重 (kg) と身長 (cm) から BMI を計算。
 * どちらか欠けていれば null。
 */
export function calcBMI(
  weightKg: number | null,
  heightCm: number | null | undefined
): number | null {
  if (weightKg === null || !heightCm) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// =====================================================================
// 達成度計算
// =====================================================================

export type GoalProgress = {
  /** 0〜1 の達成率 (0.5 = 50%) */
  ratio: number;
  /** 目標までの残り (符号付き、kg)。減量なら現在→目標がマイナス */
  remaining: number;
  /** "down" = 減量、 "up" = 増量 */
  direction: "down" | "up";
  /** 開始体重との差 (符号付き、累積変化) */
  changedFromStart: number;
};

/**
 * 体重の達成度を計算。
 *
 * @param startWeight 目標シート作成時の体重 (kg) - 開始点
 * @param currentWeight 直近の体重 (kg) - 現在値
 * @param targetWeight 目標体重 (kg)
 *
 * いずれか欠けていれば null。
 * 「達成率」は 開始→目標 の距離に対する 開始→現在 の進捗。
 * 0〜1 にクランプ (超過しても 1.0、後退しても 0.0)。
 */
export function calcWeightProgress(
  startWeight: number | null | undefined,
  currentWeight: number | null,
  targetWeight: number | null | undefined
): GoalProgress | null {
  if (
    typeof startWeight !== "number" ||
    currentWeight === null ||
    typeof targetWeight !== "number"
  ) {
    return null;
  }
  const direction: "down" | "up" = targetWeight < startWeight ? "down" : "up";
  const totalDistance = Math.abs(targetWeight - startWeight);
  if (totalDistance === 0) {
    // 既に開始時 = 目標 (達成済 or 設定ミス)
    return {
      ratio: 1,
      remaining: targetWeight - currentWeight,
      direction,
      changedFromStart: currentWeight - startWeight,
    };
  }
  const traveled =
    direction === "down"
      ? startWeight - currentWeight
      : currentWeight - startWeight;
  const rawRatio = traveled / totalDistance;
  const ratio = Math.max(0, Math.min(1, rawRatio));
  return {
    ratio,
    remaining: targetWeight - currentWeight,
    direction,
    changedFromStart: currentWeight - startWeight,
  };
}
