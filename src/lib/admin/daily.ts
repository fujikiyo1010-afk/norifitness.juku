import { createAdminClient } from "@/lib/supabase/admin";
import { listUsersWithAlerts, type AlertTag } from "@/lib/admin/alerts";
import { getLatestBodyMetricSummary } from "@/lib/body-metrics/queries";
import { getGoalSheetForUser } from "@/lib/goal-sheet/queries";
import { jstTodayStr } from "@/lib/date/jst";

/**
 * デイリー添削（P2a v1）のデータ層。
 * モック: 08_guide/提案_管理_デイリー添削_A3_今日重視.html（M2）
 *
 * v1の方針（マスター P2）: 体組成・学習・カルテ・目標シート・日次FB は実データ。
 * 食事(P4)・トレ(P5)・生活(P6) は各データが揃うまでプレースホルダ。
 */

// =====================================================================
// キュー（今日捌く受講生リスト）
// =====================================================================

export type DailyQueueItem = {
  userId: string;
  name: string;
  initial: string;
  topSeverity: "urgent" | "warn" | null;
  done: boolean; // 今日のFBを送信/確認/スキップ済み
};

export type DailyQueue = {
  date: string;
  total: number;
  doneCount: number;
  attention: DailyQueueItem[]; // 要対応（アラートあり・未処理）
  pending: DailyQueueItem[]; // 未処理（アラートなし）
  done: DailyQueueItem[]; // 処理済み
};

export async function getDailyQueue(dateStr: string): Promise<DailyQueue> {
  const admin = createAdminClient();
  const [usersWithAlerts, fbRes] = await Promise.all([
    listUsersWithAlerts(),
    admin.from("daily_feedbacks").select("user_id").eq("date", dateStr),
  ]);
  const doneSet = new Set((fbRes.data ?? []).map((r) => r.user_id as string));

  const attention: DailyQueueItem[] = [];
  const pending: DailyQueueItem[] = [];
  const done: DailyQueueItem[] = [];

  for (const u of usersWithAlerts) {
    const item: DailyQueueItem = {
      userId: u.userId,
      name: u.userName,
      initial: (u.userName ?? "?").charAt(0),
      topSeverity: u.topSeverity,
      done: doneSet.has(u.userId),
    };
    if (item.done) done.push(item);
    else if (u.topSeverity) attention.push(item);
    else pending.push(item);
  }

  return {
    date: dateStr,
    total: usersWithAlerts.length,
    doneCount: done.length,
    attention,
    pending,
    done,
  };
}

// =====================================================================
// 詳細（選択中の1人）
// =====================================================================

export type DailyBody = {
  weightKg: number | null;
  waistCm: number | null;
  bodyFatPercent: number | null;
  targetWeightKg: number | null;
  remainingKg: number | null; // 目標まで（距離のみ・符号なし）
  weightDelta7d: number | null;
  recordedAt: string | null;
  daysSinceLatest: number | null;
};

export type DailyLearning = {
  completedCount: number;
  totalCount: number;
  percent: number | null;
  latestTitle: string | null;
  latestAt: string | null;
};

export type DailyCarte = {
  gender: string | null;
  environments: string | null;
  frequencyWish: string | null;
  focusBodyParts: string | null;
  purposes: string | null;
  experience: string | null;
  medicalLimits: string | null;
  idealBody: string | null;
  updatedAt: string | null;
} | null;

export type DailyWord = {
  date: string;
  body: string;
  status: "sent" | "checked" | "skipped";
};

export type DailyDetail = {
  userId: string;
  name: string;
  initial: string;
  joinedAt: string | null;
  tags: AlertTag[];
  body: DailyBody;
  learning: DailyLearning;
  carte: DailyCarte;
  goal: {
    targetWeightKg: number | null;
    shortTerm: string | null;
    longTerm: string | null;
    process: string | null;
    selfImage: string | null;
    adminNotes: string | null;
  };
  recentWords: DailyWord[]; // これまでの言葉（日次FB 直近）
  prevFeedback: DailyWord | null; // 前回FB（FBバー左）
  todayFeedback: DailyWord | null; // 今日のFB（あれば編集）
};

