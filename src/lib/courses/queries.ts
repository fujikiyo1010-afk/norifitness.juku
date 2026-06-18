import { createClient } from "@/lib/supabase/server";

/**
 * 受講生視点で公開済みコース・章・レッスンを取得する関数群。
 *
 * RLS でも段階公開フィルタはかかるが、admin もこれらのページを「受講生視点で」
 * 確認するため、明示的に released_at <= now() / is_published フィルタを書く。
 *
 * RLS と明示フィルタの 2 重防御で、admin 視点で開いても受講生視点と同じ表示になる。
 */

export type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

export type PublicChapter = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

export type PublicLesson = {
  id: string;
  chapter_id: string;
  title: string;
  description: string | null;
  vimeo_url: string | null;
  summary_video_url: string | null;
  sub_image_url: string | null;
  meta_tags: string[] | null;
  sort_order: number;
};

const nowIso = () => new Date().toISOString();

export async function listPublicCourses(): Promise<PublicCourse[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, title, description, sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PublicCourse[];
}

export async function getPublicCourse(courseId: string): Promise<PublicCourse | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, title, description, sort_order")
    .eq("id", courseId)
    .eq("is_published", true)
    .maybeSingle();
  return (data as PublicCourse | null) ?? null;
}

export async function listPublicChapters(courseId: string): Promise<PublicChapter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, course_id, title, description, sort_order")
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PublicChapter[];
}

export async function getPublicChapter(
  courseId: string,
  chapterId: string
): Promise<PublicChapter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, course_id, title, description, sort_order")
    .eq("id", chapterId)
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .maybeSingle();
  return (data as PublicChapter | null) ?? null;
}

export async function listPublicLessons(chapterId: string): Promise<PublicLesson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, vimeo_url, summary_video_url, sub_image_url, meta_tags, sort_order"
    )
    .eq("chapter_id", chapterId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PublicLesson[];
}

export async function getPublicLesson(
  chapterId: string,
  lessonId: string
): Promise<PublicLesson | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select(
      "id, chapter_id, title, description, vimeo_url, summary_video_url, sub_image_url, meta_tags, sort_order"
    )
    .eq("id", lessonId)
    .eq("chapter_id", chapterId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`)
    .maybeSingle();
  return (data as PublicLesson | null) ?? null;
}

export async function countPublicChapters(courseId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`);
  return count ?? 0;
}

export async function countPublicLessons(chapterId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)
    .or(`released_at.is.null,released_at.lte.${nowIso()}`);
  return count ?? 0;
}

/**
 * 現在のログインユーザーの lesson_progress を取得。
 * RLS により自分の行のみ返るので、明示的なフィルタは不要。
 * 戻り値: lesson_id → is_completed の Map(完了レコードがあるレッスンのみ)
 */
