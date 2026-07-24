/**
 * 管理トレ記録の「重量×回数×セット数」組み立て(2026-07-24)。
 * セット別実績は user_custom_menu_sets(log_id 紐付け)にあるのでそれを使う。
 * 無い旧ログ(旧一本道など)は log_items の代表値(weight_kg/reps/sets)からセットを復元。
 * のり(管理)は名前だけでなく各セットの実績を見られるようにする。
 */
import { cleanExerciseName } from "@/lib/workout/menu-display";

export type AdminSet = { kg: number | null; reps: number | null };
export type AdminDoneExercise = { name: string; added: boolean; sets: AdminSet[] };

export type LogItemRow = {
  exercise_name: string;
  source: string;
  weight_kg?: number | null;
  reps?: number | null;
  sets?: number | null;
};
export type PerSetRow = {
  exercise_name: string;
  exercise_order?: number | null;
  set_number?: number | null;
  weight_kg: number | null;
  reps: number | null;
};

/**
 * 1ログ分の done 種目(セット付き)＋総ボリューム。
 * items=log_items(種目単位・順) / perSet=custom_menu_sets(セット別・同ログ)。
 */
export function buildDoneExercises(
  items: LogItemRow[],
  perSet: PerSetRow[]
): { exercises: AdminDoneExercise[]; totalVolume: number } {
  // 種目名(整形後) → セット別
  const setsByName = new Map<string, AdminSet[]>();
  for (const r of [...perSet].sort(
    (a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0) || (a.set_number ?? 0) - (b.set_number ?? 0)
  )) {
    const nm = cleanExerciseName(r.exercise_name);
    if (!setsByName.has(nm)) setsByName.set(nm, []);
    setsByName.get(nm)!.push({ kg: r.weight_kg, reps: r.reps });
  }

  const exercises: AdminDoneExercise[] = items.map((it) => {
    const nm = cleanExerciseName(it.exercise_name);
    const fromSets = setsByName.get(nm);
    let sets: AdminSet[];
    if (fromSets && fromSets.length > 0) {
      sets = fromSets;
    } else {
      // 旧ログ: 代表値からセットを復元(kg/回 を各セットに複製)
      const n = it.sets && it.sets > 0 ? it.sets : 1;
      sets = Array.from({ length: n }, () => ({ kg: it.weight_kg ?? null, reps: it.reps ?? null }));
    }
    return { name: nm, added: it.source === "added", sets };
  });

  const totalVolume = exercises.reduce(
    (a, ex) => a + ex.sets.reduce((b, s) => b + (s.kg ?? 0) * (s.reps ?? 0), 0),
    0
  );
  return { exercises, totalVolume };
}
