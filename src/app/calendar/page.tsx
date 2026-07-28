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
} from "@/lib/calendar/queries";
import { getMyBodyPhotoSummary } from "@/lib/body-photos/queries";
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
    photoSummary,
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
    // 記録ありドット用: 週バー + 月カレンダー(過去日選択)の両方で使うため全期間の記録日を取得
    supabase
      .from("meal_logs")
      .select("date")
      .eq("user_id", user.id),
    getMyCarte(),
    getMyBodyPhotoSummary(),
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
          userId={user.id}
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
          photoSummary={photoSummary}
          recordedDates={recordedDates}
        />
      </main>
    </>
  );
}