export async function getDailyDetail(
  userId: string,
  dateStr: string
): Promise<DailyDetail | null> {
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("id, name, joined_at")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) return null;

  const [bodySummary, goalSheet, carteRes, alerts, fbRes, lessonsRes] =
    await Promise.all([
      getLatestBodyMetricSummary(userId),
      getGoalSheetForUser(userId),
      admin
        .from("user_workout_carte")
        .select(
          "gender, environments, frequency_wish, focus_body_parts, purposes, experience, medical_limits, ideal_body, updated_at"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      listUsersWithAlerts(),
      admin
        .from("daily_feedbacks")
        .select("date, body, status")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(8),
      admin
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", userId)
        .eq("is_completed", true),
    ]);

  // --- 体組成 ---
  const latest = bodySummary.latest;
  const targetWeightKg =
    (goalSheet?.content?.goal_selection?.target_weight_kg as number | undefined) ??
    null;
  const remainingKg =
    latest?.weight_kg != null && targetWeightKg != null
      ? Math.round(Math.abs(latest.weight_kg - targetWeightKg) * 10) / 10
      : null;

  const body: DailyBody = {
    weightKg: latest?.weight_kg ?? null,
    waistCm: latest?.waist_cm ?? null,
    bodyFatPercent: latest?.body_fat_percent ?? null,
    targetWeightKg,
    remainingKg,
    weightDelta7d: bodySummary.weightDelta7d,
    recordedAt: latest?.recorded_at ?? null,
    daysSinceLatest: bodySummary.daysSinceLatest,
  };

  // --- 学習 ---
  const completedLessonIds = (lessonsRes.data ?? []).map(
    (r) => r.lesson_id as string
  );
  const completedCount = completedLessonIds.length;
  // 直近完了レッスンのタイトル
  const withDates = (lessonsRes.data ?? []).filter((r) => r.completed_at);
  withDates.sort((a, b) =>
    (b.completed_at as string).localeCompare(a.completed_at as string)
  );
  const latestLessonId = withDates[0]?.lesson_id as string | undefined;
  const latestAt = (withDates[0]?.completed_at as string | undefined) ?? null;
  let latestTitle: string | null = null;
  if (latestLessonId) {
    const { data: lrow } = await admin
      .from("lessons")
      .select("title")
      .eq("id", latestLessonId)
      .maybeSingle();
    latestTitle = (lrow?.title as string | undefined) ?? null;
  }
  const { count: totalCount } = await admin
    .from("lessons")
    .select("id", { count: "exact", head: true });
  const total = totalCount ?? 0;
  const learning: DailyLearning = {
    completedCount,
    totalCount: total,
    percent: total > 0 ? Math.round((completedCount / total) * 100) : null,
    latestTitle,
    latestAt,
  };

  // --- カルテ ---
  const c = carteRes.data;
  const carte: DailyCarte = c
    ? {
        gender: (c.gender as string | null) ?? null,
        environments: fmtField(c.environments),
        frequencyWish: (c.frequency_wish as string | null) ?? null,
        focusBodyParts: fmtField(c.focus_body_parts),
        purposes: fmtField(c.purposes),
        experience: (c.experience as string | null) ?? null,
        medicalLimits: fmtField(c.medical_limits),
        idealBody: (c.ideal_body as string | null) ?? null,
        updatedAt: (c.updated_at as string | null) ?? null,
      }
    : null;

  // --- アラートタグ ---
  const tags = alerts.find((u) => u.userId === userId)?.tags ?? [];

  // --- 目標シートの言葉 ---
  const gc = goalSheet?.content ?? {};
  const goal = {
    targetWeightKg,
    shortTerm: gc.goal_selection?.short_term ?? null,
    longTerm: gc.goal_selection?.long_term ?? null,
    process: gc.goal_selection?.process ?? null,
    selfImage: gc.positive_goals?.achievement_feeling ?? null,
    adminNotes: goalSheet?.admin_notes ?? null,
  };

  // --- これまでの言葉 / 前回・今日のFB ---
  const fbRows = (fbRes.data ?? []) as {
    date: string;
    body: string | null;
    status: "sent" | "checked" | "skipped";
  }[];
  const recentWords: DailyWord[] = fbRows
    .filter((r) => r.status === "sent" && r.body)
    .map((r) => ({ date: r.date, body: r.body as string, status: r.status }));
  const todayRow = fbRows.find((r) => r.date === dateStr) ?? null;
  const prevRow =
    fbRows.find((r) => r.date < dateStr && r.status === "sent" && r.body) ??
    null;

  return {
    userId,
    name: (userRow.name as string) ?? "受講生",
    initial: ((userRow.name as string) ?? "?").charAt(0),
    joinedAt: (userRow.joined_at as string) ?? null,
    tags,
    body,
    learning,
    carte,
    goal,
    recentWords,
    prevFeedback: prevRow
      ? { date: prevRow.date, body: prevRow.body as string, status: "sent" }
      : null,
    todayFeedback: todayRow
      ? {
          date: todayRow.date,
          body: (todayRow.body as string) ?? "",
          status: todayRow.status,
        }
      : null,
  };
}

// jsonb 配列/文字列を「・」区切りの表示文字列へ
function fmtField(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(" ・ ") : null;
  const s = String(v).trim();
  return s || null;
}

export function jstToday(): string {
  return jstTodayStr();
}