export async function getMyLessonProgress(
  lessonIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (lessonIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, is_completed")
    .in("lesson_id", lessonIds);

  (data ?? []).forEach((row) => {
    map.set(row.lesson_id as string, row.is_completed as boolean);
  });
  return map;
}

export type LessonReview = {
  id: string;
  learned: string | null;
  impressed: string | null;
  next_action: string | null;
  updated_at: string;
};

export type MyReviewWithContext = {
  id: string;
  lesson_id: string;
  lesson_title: string;
  chapter_id: string;
  chapter_title: string;
  course_id: string;
  course_title: string;
  course_sort_order: number;
  chapter_sort_order: number;
  lesson_sort_order: number;
  learned: string | null;
  impressed: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

export type UnreviewedCompletedLesson = {
  lesson_id: string;
  lesson_title: string;
  chapter_id: string;
  chapter_title: string;
  course_id: string;
  course_title: string;
  completed_at: string;
};

/**
 * 自分の全振り返りをコース/章タイトル込みで取得。
 * 並び順は updated_at desc (デフォルト「新しい順」のためのまま)。
 */
export async function listMyReviewsWithContext(): Promise<MyReviewWithContext[]> {
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("lesson_reviews")
    .select(
      "id, lesson_id, learned, impressed, next_action, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (!reviews || reviews.length === 0) return [];

  // レッスン情報取得
  const lessonIds = reviews.map((r) => r.lesson_id as string);
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, chapter_id, sort_order")
    .in("id", lessonIds);
  const lessonMap = new Map<
    string,
    { id: string; title: string; chapter_id: string; sort_order: number }
  >(
    (lessons ?? []).map((l) => [
      l.id as string,
      {
        id: l.id as string,
        title: l.title as string,
        chapter_id: l.chapter_id as string,
        sort_order: l.sort_order as number,
      },
    ])
  );

  // 章情報取得
  const chapterIds = Array.from(
    new Set(Array.from(lessonMap.values()).map((l) => l.chapter_id))
  );
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, course_id, sort_order")
    .in("id", chapterIds);
  const chapterMap = new Map<
    string,
    { id: string; title: string; course_id: string; sort_order: number }
  >(
    (chapters ?? []).map((c) => [
      c.id as string,
      {
        id: c.id as string,
        title: c.title as string,
        course_id: c.course_id as string,
        sort_order: c.sort_order as number,
      },
    ])
  );

  // コース情報取得
  const courseIds = Array.from(
    new Set(Array.from(chapterMap.values()).map((c) => c.course_id))
  );
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, sort_order")
    .in("id", courseIds);
  const courseMap = new Map<
    string,
    { id: string; title: string; sort_order: number }
  >(
    (courses ?? []).map((c) => [
      c.id as string,
      {
        id: c.id as string,
        title: c.title as string,
        sort_order: c.sort_order as number,
      },
    ])
  );

  return reviews
    .map((r): MyReviewWithContext | null => {
      const lesson = lessonMap.get(r.lesson_id as string);
      if (!lesson) return null;
      const chapter = chapterMap.get(lesson.chapter_id);
      if (!chapter) return null;
      const course = courseMap.get(chapter.course_id);
      if (!course) return null;
      return {
        id: r.id as string,
        lesson_id: r.lesson_id as string,
        lesson_title: lesson.title,
        chapter_id: chapter.id,
        chapter_title: chapter.title,
        course_id: course.id,
        course_title: course.title,
        course_sort_order: course.sort_order,
        chapter_sort_order: chapter.sort_order,
        lesson_sort_order: lesson.sort_order,
        learned: (r.learned as string | null) ?? null,
        impressed: (r.impressed as string | null) ?? null,
        next_action: (r.next_action as string | null) ?? null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    })
    .filter((r): r is MyReviewWithContext => r !== null);
}

/**
 * 自分が完了マークしたが、振り返り未記入のレッスン一覧。
 * 未記入モード(D)の表示用。
 */
export async function listMyUnreviewedCompletedLessons(): Promise<UnreviewedCompletedLesson[]> {
  const supabase = await createClient();

  // 完了済み進捗
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed_at")
    .eq("is_completed", true)
    .order("completed_at", { ascending: false });
  if (!progress || progress.length === 0) return [];
  const completedMap = new Map<string, string>(
    progress.map((p) => [p.lesson_id as string, (p.completed_at as string) ?? ""])
  );
  const completedIds = Array.from(completedMap.keys());

  // 既に振り返り書いたレッスン id
  const { data: reviews } = await supabase
    .from("lesson_reviews")
    .select("lesson_id")
    .in("lesson_id", completedIds);
  const reviewedIds = new Set((reviews ?? []).map((r) => r.lesson_id as string));

  const unreviewedIds = completedIds.filter((id) => !reviewedIds.has(id));
  if (unreviewedIds.length === 0) return [];

  // レッスン + 章 + コース情報
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, chapter_id")
    .in("id", unreviewedIds);

  const chapterIds = Array.from(
    new Set((lessons ?? []).map((l) => l.chapter_id as string))
  );
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, course_id")
    .in("id", chapterIds);
  const chapterMap = new Map<
    string,
    { id: string; title: string; course_id: string }
  >(
    (chapters ?? []).map((c) => [
      c.id as string,
      {
        id: c.id as string,
        title: c.title as string,
        course_id: c.course_id as string,
      },
    ])
  );

  const courseIds = Array.from(
    new Set(Array.from(chapterMap.values()).map((c) => c.course_id))
  );
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", courseIds);
  const courseMap = new Map<string, { id: string; title: string }>(
    (courses ?? []).map((c) => [
      c.id as string,
      { id: c.id as string, title: c.title as string },
    ])
  );

  return (lessons ?? [])
    .map((l): UnreviewedCompletedLesson | null => {
      const chapter = chapterMap.get(l.chapter_id as string);
      if (!chapter) return null;
      const course = courseMap.get(chapter.course_id);
      if (!course) return null;
      return {
        lesson_id: l.id as string,
        lesson_title: l.title as string,
        chapter_id: chapter.id,
        chapter_title: chapter.title,
        course_id: course.id,
        course_title: course.title,
        completed_at: completedMap.get(l.id as string) ?? "",
      };
    })
    .filter((l): l is UnreviewedCompletedLesson => l !== null);
}

/**
 * 振り返り 達成バンド用 集計 (2026-06-18 Phase 3)
 *
 * - total: 全件数
 * - thisWeek: 今週書いた (created_at >= 今週月曜 0:00 JST)
 * - streakDays: 連続日数 (= 今日まで連続して書いた日数。 今日 or 昨日に書いてなければ 0)
 * - nextMilestone: 次の節目 (5 件単位)
 * - milestoneProgress: 現節目までの達成率
 */
export type ReviewsStats = {
  total: number;
  thisWeek: number;
  streakDays: number;
  nextMilestone: number;
  milestoneProgress: number;
};

export async function getReviewsStats(): Promise<ReviewsStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      total: 0,
      thisWeek: 0,
      streakDays: 0,
      nextMilestone: 5,
      milestoneProgress: 0,
    };
  }

  const { data: rows } = await supabase
    .from("lesson_reviews")
    .select("created_at")
    .order("created_at", { ascending: false });
  const all = (rows ?? []) as { created_at: string }[];

  const total = all.length;

  // JST 今週月曜 0:00
  const now = new Date();
  const jstOffsetMs = 9 * 3600 * 1000;
  const jstNow = new Date(now.getTime() + jstOffsetMs);
  const dayOfWeek = jstNow.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const jstMondayMidnight = new Date(jstNow);
  jstMondayMidnight.setUTCDate(jstNow.getUTCDate() - daysSinceMonday);
  jstMondayMidnight.setUTCHours(0, 0, 0, 0);
  const mondayUtcIso = new Date(
    jstMondayMidnight.getTime() - jstOffsetMs
  ).toISOString();

  const thisWeek = all.filter((r) => r.created_at >= mondayUtcIso).length;

  // 連続日数 (JST 日付ベース)
  // - 今日 or 昨日 に書いたものから始まる連続日数
  // - 今日も昨日もなければ 0
  const dateSet = new Set<string>();
  for (const r of all) {
    const jstDate = new Date(new Date(r.created_at).getTime() + jstOffsetMs);
    const y = jstDate.getUTCFullYear();
    const m = jstDate.getUTCMonth();
    const d = jstDate.getUTCDate();
    dateSet.add(`${y}-${m}-${d}`);
  }
  const jstTodayY = jstNow.getUTCFullYear();
  const jstTodayM = jstNow.getUTCMonth();
  const jstTodayD = jstNow.getUTCDate();
  // 今日 or 昨日 がなければ streak=0
  const todayKey = `${jstTodayY}-${jstTodayM}-${jstTodayD}`;
  const yesterdayJst = new Date(jstNow);
  yesterdayJst.setUTCDate(jstNow.getUTCDate() - 1);
  const yKey = `${yesterdayJst.getUTCFullYear()}-${yesterdayJst.getUTCMonth()}-${yesterdayJst.getUTCDate()}`;
  let streakDays = 0;
  if (dateSet.has(todayKey)) {
    streakDays = 1;
    const cursor = new Date(jstNow);
    while (true) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}-${cursor.getUTCDate()}`;
      if (dateSet.has(key)) streakDays++;
      else break;
    }
  } else if (dateSet.has(yKey)) {
    streakDays = 1;
    const cursor = new Date(yesterdayJst);
    while (true) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}-${cursor.getUTCDate()}`;
      if (dateSet.has(key)) streakDays++;
      else break;
    }
  }

  const nextMilestone = Math.max(5, Math.ceil((total + 1) / 5) * 5);
  const prevMilestone = nextMilestone - 5;
  const milestoneProgress =
    nextMilestone === prevMilestone
      ? 100
      : Math.round(
          ((total - prevMilestone) / (nextMilestone - prevMilestone)) * 100
        );

  return {
    total,
    thisWeek,
    streakDays,
    nextMilestone,
    milestoneProgress: Math.max(0, Math.min(100, milestoneProgress)),
  };
}

