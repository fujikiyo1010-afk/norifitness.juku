import { createClient } from "@/lib/supabase/server";
import type {
  RealWorldActionRow,
  RealWorldActionWithContext,
} from "./types";

/**
 * 自分の実践リスト一覧 (= /my-log/actions 用)
 *
 * 並び順 (= Q3-A 採用):
 *   - 試してない: created_at desc (= 新しい宣言が上)
 *   - 試した: tried_at desc (= 最近試したのが上)
 *
 * lesson_id → lesson + chapter + course を別クエリで補完 (= 完了履歴と同じパターン)。
 */
export async function listMyActions(): Promise<{
  untried: RealWorldActionWithContext[];
  tried: RealWorldActionWithContext[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { untried: [], tried: [] };

  const { data: rows } = await supabase
    .from("real_world_actions")
    .select("*")
    .eq("user_id", user.id);

  const all = (rows ?? []) as RealWorldActionRow[];

  // lesson_id 経由のコンテキスト補完
  const lessonIds = [
    ...new Set(all.map((r) => r.lesson_id).filter((id): id is string => !!id)),
  ];
  let lessonsMap = new Map<
    string,
    {
      id: string;
      title: string;
      chapter_id: string;
      chapter_title: string;
      course_id: string;
      course_title: string;
    }
  >();

  if (lessonIds.length > 0) {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, chapter_id")
      .in("id", lessonIds);
    const lessonRows = lessons ?? [];

    const chapterIds = [
      ...new Set(lessonRows.map((l) => l.chapter_id as string)),
    ];
    const { data: chapters } = chapterIds.length
      ? await supabase
          .from("chapters")
          .select("id, title, course_id")
          .in("id", chapterIds)
      : { data: [] };
    const chapterRows = chapters ?? [];

    const courseIds = [
      ...new Set(chapterRows.map((c) => c.course_id as string)),
    ];
    const { data: courses } = courseIds.length
      ? await supabase.from("courses").select("id, title").in("id", courseIds)
      : { data: [] };
    const courseTitleMap = new Map(
      (courses ?? []).map((c) => [c.id as string, c.title as string])
    );

    const chapterMap = new Map(
      chapterRows.map((c) => [
        c.id as string,
        {
          title: c.title as string,
          course_id: c.course_id as string,
          course_title: courseTitleMap.get(c.course_id as string) ?? "",
        },
      ])
    );

    lessonsMap = new Map(
      lessonRows.map((l) => {
        const chCtx = chapterMap.get(l.chapter_id as string);
        return [
          l.id as string,
          {
            id: l.id as string,
            title: l.title as string,
            chapter_id: l.chapter_id as string,
            chapter_title: chCtx?.title ?? "",
            course_id: chCtx?.course_id ?? "",
            course_title: chCtx?.course_title ?? "",
          },
        ];
      })
    );
  }

  function attach(row: RealWorldActionRow): RealWorldActionWithContext {
    const ctx = row.lesson_id ? lessonsMap.get(row.lesson_id) : undefined;
    return {
      ...row,
      lesson_title: ctx?.title ?? null,
      chapter_title: ctx?.chapter_title ?? null,
      course_title: ctx?.course_title ?? null,
      chapter_id: ctx?.chapter_id ?? null,
      course_id: ctx?.course_id ?? null,
    };
  }

  const untried = all
    .filter((r) => !r.tried)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(attach);
  const tried = all
    .filter((r) => r.tried)
    .sort((a, b) =>
      (b.tried_at ?? b.created_at).localeCompare(a.tried_at ?? a.created_at)
    )
    .map(attach);

  return { untried, tried };
}

/**
 * 特定レッスンに紐づく自分の実践アクション (= レッスン詳細ページ下部用)
 * 新しい順、 試してない・試した両方含む。
 */
export async function listMyActionsForLesson(
  lessonId: string
): Promise<RealWorldActionRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("real_world_actions")
    .select("*")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  return (data ?? []) as RealWorldActionRow[];
}

/**
 * 達成バンド用 集計 (2026-06-18 Phase 2)
 *
 * - triedTotal: 試した累計 (tried=true)
 * - triedThisWeek: 今週試した (tried_at >= 今週月曜 0:00 JST)
 * - implementationRate: 宣言→実践率 (tried=true / total * 100、 0 件のとき 0)
 * - nextMilestone: 次の節目 (5 件単位、 直近の 5/10/15... の倍数)
 * - milestoneProgress: 現節目までの達成率 (= triedTotal % 5 = 4 のとき 80%、 等)
 */
export type ActionsStats = {
  triedTotal: number;
  triedThisWeek: number;
  totalCount: number;
  implementationRate: number;
  nextMilestone: number;
  milestoneProgress: number;
};

export async function getActionsStats(): Promise<ActionsStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      triedTotal: 0,
      triedThisWeek: 0,
      totalCount: 0,
      implementationRate: 0,
      nextMilestone: 5,
      milestoneProgress: 0,
    };
  }

  const { data: rows } = await supabase
    .from("real_world_actions")
    .select("tried, tried_at")
    .eq("user_id", user.id);
  const all = (rows ?? []) as { tried: boolean; tried_at: string | null }[];

  const triedTotal = all.filter((r) => r.tried).length;
  const totalCount = all.length;

  // 今週月曜 0:00 JST
  const now = new Date();
  const jstOffsetMs = 9 * 3600 * 1000;
  const jstNow = new Date(now.getTime() + jstOffsetMs);
  const dayOfWeek = jstNow.getUTCDay(); // 0 = Sun ... 6 = Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon=0
  const jstMondayMidnight = new Date(jstNow);
  jstMondayMidnight.setUTCDate(jstNow.getUTCDate() - daysSinceMonday);
  jstMondayMidnight.setUTCHours(0, 0, 0, 0);
  const mondayUtcIso = new Date(
    jstMondayMidnight.getTime() - jstOffsetMs
  ).toISOString();

  const triedThisWeek = all.filter(
    (r) => r.tried && r.tried_at !== null && r.tried_at >= mondayUtcIso
  ).length;

  const implementationRate =
    totalCount === 0 ? 0 : Math.round((triedTotal / totalCount) * 100);

  // 次の節目 = 直近の 5 の倍数 (= 0→5, 5→10, ..., 12→15)
  const nextMilestone = Math.max(5, Math.ceil((triedTotal + 1) / 5) * 5);
  const prevMilestone = nextMilestone - 5;
  const milestoneProgress =
    nextMilestone === prevMilestone
      ? 100
      : Math.round(
          ((triedTotal - prevMilestone) / (nextMilestone - prevMilestone)) * 100
        );

  return {
    triedTotal,
    triedThisWeek,
    totalCount,
    implementationRate,
    nextMilestone,
    milestoneProgress: Math.max(0, Math.min(100, milestoneProgress)),
  };
}

/** 単件取得 (= 振り返りモーダル用) */
export async function getMyAction(
  id: string
): Promise<RealWorldActionRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("real_world_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as RealWorldActionRow | null) ?? null;
}
