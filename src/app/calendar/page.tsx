import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCalendarUser } from "@/lib/auth/calendar-gate";
import { MemberHeader } from "@/components/MemberHeader";
import { jstTodayStr } from "@/lib/date/jst";
import { getMealsForDate, signMealPhotos } from "@/lib/meals/queries";
import { getDailyCondition } from "@/lib/conditions/queries";
import { getMyHomeStats } from "@/lib/member/home-stats";
import { getMyLastWatchedLesson } from "@/lib/member/last-watched";
import {
  getBodyForCalendar,
  getWorkoutForCalendar,
  getLearnedForCalendar,
  getReviewsForCalendar,
  getBodyPhotosForCalendar,
} from "@/lib/calendar/queries";
import { getMyCarte } from "@/lib/workout/queries";
import { CalendarDayView } from "./CalendarDayView";

export const dynamic = "force-dynamic";

/**
 * カレンダー(1日ビュー) — 藤田さん先行(calendar-gate)。
 * 日付を指定して、その日の体組成/食事/トレ/添削/生活/学習/振り返りを1画面に凝縮する。
 * ボディ写真カード・カルテ未提出カード・下ナビ入替は後続で追加。
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!(await isCalendarUser())) redirect("/");

  const sp = await searchParams;
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : jstTodayStr();
  const today = jstTodayStr();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/calendar");

  // 週(日〜土)の範囲 — 記録ありドット用
  const baseMs = Date.parse(`${date}T00:00:00Z`);
  const sunday = new Date(baseMs - new Date(baseMs).getUTCDay() * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const saturday = new Date(Date.parse(`${sunday}T00:00:00Z`) + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    body,
    workout,
    mealsData,
    condRes,
    feedbackRes,
    learned,
    reviews,
    learnStats,
    lastWatched,
    goalRes,
    weekMeals,
    carte,
    bodyPhotos,
  ] = await Promise.all([
    getBodyForCalendar(date),
    getWorkoutForCalendar(date),
    (async () => {
      const meals = await getMealsForDate(date);
      const urlMap = await signMealPhotos(meals.flatMap((m) => m.photos));
      return { meals, urlMap };
    })(),
    getDailyCondition(date),
    supabase
      .from("daily_feedbacks")
      .select("body")
      .eq("date", date)
      .eq("status", "sent")
      .maybeSingle(),
    getLearnedForCalendar(date),
    getReviewsForCalendar(date),
    getMyHomeStats(),
    getMyLastWatchedLesson(),
    supabase
      .from("goal_sheets")
      .select("content")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("meal_logs")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", sunday)
      .lte("date", saturday),
    getMyCarte(),
    getBodyPhotosForCalendar(date),
  ]);

  const meals = mealsData.meals.map((m) => ({
    ...m,
    photoUrls: m.photos.map((p) => mealsData.urlMap.get(p) ?? "").filter(Boolean),
  }));
  const feedback = (feedbackRes.data?.body as string | undefined) ?? null;
  const nutrition = (
    goalRes.data?.content as {
      nutrition?: {
        target_calorie?: number;
        pfc?: { p?: number; f?: number; c?: number };
      };
    } | null
  )?.nutrition;
  const target = nutrition
    ? {
        kcal: nutrition.target_calorie ?? null,
        p: nutrition.pfc?.p ?? null,
        f: nutrition.pfc?.f ?? null,
        c: nutrition.pfc?.c ?? null,
      }
    : null;
  const recordedDates = Array.from(
    new Set(((weekMeals.data ?? []) as { date: string }[]).map((m) => m.date))
  );

  return (
    <>
      <MemberHeader title="カレンダー" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <CalendarDayView
          date={date}
          today={today}
          body={body}
          workout={workout}
          meals={meals}
          target={target}
          feedback={feedback}
          condition={condRes?.data ?? null}
          learned={learned}
          reviews={reviews}
          learnStats={
            learnStats
              ? { completed: learnStats.completedLessons, total: learnStats.totalLessons }
              : { completed: 0, total: 0 }
          }
          lastWatched={lastWatched}
          hasCarte={!!carte}
          bodyPhotos={bodyPhotos}
          recordedDates={recordedDates}
        />
      </main>
    </>
  );
}
