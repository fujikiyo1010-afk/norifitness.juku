/**
 * 種目 → 動画(Vimeo URL) 解決ヘルパー (W1 配線 2026-06-25)
 *
 * データ元: data/workout_exercise_video_master.json
 *   - スプシ『種目 名寄せ表 v3』+ コース種目フォーム動画 + 50本JSON を統合
 *   - exercises: 確定代表名でユニーク化した一覧 (W3 オートコンプリートの元)
 *   - name_to_url: 「生の種目名 + 確定代表名」→ URL の別名インデックス
 *                  (Exercise.種目名 はテンプレ由来の生名なので、これで一発引き)
 *
 * 設計方針:
 *   - DB の cycles(jsonb) には URL を持たせず、表示/再生時にここで解決するのが基本。
 *     ただし Exercise.video_url が設定されていれば「このメニュー限定の上書き」として優先。
 *   - マスターの再生成は scratchpad/build_master.py。JSON を手編集しない。
 */
import master from "../../../data/workout_exercise_video_master.json";
import type { Exercise } from "./types";

type ExerciseMasterEntry = {
  確定代表名: string;
  部位: string;
  動画名: string;
  video_url: string;
  source: string;
  動画: "あり" | "なし";
  出現合計: number;
};

const NAME_TO_URL = master.name_to_url as Record<string, string>;
const EXERCISES = master.exercises as ExerciseMasterEntry[];

/**
 * 種目名 (生名 or 確定代表名) から既定の動画 URL を引く。
 * 見つからなければ null。
 */
export function lookupVideoByName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_URL[name] ?? null;
}

/**
 * Exercise の実効動画 URL を解決する。
 *   - video_url が undefined         → 種目名から既定動画を解決
 *   - video_url が空文字 ""          → 明示的に「動画なし」(null)
 *   - video_url が文字列            → その URL (このメニュー限定の上書き)
 */
export function resolveExerciseVideo(
  ex: Pick<Exercise, "種目名" | "video_url">
): string | null {
  if (ex.video_url !== undefined) {
    return ex.video_url === "" ? null : ex.video_url;
  }
  return lookupVideoByName(ex.種目名);
}

/** その種目に再生できる動画があるか。 */
export function hasVideo(ex: Pick<Exercise, "種目名" | "video_url">): boolean {
  return resolveExerciseVideo(ex) !== null;
}

/**
 * 種目マスター一覧 (確定代表名でユニーク・8件除外済み)。
 * W3 のオートコンプリート / 動画選択 UI の元データ。
 */
export function listExerciseMaster(): ExerciseMasterEntry[] {
  return EXERCISES;
}

/** 動画ありの種目マスターだけ (動画選択ピッカー用)。 */
export function listExercisesWithVideo(): ExerciseMasterEntry[] {
  return EXERCISES.filter((e) => e.video_url);
}

// URL → 動画名 の逆引き (表示用: 「▶ ダンベルローイング」のように出す)
const URL_TO_VIDEO_NAME: Record<string, string> = {};
for (const e of EXERCISES) {
  if (e.video_url && !URL_TO_VIDEO_NAME[e.video_url]) {
    URL_TO_VIDEO_NAME[e.video_url] = e.動画名;
  }
}

/** 動画 URL から動画名を引く (表示用)。見つからなければ null。 */
export function videoNameByUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return URL_TO_VIDEO_NAME[url] ?? null;
}

// 確定代表名 → 8カテ部位 (主部位の自動補完用)。(不明) や 8カテ外は除外。
const EIGHT_PARTS = new Set(["胸", "背中", "肩", "腕", "脚", "お尻", "腹筋", "全身"]);
const NAME_TO_PART: Record<string, string> = {};
for (const e of EXERCISES) {
  if (e.部位 && EIGHT_PARTS.has(e.部位)) NAME_TO_PART[e.確定代表名] = e.部位;
}

/**
 * 種目名(確定代表名)から 8カテ主部位を引く。
 * 管理画面で種目を選んだ時の主部位 自動補完に使う。該当なし/不明は null。
 */
export function partByExerciseName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_PART[name] ?? null;
}
