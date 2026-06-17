import {
  AUDIT_CATEGORIES,
  AUDIT_QUESTIONS,
  type AuditCategoryKey,
  type MonthlyAuditItems,
  type MonthlyAuditRow,
  type ScoreAnswer,
} from "./types";

/**
 * 月次添削 集計 (2026-06-17 線① 1 件目から表示対応)
 *
 * - getCategoryAverages: 単一 audit の カテゴリ別平均スコア
 * - getOverallAverage:   単一 audit の 全 score 項目平均 (推移グラフ用)
 * - buildTrend:          複数 audit の 月次推移 (時系列順)
 *
 * 仕様:
 *   - score 項目 = q3-q15 (= ScoreAnswer, 0-10)
 *   - reflection (q16, q17) + body shape (q1, q2) は除外
 *   - 未記入は計算対象から除外 (NaN 回避)
 */

const SCORE_QUESTION_KEYS = AUDIT_QUESTIONS.filter(
  (q) => q.type === "score"
).map((q) => q.key) as (keyof MonthlyAuditItems)[];

const SCORE_QUESTIONS_BY_CATEGORY = (() => {
  const map = new Map<AuditCategoryKey, string[]>();
  for (const q of AUDIT_QUESTIONS) {
    if (q.type !== "score") continue;
    if (!map.has(q.category)) map.set(q.category, []);
    map.get(q.category)!.push(q.key);
  }
  return map;
})();

export type CategoryAverage = {
  category: AuditCategoryKey;
  label: string;
  average: number | null; // 0-10、 全項目未記入なら null
};

export function getCategoryAverages(items: MonthlyAuditItems): CategoryAverage[] {
  return (Object.keys(AUDIT_CATEGORIES) as AuditCategoryKey[])
    .filter((cat) => SCORE_QUESTIONS_BY_CATEGORY.has(cat))
    .map((cat) => {
      const qKeys = SCORE_QUESTIONS_BY_CATEGORY.get(cat) ?? [];
      const scores = qKeys
        .map((k) => (items[k as keyof MonthlyAuditItems] as ScoreAnswer | undefined)?.score)
        .filter((s): s is number => typeof s === "number");
      return {
        category: cat,
        label: AUDIT_CATEGORIES[cat].label,
        average:
          scores.length === 0
            ? null
            : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      };
    });
}

export function getOverallAverage(items: MonthlyAuditItems): number | null {
  const scores = SCORE_QUESTION_KEYS.map((k) =>
    (items[k] as ScoreAnswer | undefined)?.score
  ).filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export type TrendPoint = {
  targetMonth: string; // YYYY-MM-DD
  monthLabel: string; // M月
  average: number; // 0-10
};

/**
 * 提出済み audit を 時系列順 (古い→新しい) で集計。
 * 1 件のみでもグラフ描画可能 (= 単独点表示)。
 */
export function buildTrend(audits: MonthlyAuditRow[]): TrendPoint[] {
  return [...audits]
    .filter((a) => a.submitted_at !== null)
    .sort((a, b) => a.target_month.localeCompare(b.target_month))
    .map((a) => {
      const avg = getOverallAverage(a.items);
      if (avg === null) return null;
      const d = new Date(a.target_month);
      return {
        targetMonth: a.target_month,
        monthLabel: `${d.getMonth() + 1}月`,
        average: avg,
      };
    })
    .filter((p): p is TrendPoint => p !== null);
}
