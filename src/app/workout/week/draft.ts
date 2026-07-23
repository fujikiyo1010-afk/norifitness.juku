/**
 * 週間トレ再設計(2026-07-23): 決定ドラフトの端末ローカル保持(§2-6)。
 * DB書き込みは表紙「完了」時だけ。決定内容はここ(localStorage・当日キー)に置き、
 * セット表→表紙→(修正で)セット表 の間で持ち回る。日付が変わったら破棄。
 * 既知の制限: 端末別(別端末では表紙復帰せずメイン表示)。
 */
export type DraftSet = { kg: number | null; reps: number | null };
export type DraftExercise = {
  name: string;
  source: "original" | "added";
  videoUrl: string | null;
  sets: DraftSet[];
  baseSets: DraftSet[] | null; // のり初期値(紫差分の基準)・通常色経路は null
};
export type WeeklyDraft = {
  kind: "dist" | "custom";
  dayNumber: number | null;
  menuName: string;
  editLogId: string | null;
  exercises: DraftExercise[];
  memo: string;
  todayKey: string;
};

export function draftKey(todayKey: string): string {
  return `wpool-draft-${todayKey}`;
}

export function loadDraft(todayKey: string): WeeklyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(todayKey));
    if (!raw) return null;
    const d = JSON.parse(raw) as WeeklyDraft;
    if (d.todayKey !== todayKey) return null; // 日跨ぎ=破棄扱い
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(d: WeeklyDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(d.todayKey), JSON.stringify(d));
  } catch {
    /* 容量超過等は無視(完了時にDBへ書くので致命ではない) */
  }
}

export function clearDraft(todayKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(todayKey));
  } catch {
    /* noop */
  }
}
