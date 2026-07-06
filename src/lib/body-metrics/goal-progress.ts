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

/**
 * 実測ペース＆達成予測 (2026-07-06 体組成改修 フェーズ2 / 予測カード A-2)
 *
 * 方針:
 *   - 減量計画ではなく「実測ペース」ベース。記録が増えるほど精度UP。
 *   - 目標方向に進んでいない/停滞している時は日付を出さず「記録を続けよう」に切替
 *     (= 誤った期待を出さない)。
 *   - 計算シート(体重を指定して逆算)でも etaForTarget を使い回す。
 */

export type PaceInput = { recorded_at: string; weight_kg: number | null };

/** 直近 windowDays 日の体重から 週あたりペース(kg/週) を最小二乗で推定。<2点は null。 */
export function weightPaceKgPerWeek(
  rowsAsc: PaceInput[],
  windowDays = 28
): number | null {
  const pts = rowsAsc
    .filter((r) => r.weight_kg != null)
    .map((r) => ({ t: Date.parse(r.recorded_at) / 86_400_000, w: r.weight_kg as number }));
  if (pts.length < 2) return null;
  const latestT = pts[pts.length - 1].t;
  let win = pts.filter((p) => p.t >= latestT - windowDays);
  if (win.length < 2) win = pts.slice(-2);
  const n = win.length;
  const mt = win.reduce((s, p) => s + p.t, 0) / n;
  const mw = win.reduce((s, p) => s + p.w, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of win) {
    num += (p.t - mt) * (p.w - mw);
    den += (p.t - mt) ** 2;
  }
  if (den === 0) return null;
  return Math.round((num / den) * 7 * 100) / 100; // kg/週 (小数2桁)
}

export type WeightEta =
  | { state: "no_data" } // 記録/目標/ペース不足
  | { state: "stalled" } // 停滞 or 目標と逆方向 → 「記録を続けよう」
  | { state: "eta"; days: number; date: string; kgPerWeek: number }; // date = "YYYY-MM-DD"

const PACE_EPS = 0.05; // kg/週 これ未満は停滞扱い

function etaCore(
  remaining: number,
  kgPerWeek: number,
  nowMs: number
): { days: number; date: string } | null {
  const towards = remaining * kgPerWeek < 0 && Math.abs(kgPerWeek) >= PACE_EPS;
  if (!towards) return null;
  const days = Math.ceil(Math.abs(remaining) / (Math.abs(kgPerWeek) / 7));
  const date = new Date(nowMs + days * 86_400_000).toISOString().slice(0, 10);
  return { days, date };
}

/** 目標体重までの達成予測 (予測カード A-2 用)。 */
export function weightEta(
  currentWeightKg: number | null | undefined,
  targetWeightKg: number | null | undefined,
  kgPerWeek: number | null,
  nowMs: number = Date.now()
): WeightEta {
  if (currentWeightKg == null || targetWeightKg == null || kgPerWeek == null)
    return { state: "no_data" };
  const remaining = currentWeightKg - targetWeightKg;
  const core = etaCore(remaining, kgPerWeek, nowMs);
  if (!core) return { state: "stalled" };
  return { state: "eta", ...core, kgPerWeek };
}

/** 任意の目標体重を指定して現状ペースで逆算 (計算シート用)。到達不能なら null。 */
export function etaForTarget(
  currentWeightKg: number | null | undefined,
  targetWeightKg: number,
  kgPerWeek: number | null,
  nowMs: number = Date.now()
): { days: number; date: string } | null {
  if (currentWeightKg == null || kgPerWeek == null) return null;
  const remaining = currentWeightKg - targetWeightKg;
  if (Math.abs(remaining) < 0.05)
    return { days: 0, date: new Date(nowMs).toISOString().slice(0, 10) };
  return etaCore(remaining, kgPerWeek, nowMs);
}
