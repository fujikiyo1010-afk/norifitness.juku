/** 生活記録(P6)のクライアント安全な型・ラベル。 */

export type Condition = "good" | "normal" | "bad";
export type Bowel = "yes" | "constipated" | "no";
export type Alcohol = "none" | "little" | "much";

export type DailyConditionData = {
  sleepHours: number | null;
  condition: Condition | null;
  bowel: Bowel | null;
  alcohol: Alcohol | null;
};

export const CONDITION_OPTS: { v: Condition; label: string }[] = [
  { v: "good", label: "良い" },
  { v: "normal", label: "普通" },
  { v: "bad", label: "悪い" },
];
export const BOWEL_OPTS: { v: Bowel; label: string }[] = [
  { v: "yes", label: "あり" },
  { v: "constipated", label: "便秘気味" },
  { v: "no", label: "なし" },
];
export const ALCOHOL_OPTS: { v: Alcohol; label: string }[] = [
  { v: "none", label: "なし" },
  { v: "little", label: "少し" },
  { v: "much", label: "しっかり" },
];

export const CONDITION_LABEL: Record<Condition, string> = {
  good: "良い",
  normal: "普通",
  bad: "悪い",
};
export const BOWEL_LABEL: Record<Bowel, string> = {
  yes: "あり",
  constipated: "便秘気味",
  no: "なし",
};
export const ALCOHOL_LABEL: Record<Alcohol, string> = {
  none: "なし",
  little: "少し",
  much: "しっかり",
};

/** 1項目でも入っているか(＝記録として成立) */
export function hasAnyCondition(d: DailyConditionData | null): boolean {
  if (!d) return false;
  return (
    d.sleepHours != null ||
    d.condition != null ||
    d.bowel != null ||
    d.alcohol != null
  );
}
