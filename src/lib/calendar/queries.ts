/**
 * カレンダー(1日ビュー)の日付指定 取得口。すべて「読むだけ」。
 *  - 体組成 / 学習 / 振り返り をこのファイルに集約。
 *  - 食事(getMealsForDate) / 生活(getDailyCondition) / 添削(daily_feedbacks) は既存を流用。
 *  - トレは連携メモ§2に従い別関数(getWorkoutForCalendar)で追加予定。
 * ゲート: isCalendarUser()(藤田のみ)。DDL不要(連携メモ§5)。
 */
import { listMyBodyMetrics } from "@/lib/body-metrics/queries";
import { createClient } from "@/lib/supabase/server";
import { getLogDetail } from "@/lib/workout/pool-detail";
import { getMyCurrentMenu } from "@/lib/workout/queries";
import { distMenuInfo } from "@/lib/workout/weekly"; // 読むだけ(呼び出しのみ・改変しない)
import { partByExerciseName } from "@/lib/workout/video-master"; // 種目名→8カテ主部位
import type { WorkoutCycles } from "@/lib/workout/types";

// ============================================================
// 体組成: その日の値 + 前日比 + グラフ系列(選択日ハイライトはクライアント)
// ============================================================
export type CalendarBodyMetric = {
  date: string;
  hasRecord: boolean;
  weight_kg: number | null;
  body_fat_percent: number | null;
  waist_cm: number | null;
  // 前日比 = その日より前の直近記録との差(その日に記録がある時のみ算出)
  weightDelta: number | null;
  bodyFatDelta: number | null;
  waistDelta: number | null;
  // グラフ用: date以前の系列(古→新・最大30点)。体重+ウエスト+体脂肪(各null可)。末尾が選択日(記録あれば)。
  series: { date: string; weight: number | null; waist: number | null; fat: number | null }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const diff = (a: number | null, b: number | null): number | null =>
  a != null && b != null ? round1(a - b) : null;

export async function getBodyForCalendar(date: string): Promise<CalendarBodyMetric> {
  const rows = await listMyBodyMetrics(180); // 本人・新しい順
  const today = rows.find((r) => r.recorded_at === date) ?? null;
  // date より前の直近記録(rowsは新しい順なので最初に見つかる過去日が直近)
  const prev = rows.find((r) => r.recorded_at < date) ?? null;

  // グラフは常に直近まで固定表示(選択日で範囲を縮めない)。選択日はチャート側で線上ハイライト。
  const series = rows
    .slice(0, 30)
    .map((r) => ({
      date: r.recorded_at,
      weight: r.weight_kg,
      waist: r.waist_cm,
      fat: r.body_fat_percent,
    }))
    .reverse();

  return {
    date,
    hasRecord: !!today,
    weight_kg: today?.weight_kg ?? null,
    body_fat_percent: today?.body_fat_percent ?? null,
    waist_cm: today?.waist_cm ?? null,
    weightDelta: today ? diff(today.weight_kg, prev?.weight_kg ?? null) : null,
    bodyFatDelta: today ? diff(today.body_fat_percent, prev?.body_fat_percent ?? null) : null,
    waistDelta: today ? diff(today.waist_cm, prev?.waist_cm ?? null) : null,
    series,
  };
}

// ============================================================
// 共通: JST暦日の [start, end) を timestamptz 文字列で作る
// ============================================================
const jstDayRange = (date: string) => {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { start: `${date}T00:00:00+09:00`, end: `${next}T00:00:00+09:00` };
};

type SupaClient = Awaited<ReturnType<typeof createClient>>;

/** lesson_id[] → {title, chapterTitle}(章タイトル付き) */
async function lessonTitleMap(supabase: SupaClient, lessonIds: string[]) {
  const map = new Map<string, { title: string; chapterTitle: string }>();
  if (lessonIds.length === 0) return map;
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, chapter_id")
    .in("id", lessonIds);
  const chIds = Array.from(new Set((lessons ?? []).map((l) => l.chapter_id as string)));
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title")
    .in("id", chIds);
  const chMap = new Map<string, string>(
    (chapters ?? []).map((c) => [c.id as string, c.title as string])
  );
  for (const l of lessons ?? []) {
    map.set(l.id as string, {
      title: l.title as string,
      chapterTitle: chMap.get(l.chapter_id as string) ?? "",
    });
  }
  return map;
}

// ============================================================
// 学習: その日に視聴/完了したレッスン(last_watched_at がその日・視聴も完了も更新される)
// ============================================================
export type CalendarLearnedLesson = {
  lessonId: string;
  title: string;
  chapterTitle: string;
  completed: boolean;
};

export async function getLearnedForCalendar(
  date: string
): Promise<CalendarLearnedLesson[]> {
  const supabase = await createClient();
  const { start, end } = jstDayRange(date);
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, is_completed, last_watched_at")
    .gte("last_watched_at", start)
    .lt("last_watched_at", end)
    .order("last_watched_at", { ascending: false });
  const rows = (data ?? []) as { lesson_id: string; is_completed: boolean }[];
  if (rows.length === 0) return [];
  const titles = await lessonTitleMap(
    supabase,
    rows.map((r) => r.lesson_id)
  );
  return rows.map((r) => ({
    lessonId: r.lesson_id,
    title: titles.get(r.lesson_id)?.title ?? "レッスン",
    chapterTitle: titles.get(r.lesson_id)?.chapterTitle ?? "",
    completed: !!r.is_completed,
  }));
}

// ============================================================
// 振り返り: その日に書いた振り返り(created_at がその日)
// ============================================================
export type CalendarReview = {
  lessonId: string;
  lessonTitle: string;
  learned: string | null;
  impressed: string | null;
  next_action: string | null;
};

export async function getReviewsForCalendar(
  date: string
): Promise<CalendarReview[]> {
  const supabase = await createClient();
  const { start, end } = jstDayRange(date);
  const { data } = await supabase
    .from("lesson_reviews")
    .select("lesson_id, learned, impressed, next_action, created_at")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as {
    lesson_id: string;
    learned: string | null;
    impressed: string | null;
    next_action: string | null;
  }[];
  if (rows.length === 0) return [];
  const titles = await lessonTitleMap(
    supabase,
    rows.map((r) => r.lesson_id)
  );
  return rows.map((r) => ({
    lessonId: r.lesson_id,
    lessonTitle: titles.get(r.lesson_id)?.title ?? "レッスン",
    learned: r.learned,
    impressed: r.impressed,
    next_action: r.next_action,
  }));
}

// ============================================================
// トレ: その日の実施記録(連携メモ§2)。予定は出さない(暦日に予定を紐づけないモデル)。
//   実績なし = "none"(記録なし+記録するボタン) / rest_done = "rest" / それ以外 = "done"。
//   実施部位は上部集約のみ(配布=distMenuInfo().target / じぶん=primary_target)。
//   種目行の部位バッジは出さない(V2画面と一貫)。
// ============================================================
export type CalendarWorkoutExercise = {
  name: string;
  part: string | null; // 種目の主部位(8カテ・partByExerciseName)。不明は null=タグ無し
  sets: { kg: number | null; reps: number | null }[];
};
export type CalendarWorkout =
  | { state: "none" }
  | { state: "rest" }
  | {
      state: "done";
      isCustom: boolean;
      menuName: string;
      exCount: number;
      parts: string[]; // 実施部位(上部集約)
      exercises: CalendarWorkoutExercise[];
    };

export async function getWorkoutForCalendar(date: string): Promise<CalendarWorkout> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "none" };

  // 同日複数は completed_at 最新の1件(連携メモ§2)
  const { data: logs } = await supabase
    .from("user_workout_logs")
    .select("id, status, is_custom, day_number, primary_target, completed_at")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("completed_at", { ascending: false })
    .limit(1);
  const log = (logs ?? [])[0] as
    | {
        id: string;
        status: string;
        is_custom: boolean;
        day_number: number | null;
        primary_target: string | null;
      }
    | undefined;
  if (!log) return { state: "none" };
  if (log.status === "rest_done") return { state: "rest" };

  const detail = await getLogDetail(log.id);
  const isCustom = !!log.is_custom;

  // 実施部位(上部集約): じぶん=primary_target / 配布=distMenuInfo().target を「・」分割
  let parts: string[] = [];
  if (isCustom) {
    parts = (log.primary_target ?? "")
      .split("・")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (log.day_number != null) {
    const menu = await getMyCurrentMenu(user.id);
    const cycles = (menu?.cycles ?? []) as WorkoutCycles;
    const target = distMenuInfo(cycles, log.day_number).target;
    parts = (target ?? "")
      .split("・")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const exercises: CalendarWorkoutExercise[] = (detail?.exercises ?? []).map((e) => ({
    name: e.name,
    part: partByExerciseName(e.name),
    sets: e.sets.map((s) => ({ kg: s.kg, reps: s.reps })),
  }));

  return {
    state: "done",
    isCustom,
    menuName: detail?.menuName ?? (isCustom ? "じぶんメニュー" : ""),
    exCount: exercises.length,
    parts,
    exercises,
  };
}

// ============================================================
// ボディ写真: その日に撮った体型写真(body_photos・recorded_at=date)。署名URLを発行。
// ============================================================
export type CalendarBodyPhoto = {
  id: string;
  thumbUrl: string | null;
  note: string | null;
};

export async function getBodyPhotosForCalendar(
  date: string
): Promise<CalendarBodyPhoto[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("body_photos")
    .select("id, note, storage_path, thumb_path")
    .eq("user_id", user.id)
    .eq("recorded_at", date)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as {
    id: string;
    note: string | null;
    storage_path: string;
    thumb_path: string | null;
  }[];
  if (rows.length === 0) return [];
  const paths = Array.from(new Set(rows.map((r) => r.thumb_path ?? r.storage_path)));
  const { data: signed } = await supabase.storage
    .from("body-photos")
    .createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    thumbUrl: urlByPath.get(r.thumb_path ?? r.storage_path) ?? null,
    note: r.note,
  }));
}
