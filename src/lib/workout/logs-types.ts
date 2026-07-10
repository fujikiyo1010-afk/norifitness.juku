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
