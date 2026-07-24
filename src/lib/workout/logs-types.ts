import type { DayMenu, WorkoutCycles } from "@/lib/workout/types";

/**
 * 実施記録(P5)のクライアント安全な型・純関数(server依存なし)。
 * 強度=cycles の段階(小/中/大)。day_number=その段階の週[day-1]。
 */

export type Intensity = "small" | "medium" | "large";

export const INTENSITY_LABEL: Record<Intensity, string> = {
  small: "小",
  medium: "中",
  large: "大",
};

const STAGE_BY_INTENSITY: Record<Intensity, string> = {
  small: "小",
  medium: "中",
  large: "大",
};

export function resolveDayMenu(
  cycles: WorkoutCycles,
  intensity: Intensity,
  dayNumber: number
): DayMenu | null {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;
  const wantStage = STAGE_BY_INTENSITY[intensity];
  const stage = cycles.find((c) => c.段階 === wantStage) ?? cycles[0];
  const days = stage.週 ?? [];
  return days[dayNumber - 1] ?? null;
}

export function dayCount(cycles: WorkoutCycles, intensity: Intensity): number {
  if (!Array.isArray(cycles) || cycles.length === 0) return 0;
  const wantStage = STAGE_BY_INTENSITY[intensity];
  const stage = cycles.find((c) => c.段階 === wantStage) ?? cycles[0];
  return (stage.週 ?? []).length;
}

export type LoggedItem = {
  exerciseName: string;
  source: "original" | "added";
  weightKg: number | null;
  reps: number | null;
  sets: number | null;
};

/** 原本の回数文字列から reps/sets の初期値を推定("10回±2、2セット"→{reps:10,sets:2}) */
export function parseRepsSets(s: string | null | undefined): {
  reps: number | null;
  sets: number | null;
} {
  if (!s) return { reps: null, sets: null };
  const repsM = s.match(/(\d+)\s*回/);
  const setsM = s.match(/(\d+)\s*セット/);
  return {
    reps: repsM ? Number(repsM[1]) : null,
    sets: setsM ? Number(setsM[1]) : null,
  };
}

/**
 * 回数欄から 重量・回数・セット数 を読む(2026-07-24)。
 * のりは通常「10回±2、1セット」で書くが、たまに「21kgx10x3」(=21kg×10回×3セット)のように
 * 重量を混ぜて書くことがある。その時は配布セット表の初期値に kg も反映する。
 */
export function parseSetSpec(s: string | null | undefined): {
  kg: number | null;
  reps: number | null;
  sets: number | null;
} {
  if (!s) return { kg: null, reps: null, sets: null };
  const kgM = s.match(/(\d+(?:\.\d+)?)\s*(?:kg|㎏|キロ)/i);
  const kg = kgM ? Number(kgM[1]) : null;
  const { reps: repsJ, sets: setsJ } = parseRepsSets(s);
  let reps = repsJ;
  let sets = setsJ;
  // 「NkgxRxS」形式: kg の後ろに x/× 区切りで 回数・セット数
  if (kg != null && (reps == null || sets == null)) {
    const xm = s.match(/(?:kg|㎏|キロ)\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+))?/i);
    if (xm) {
      if (reps == null && xm[1]) reps = Number(xm[1]);
      if (sets == null && xm[2]) sets = Number(xm[2]);
    }
  }
  return { kg, reps, sets };
}
