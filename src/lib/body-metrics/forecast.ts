/**
 * 体重「見通し」機能の計算 (M20・確定版・2026-07-10)
 *
 * 方針(モック確定):
 *   - 実測ペース(kg/週・符号つき)を基準に「このペースだと」を出す。
 *   - 道のりは毎回「今日の体重」起点で目標日まで線形に引き直す(遅れの借金を積まない)。
 *   - 差分メッセージは4状態。安全域=週0.2〜0.8kg。超えても計算は隠さず警告トーン。
 *   - 記録2点未満/目標未設定/達成済み のエッジは呼び出し側で分岐(下の helper が null を返す)。
 */

const DAY = 86_400_000;
export const SAFE_MIN = 0.2; // kg/週
export const SAFE_MAX = 0.8; // kg/週

export type ForecastPeriod = {
  key: "1w" | "2w" | "1m" | "2m" | "goal";
  label: string;
  days: number | null; // goal は null(目標日まで)
};

export const FORECAST_PERIODS: ForecastPeriod[] = [
  { key: "1w", label: "1週間", days: 7 },
  { key: "2w", label: "2週間", days: 14 },
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "2m", label: "2ヶ月", days: 60 },
  { key: "goal", label: "目標日まで", days: null },
];

function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY);
}

/** M/D 表記 */
export function mdLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 実測ペースで days 日後の体重を予測 (pace= kg/週・符号つき) */
export function projectWeight(current: number, paceKgPerWeek: number, days: number): number {
  return round1(current + (paceKgPerWeek * days) / 7);
}

/** 目標日までの理想線上で、today から days 日後にいるべき体重(線形) */
export function idealWeightAt(
  current: number,
  target: number,
  totalDaysToGoal: number,
  days: number
): number {
  if (totalDaysToGoal <= 0) return target;
  const frac = Math.min(1, Math.max(0, days / totalDaysToGoal));
  return round1(current + (target - current) * frac);
}

export type RoadmapPoint = {
  ms: number;
  label: string;
  weight: number;
  kind: "today" | "next" | "mid" | "goal";
};

/** 今日起点・週次の道のり(最後は目標日=目標体重) */
export function buildRoadmap(
  current: number,
  target: number,
  nowMs: number,
  goalMs: number
): RoadmapPoint[] {
  const total = daysBetween(nowMs, goalMs);
  const pts: RoadmapPoint[] = [
    { ms: nowMs, label: "今日", weight: round1(current), kind: "today" },
  ];
  if (total <= 0) {
    pts.push({ ms: goalMs, label: mdLabel(goalMs), weight: round1(target), kind: "goal" });
    return pts;
  }
  for (let d = 7; d < total; d += 7) {
    pts.push({
      ms: nowMs + d * DAY,
      label: mdLabel(nowMs + d * DAY),
      weight: idealWeightAt(current, target, total, d),
      kind: pts.length === 1 ? "next" : "mid",
    });
  }
  pts.push({ ms: goalMs, label: `${mdLabel(goalMs)}（目標日）`, weight: round1(target), kind: "goal" });
  // 2点目を「次の通過点」に確定(週次が1点も無い短期のケア)
  if (pts.length >= 2 && pts[1].kind !== "next") pts[1].kind = "next";
  return pts;
}

export type DiffState = 1 | 2 | 3 | 4;

export type ForecastResult = {
  predicted: number; // 選択期間後の予測体重
  checkpoint: number; // 同時点の理想(通過点)体重
  diffKg: number; // 予測と理想の差(絶対値・0.1)
  state: DiffState;
  message: string;
  requiredPace: number | null; // 目標日に間に合う必要ペース kg/週(絶対値)
};

const MESSAGES: Record<DiffState, string> = {
  1: "いいペースです。この調子でいきましょう",
  2: "今週すこしだけペースアップしてみましょう",
  3: "急いで取り返す必要はありません。目標日を見直すのもひとつの手です",
  4: "停滞する週は誰にでもあります。記録が続いていることが一番の成果です",
};

/**
 * 選択期間の予測・通過点・4状態を計算。
 * pace=実測 kg/週(符号つき)。target方向に進んでいない/停滞は state4。
 */
export function computeForecast(
  current: number,
  target: number,
  paceKgPerWeek: number | null,
  nowMs: number,
  goalMs: number,
  period: ForecastPeriod
): ForecastResult {
  const total = daysBetween(nowMs, goalMs);
  const days = period.days ?? Math.max(0, total);
  const remaining = current - target; // >0: これから減らす / <0: 増やす

  // 必要ペース(目標日に間に合わせる・絶対値)
  const requiredPace =
    total > 0 ? round2((Math.abs(remaining) / total) * 7) : null;

  // 停滞 or 逆行(目標方向に動いていない)
  const towards = paceKgPerWeek != null && remaining * paceKgPerWeek < 0 && Math.abs(paceKgPerWeek) >= 0.05;
  if (!towards) {
    return {
      predicted: round1(current + (paceKgPerWeek ?? 0) * (days / 7)),
      checkpoint: idealWeightAt(current, target, total, days),
      diffKg: 0,
      state: 4,
      message: MESSAGES[4],
      requiredPace,
    };
  }

  const predicted = projectWeight(current, paceKgPerWeek, days);
  const checkpoint = idealWeightAt(current, target, total, days);
  const predictedDist = Math.abs(predicted - target);
  const checkpointDist = Math.abs(checkpoint - target);
  const diffKg = round1(Math.max(0, predictedDist - checkpointDist));

  let state: DiffState;
  if (predictedDist <= checkpointDist + 0.05) {
    state = 1; // 順調(理想以上)
  } else if (requiredPace != null && requiredPace > SAFE_MAX) {
    state = 3; // 必要ペースが安全域超
  } else {
    state = 2; // 少し足りない
  }

  const message =
    state === 2 ? `差は${diffKg}kg。${MESSAGES[2]}` : MESSAGES[state];

  return { predicted, checkpoint, diffKg, state, message, requiredPace };
}

/** 指定ペース(絶対値 kg/週)で目標体重に到達する日。到達方向でなければ null。 */
export function etaForPace(
  current: number,
  target: number,
  paceAbsKgPerWeek: number,
  nowMs: number
): number | null {
  const remaining = Math.abs(current - target);
  if (remaining < 0.05) return nowMs;
  if (paceAbsKgPerWeek < 0.01) return null;
  const days = Math.ceil(remaining / (paceAbsKgPerWeek / 7));
  return nowMs + days * DAY;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
