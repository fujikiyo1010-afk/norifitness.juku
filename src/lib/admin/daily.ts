import { createAdminClient } from "@/lib/supabase/admin";
import { listUsersWithAlerts, type AlertTag, type UserWithAlerts } from "@/lib/admin/alerts";
import { getLatestBodyMetricSummary } from "@/lib/body-metrics/queries";
import { getGoalSheetForUser } from "@/lib/goal-sheet/queries";
import { getCurrentMenuForAdmin } from "@/lib/workout/queries";
import { resolveDayMenu, INTENSITY_LABEL, type Intensity } from "@/lib/workout/logs-types";
import { cleanExerciseName } from "@/lib/workout/menu-display";
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
  hasRecord: boolean; // A: 表示日にその受講生の記録(食事/トレ/生活/体組成)が1件以上ある
  recordMs: number | null; // A: 記録の最新時刻(記録ありの並べ替え用・記録なしはnull)
};

export type DailyQueue = {
  date: string;
  total: number;
  doneCount: number;
  recorded: DailyQueueItem[]; // A: 記録あり（返信待ち）＝記録あり・未処理（記録時刻の新しい順）
  attention: DailyQueueItem[]; // 要対応（アラートあり・記録なし・未処理）
  pending: DailyQueueItem[]; // 未処理（アラートなし・記録なし）
  done: DailyQueueItem[]; // 処理済み
};