/**
 * フラッシュバック用に過去の振り返りを 1 件ランダムに返す。
 * 直近 1 日以内の振り返りは除外(直近すぎると驚きがない)。
 * 全部直近なら null。
 */
export async function getMyFlashbackReview(): Promise<MyReviewWithContext | null> {
  const reviews = await listMyReviewsWithContext();
  if (reviews.length === 0) return null;
  const oneDayAgo = Date.now() - 24 * 3600 * 1000;
  const eligible = reviews.filter(
    (r) => new Date(r.created_at).getTime() < oneDayAgo
  );
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * 現在のログインユーザーの 3 行振り返りを取得。
 * 未記入なら null。RLS により他人の振り返りは取得不可。
 */
export async function getMyLessonReview(
  lessonId: string
): Promise<LessonReview | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_reviews")
    .select("id, learned, impressed, next_action, updated_at")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    learned: (data.learned as string | null) ?? null,
    impressed: (data.impressed as string | null) ?? null,
    next_action: (data.next_action as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

/**
 * コースに含まれる公開済みレッスンの ID 配列を取得。
 * 進捗集計のために使う。
 */
export async function listLessonIdsInCourse(courseId: string): Promise<string[]> {
  const supabase = await createClient();
  // chapters の released_at と courses の is_published は RLS で対応済み。
  // ただし admin が「受講生視点で」見るとき RLS が緩いので、明示フィルタも入れる。
  const now = nowIso();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${now}`);
  const chapterIds = (chapters ?? []).map((c) => c.id as string);
  if (chapterIds.length === 0) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .in("chapter_id", chapterIds)
    .or(`released_at.is.null,released_at.lte.${now}`);
  return (lessons ?? []).map((l) => l.id as string);
}

/**
 * コース内全レッスンを 章 sort_order → レッスン sort_order の順で
 * フラットリストとして返す ・ 「次のレッスン / 前のレッスン」 ナビに使う
 */
type FlatLesson = {
  chapter_id: string;
  chapter_title: string;
  chapter_sort_order: number;
  lesson_id: string;
  lesson_title: string;
  lesson_sort_order: number;
};

export async function listLessonsFlatInCourse(courseId: string): Promise<FlatLesson[]> {
  const supabase = await createClient();
  const now = nowIso();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .or(`released_at.is.null,released_at.lte.${now}`)
    .order("sort_order", { ascending: true });
  const chapterIds = (chapters ?? []).map((c) => c.id as string);
  if (chapterIds.length === 0) return [];

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, chapter_id, title, sort_order")
    .in("chapter_id", chapterIds)
    .or(`released_at.is.null,released_at.lte.${now}`)
    .order("sort_order", { ascending: true });

  const chapterMap = new Map(
    (chapters ?? []).map((c) => [
      c.id as string,
      { title: c.title as string, sort_order: c.sort_order as number },
    ]),
  );

  return (lessons ?? [])
    .map((l) => {
      const chap = chapterMap.get(l.chapter_id as string);
      return {
        chapter_id: l.chapter_id as string,
        chapter_title: chap?.title ?? "",
        chapter_sort_order: chap?.sort_order ?? 0,
        lesson_id: l.id as string,
        lesson_title: l.title as string,
        lesson_sort_order: l.sort_order as number,
      };
    })
    .sort((a, b) => {
      if (a.chapter_sort_order !== b.chapter_sort_order) {
        return a.chapter_sort_order - b.chapter_sort_order;
      }
      return a.lesson_sort_order - b.lesson_sort_order;
    });
}

/**
 * 指定レッスンの 前 / 次 を返す ( 章境界跨ぎ対応 )
 *  - 章末で次レッスン要求 → 次の章 の最初のレッスン
 *  - コース末 → next: null ( コース完了)
 *  - コース先頭 → prev: null
 */
export async function getAdjacentLessons(
  courseId: string,
  currentLessonId: string,
): Promise<{
  prev: { chapter_id: string; lesson_id: string; lesson_title: string } | null;
  next: { chapter_id: string; lesson_id: string; lesson_title: string } | null;
}> {
  const flat = await listLessonsFlatInCourse(courseId);
  const idx = flat.findIndex((l) => l.lesson_id === currentLessonId);
  if (idx < 0) return { prev: null, next: null };
  const prev =
    idx > 0
      ? {
          chapter_id: flat[idx - 1].chapter_id,
          lesson_id: flat[idx - 1].lesson_id,
          lesson_title: flat[idx - 1].lesson_title,
        }
      : null;
  const next =
    idx < flat.length - 1
      ? {
          chapter_id: flat[idx + 1].chapter_id,
          lesson_id: flat[idx + 1].lesson_id,
          lesson_title: flat[idx + 1].lesson_title,
        }
      : null;
  return { prev, next };
}