export async function getDailyQueue(
  dateStr: string,
  preUsers?: UserWithAlerts[]
): Promise<DailyQueue> {
  const admin = createAdminClient();
  // S2-A: usersWithAlerts は重い全件スキャン。呼び出し元が既に取得済みなら再実行しない
  // (未指定なら従来どおり自前取得＝後方互換)。
  // 件0(2026-07-13 きよむ確定): 「記録あり」に浮上させるのは添削の主戦場=食事とトレの2つだけ。
  //   生活(daily_conditions)・体組成(body_metrics)は浮上条件から外す(取得もしない=軽くなる)。
  //   ※体組成・生活はパネルの状態ストリップ・上部カードで引き続き見える(浮上の合図にしないだけ)。
  const [usersWithAlerts, fbRes, mealRes, workoutRes] = await Promise.all([
    preUsers ?? listUsersWithAlerts(),
    admin.from("daily_feedbacks").select("user_id").eq("date", dateStr),
    admin.from("meal_logs").select("user_id, posted_at").eq("date", dateStr),
    admin.from("user_workout_logs").select("user_id, completed_at, created_at").eq("date", dateStr),
  ]);
  const doneSet = new Set((fbRes.data ?? []).map((r) => r.user_id as string));

  // 記録時刻マップ: 受講生ごとに、その日の記録の「最新時刻」を保持(記録ありの並べ替え用)。
  // トレのスキップは completed_at が無いので created_at を代替に使う(スキップも声かけ材料=記録あり)。
  const recordMsByUser = new Map<string, number>();
  const bump = (userId: string | null, ts: string | null | undefined) => {
    if (!userId || !ts) return;
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) return;
    const cur = recordMsByUser.get(userId);
    if (cur == null || t > cur) recordMsByUser.set(userId, t);
  };
  for (const r of mealRes.data ?? []) bump(r.user_id as string, r.posted_at as string);
  for (const r of workoutRes.data ?? [])
    bump(r.user_id as string, (r.completed_at as string) ?? (r.created_at as string));

  const recorded: DailyQueueItem[] = [];
  const attention: DailyQueueItem[] = [];
  const pending: DailyQueueItem[] = [];
  const done: DailyQueueItem[] = [];

  for (const u of usersWithAlerts) {
    const recordMs = recordMsByUser.get(u.userId) ?? null;
    // 要Go-1: 「のり宿題」(新1〜3)はキューの要対応に出さない=受講生系タグだけで重要度を判定。
    // のり宿題は管理ホームの「今すぐ対応/今日中」でだけ拾う(受講生の放置警報と混ぜない)。
    const studentTags = u.tags.filter((t) => t.category !== "nori_todo");
    const studentSeverity: "urgent" | "warn" | null = studentTags.some(
      (t) => t.severity === "urgent"
    )
      ? "urgent"
      : studentTags.some((t) => t.severity === "warn")
        ? "warn"
        : null;
    const item: DailyQueueItem = {
      userId: u.userId,
      name: u.userName,
      initial: (u.userName ?? "?").charAt(0),
      topSeverity: studentSeverity,
      done: doneSet.has(u.userId),
      hasRecord: recordMs != null,
      recordMs,
    };
    // 区分優先度: 処理済み → 記録あり(返信待ち) → 要対応 → 未処理
    if (item.done) done.push(item);
    else if (item.hasRecord) recorded.push(item);
    else if (studentSeverity) attention.push(item);
    else pending.push(item);
  }
  // 記録ありは記録時刻の新しい順
  recorded.sort((a, b) => (b.recordMs ?? 0) - (a.recordMs ?? 0));

  return {
    date: dateStr,
    total: usersWithAlerts.length,
    doneCount: done.length,
    recorded,
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
  weightDelta30d: number | null; // 件4: 30日差（状態ストリップ用）
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

export type DailyMealForAdmin = {
  mealType: string; // 朝/昼/夕/間
  postedAt: string;
  memo: string | null;
  items: string[];
  photoUrls: string[];
};

export type DailyWorkoutForAdmin = {
  status: "done" | "rest_done" | "skipped";
  dayLabel: string;
  intensity: string; // 小/中/大
  doneNames: string[]; // 原本どおりやった種目
  notDoneNames: string[]; // 原本にあってやらなかった
  addedNames: string[]; // 原本外の追加
  memo: string | null;
};

// まとめパネル(2026-07-13・案B): 「この人の直近」6行。数字の事実のみ・診断文言なし。
export type WorkoutMark = "done" | "rest_done" | "skipped" | "none";
export type DailySummary = {
  weight: {
    values: number[]; // 直近3回(古→新)
    changeLabel: string | null; // 例「3日で0.6減」(増/減・符号なし)。2点未満はnull
    changeDir: "up" | "down" | "flat" | null;
  } | null;
  meal: {
    yesterdayKcal: number | null; // null=昨日は数値なし
    yesterdayPhotoOnly: boolean; // 昨日は食事記録あるが数値なし(=写真のみ)
    avg7Kcal: number | null; // 数値のある日だけで平均
    // 目標PFCとの差(g)。null=目標未設定/数値なし。マイナス=不足/プラス=超過
    pfc: { p: number | null; f: number | null; c: number | null };
    hasGoalPfc: boolean;
  } | null;
  workout: {
    yesterday: WorkoutMark;
    today: WorkoutMark;
    weekDone: number; // 今週(JST月曜起算)の実施(done+rest_done)回数
  };
  life: {
    sleepHours: number | null;
    avgSleep: number | null; // 直近7日の睡眠平均
    condition: "good" | "normal" | "bad" | null;
  } | null;
  learn: { completed: number; total: number; latestLabel: string | null };
  prevFeedback: { quote: string; date: string } | null;
};

export type DailyDetail = {
  userId: string;
  name: string;
  initial: string;
  joinedAt: string | null;
  isBeta: boolean; // 食事/トレ/生活ブロックはベータ受講生時のみ表示(P4-a/P5/P6)
  meals: DailyMealForAdmin[]; // その日の食事(v1-a=写真+品目)
  workout: DailyWorkoutForAdmin | null; // その日のトレ実績(原本×実績の差分)
  condition: import("@/lib/conditions/types").DailyConditionData | null; // その日の生活4問
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
  summary: DailySummary; // まとめパネル用の集約（この人の直近）
};

export async function getDailyDetail(
  userId: string,
  dateStr: string,
  preUsers?: UserWithAlerts[]
): Promise<DailyDetail | null> {
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("id, name, joined_at, is_beta")
    .eq("id", userId)
    .maybeSingle();
  if (!userRow) return null;

  // --- その日の食事(P4-a・写真+品目)。合計/署名URLは admin(service role)で取得 ---
  const meals: DailyMealForAdmin[] = [];
  {
    // S2-D: 親(meal_logs)→子(meal_log_items)の2往復をネストselectで1往復に(service role)。
    const { data: mealRows } = await admin
      .from("meal_logs")
      .select("id, meal_type, posted_at, memo, photos, meal_log_items(name, sort_order)")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .order("posted_at", { ascending: true });
    const rows = (mealRows ?? []) as {
      id: string;
      meal_type: string;
      posted_at: string;
      memo: string | null;
      photos: string[] | null;
      meal_log_items: { name: string; sort_order: number | null }[] | null;
    }[];
    if (rows.length > 0) {
      const allPaths = rows.flatMap((r) => r.photos ?? []);
      const urlByPath = new Map<string, string>();
      if (allPaths.length > 0) {
        const { data: signed } = await admin.storage
          .from("meal-photos")
          .createSignedUrls(allPaths, 3600);
        for (const s of signed ?? []) {
          if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
        }
      }
      const order: Record<string, number> = { 朝: 0, 昼: 1, 夕: 2, 間: 3 };
      for (const r of rows) {
        const items = (r.meal_log_items ?? [])
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((i) => i.name);
        meals.push({
          mealType: r.meal_type,
          postedAt: r.posted_at,
          memo: r.memo,
          items,
          photoUrls: (r.photos ?? [])
            .map((p) => urlByPath.get(p) ?? "")
            .filter(Boolean),
        });
      }
      meals.sort(
        (a, b) =>
          (order[a.mealType] ?? 9) - (order[b.mealType] ?? 9) ||
          a.postedAt.localeCompare(b.postedAt)
      );
    }
  }

  // --- その日のトレ実績(原本×実績の差分・P5) ---
  let workout: DailyWorkoutForAdmin | null = null;
  {
    // S2-D: 親(user_workout_logs)→子(items)の2往復をネストselectで1往復に(service role)。
    const { data: logRow } = await admin
      .from("user_workout_logs")
      .select("id, day_number, intensity, status, memo, user_workout_log_items(exercise_name, source)")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .maybeSingle();
    if (logRow) {
      const items = ((logRow.user_workout_log_items ?? []) as {
        exercise_name: string;
        source: string;
      }[]);
      const doneOriginal = items
        .filter((i) => i.source === "original")
        .map((i) => cleanExerciseName(i.exercise_name));
      const addedNames = items
        .filter((i) => i.source === "added")
        .map((i) => cleanExerciseName(i.exercise_name));
      // 原本の当日種目 → やらなかった差分
      const menu = await getCurrentMenuForAdmin(userId);
      const intensity = (logRow.intensity as Intensity) ?? "medium";
      const dayMenu = menu
        ? resolveDayMenu(menu.cycles, intensity, logRow.day_number as number)
        : null;
      const originalNames = (dayMenu?.種目 ?? [])
        .filter((e) => e.種目名)
        .map((e) => cleanExerciseName(e.種目名));
      const doneSet = new Set(doneOriginal);
      const notDoneNames = originalNames.filter((n) => !doneSet.has(n));
      workout = {
        status: logRow.status as "done" | "rest_done" | "skipped",
        dayLabel: dayMenu?.日 ?? `${logRow.day_number}日目`,
        intensity: INTENSITY_LABEL[intensity] ?? "中",
        doneNames: doneOriginal,
        notDoneNames,
        addedNames,
        memo: (logRow.memo as string | null) ?? null,
      };
    }
  }

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
      // S2-A: タグ抽出用の全件リスト。呼び出し元が取得済みなら再実行しない(後方互換)。
      preUsers ?? listUsersWithAlerts(),
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
    weightDelta30d: bodySummary.weightDelta30d,
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

  // --- 生活記録(P6) ---
  const { data: condRow } = await admin
    .from("daily_conditions")
    .select("sleep_hours, condition, bowel, alcohol")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();
  const condition = condRow
    ? {
        sleepHours: (condRow.sleep_hours as number | null) ?? null,
        condition: (condRow.condition as "good" | "normal" | "bad" | null) ?? null,
        bowel: (condRow.bowel as "yes" | "constipated" | "no" | null) ?? null,
        alcohol: (condRow.alcohol as "none" | "little" | "much" | null) ?? null,
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

  // --- まとめパネル集約(2026-07-13・案B): この人の直近6行 ---
  //   新規は軽量クエリ3本(食事7日/生活睡眠7日/トレ)。他は既存取得(体重直近3/目標PFC/学び/前回FB/当日生活)を配線。
  const yesterdayStr = addDaysStr(dateStr, -1);
  const win7Start = addDaysStr(dateStr, -7); // 直近7日(=昨日まで)の下限
  const weekStart = jstWeekStartStr(dateStr); // 今週(JST月曜起算)
  const workoutSince = weekStart < yesterdayStr ? weekStart : yesterdayStr;
  const [mealWin, sleepWin, workoutWin] = await Promise.all([
    admin
      .from("meal_logs")
      .select("date, meal_log_items(kcal, protein_g, fat_g, carb_g)")
      .eq("user_id", userId)
      .gte("date", win7Start)
      .lte("date", yesterdayStr),
    admin
      .from("daily_conditions")
      .select("sleep_hours")
      .eq("user_id", userId)
      .gte("date", win7Start)
      .lte("date", yesterdayStr),
    admin
      .from("user_workout_logs")
      .select("date, status")
      .eq("user_id", userId)
      .gte("date", workoutSince)
      .lte("date", dateStr),
  ]);

  // 体重: 直近3回の流れ
  const rw = bodySummary.recentWeights;
  let weightSummary: DailySummary["weight"] = null;
  if (rw.length > 0) {
    let changeLabel: string | null = null;
    let changeDir: "up" | "down" | "flat" | null = null;
    if (rw.length >= 2) {
      const first = rw[0];
      const last = rw[rw.length - 1];
      const diff = Math.round((last.value - first.value) * 10) / 10;
      const days = Math.max(1, daysBetween(first.date, last.date));
      changeDir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      changeLabel =
        diff === 0
          ? `${days}日で変わらず`
          : `${days}日で${Math.abs(diff)}kg${diff > 0 ? "増" : "減"}`;
    }
    weightSummary = { values: rw.map((r) => r.value), changeLabel, changeDir };
  }

  // 食事: 日別合計 → 昨日/7日平均/目標PFC差(数値のある日だけ)
  const dayAgg = new Map<
    string,
    { kcal: number; p: number; f: number; c: number; n: number }
  >();
  for (const row of (mealWin.data ?? []) as {
    date: string;
    meal_log_items:
      | { kcal: number | null; protein_g: number | null; fat_g: number | null; carb_g: number | null }[]
      | null;
  }[]) {
    const cur = dayAgg.get(row.date) ?? { kcal: 0, p: 0, f: 0, c: 0, n: 0 };
    for (const it of row.meal_log_items ?? []) {
      if (it.kcal == null && it.protein_g == null && it.fat_g == null && it.carb_g == null)
        continue;
      cur.kcal += it.kcal ?? 0;
      cur.p += it.protein_g ?? 0;
      cur.f += it.fat_g ?? 0;
      cur.c += it.carb_g ?? 0;
      cur.n += 1;
    }
    dayAgg.set(row.date, cur);
  }
  const yday = dayAgg.get(yesterdayStr);
  const numberedDays = [...dayAgg.values()].filter((d) => d.n > 0);
  const avg7Kcal =
    numberedDays.length > 0
      ? Math.round(numberedDays.reduce((s, d) => s + d.kcal, 0) / numberedDays.length)
      : null;
  const goalPfc = goalSheet?.content?.nutrition?.pfc ?? null;
  const hasGoalPfc =
    !!goalPfc && (goalPfc.p != null || goalPfc.f != null || goalPfc.c != null);
  const pfcDiff = (actual: number | undefined, target: number | undefined): number | null =>
    yday && yday.n > 0 && target != null && actual != null
      ? Math.round(actual - target)
      : null;
  const mealSummary: DailySummary["meal"] = {
    yesterdayKcal: yday && yday.n > 0 ? Math.round(yday.kcal) : null,
    yesterdayPhotoOnly: !!(yday && yday.n === 0),
    avg7Kcal,
    pfc: {
      p: pfcDiff(yday?.p, goalPfc?.p),
      f: pfcDiff(yday?.f, goalPfc?.f),
      c: pfcDiff(yday?.c, goalPfc?.c),
    },
    hasGoalPfc,
  };

  // トレ: 昨日/今日/今週実施(done+rest_done)
  const woByDate = new Map<string, WorkoutMark>();
  for (const r of (workoutWin.data ?? []) as { date: string; status: WorkoutMark }[])
    woByDate.set(r.date, r.status);
  const weekDone = [...woByDate.entries()].filter(
    ([d, s]) => d >= weekStart && d <= dateStr && (s === "done" || s === "rest_done")
  ).length;
  const workoutSummary: DailySummary["workout"] = {
    yesterday: woByDate.get(yesterdayStr) ?? "none",
    today: woByDate.get(dateStr) ?? "none",
    weekDone,
  };

  // 生活: 昨夜(=表示日)睡眠/体調 + 直近7日の睡眠平均
  const sleeps = ((sleepWin.data ?? []) as { sleep_hours: number | null }[])
    .map((r) => r.sleep_hours)
    .filter((v): v is number => v != null);
  const avgSleep =
    sleeps.length > 0
      ? Math.round((sleeps.reduce((s, v) => s + v, 0) / sleeps.length) * 10) / 10
      : null;
  const lifeSummary: DailySummary["life"] = condition
    ? { sleepHours: condition.sleepHours, avgSleep, condition: condition.condition }
    : avgSleep != null
      ? { sleepHours: null, avgSleep, condition: null }
      : null;

  const summary: DailySummary = {
    weight: weightSummary,
    meal: mealSummary,
    workout: workoutSummary,
    life: lifeSummary,
    learn: {
      completed: learning.completedCount,
      total: learning.totalCount,
      latestLabel: learning.latestAt ? mdLabelFromIso(learning.latestAt) : null,
    },
    prevFeedback: prevRow
      ? { quote: truncateText(prevRow.body as string, 18), date: prevRow.date }
      : null,
  };

  return {
    userId,
    name: (userRow.name as string) ?? "受講生",
    initial: ((userRow.name as string) ?? "?").charAt(0),
    joinedAt: (userRow.joined_at as string) ?? null,
    isBeta: (userRow.is_beta as boolean | null) === true,
    meals,
    workout,
    condition,
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
    summary,
  };
}

// jsonb 配列/文字列を「・」区切りの表示文字列へ
function fmtField(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join(" ・ ") : null;
  const s = String(v).trim();
  return s || null;
}

// --- まとめパネル用 日付ヘルパー(YYYY-MM-DD・JST日付前提) ---
function addDaysStr(dateStr: string, delta: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}
function jstWeekStartStr(dateStr: string): string {
  // JST月曜起算。曜日はUTC正午で安定判定。
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=日..6=土
  return addDaysStr(dateStr, -((dow + 6) % 7));
}
function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000
  );
}
function truncateText(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}
function mdLabelFromIso(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

export function jstToday(): string {
  return jstTodayStr();
}
