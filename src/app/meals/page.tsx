import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { jstTodayStr } from "@/lib/date/jst";
import { getMealsForDates, signMealPhotos } from "@/lib/meals/queries";
import { getActiveFoods } from "@/lib/meals/food";
import { getDailyConditions, shouldAskYesterday } from "@/lib/conditions/queries";
import { DayDetailV2, type DayData } from "./DayDetailV2";

export const dynamic = "force-dynamic";

/**
 * 食事 1日の画面 V2(完全新装・2026-08-19)。
 * 選択日を含む週(日〜土)7日分を先読みし、クライアント側で日切替(サクサク化)。
 * 週外への移動だけページ遷移で再取得する。
 */
export default async function MealsDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; life?: string }>;
}) {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const sp = await searchParams;
  const today = jstTodayStr();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const autoOpenLife = sp.life === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/meals");

  // 2026-07-18 全受講生へ公開: 過去日の食事・生活を全員が編集できる(ロックなし)
  const canEditPast = true;

  // 選択日を含む週(日〜土)7日分
  const DAY = 86_400_000;
  const baseMs = Date.parse(`${date}T00:00:00Z`);
  const sundayMs = baseMs - new Date(baseMs).getUTCDay() * DAY;
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    new Date(sundayMs + i * DAY).toISOString().slice(0, 10)
  );

  const yesterday = new Date(baseMs - DAY).toISOString().slice(0, 10);

  const [mealsByDate, condByDate, fbRes, goalRes, askFlag, foods, recRes] = await Promise.all([
    getMealsForDates(weekDates),
    getDailyConditions(weekDates),
    supabase
      .from("daily_feedbacks")
      .select("body, date")
      .in("date", weekDates)
      .eq("status", "sent"),
    supabase.from("goal_sheets").select("content").eq("user_id", user.id).maybeSingle(),
    date === today ? shouldAskYesterday(yesterday) : Promise.resolve(false),
    getActiveFoods(),
    // 記録ありドット用: 週バー+月カレンダーの両方で使うため全期間の記録日を取得(カレンダー画面と同じ流儀)
    supabase.from("meal_logs").select("date").eq("user_id", user.id),
  ]);

  const allRecordedDates = Array.from(
    new Set(((recRes.data ?? []) as { date: string }[]).map((r) => r.date))
  );

  // 写真の署名URLは週まとめて1回
  const allPaths = weekDates.flatMap((d) => mealsByDate[d].flatMap((m) => m.photos));
  const urlMap = await signMealPhotos(allPaths);

  const fbByDate = new Map(
    ((fbRes.data ?? []) as { body: string | null; date: string }[]).map((r) => [r.date, r.body])
  );

  const week: DayData[] = weekDates.map((d) => ({
    date: d,
    meals: mealsByDate[d].map((m) => ({
      ...m,
      photoUrls: m.photos.map((p) => urlMap.get(p) ?? "").filter(Boolean),
    })),
    condition: condByDate[d] ?? null,
    feedback: (fbByDate.get(d) as string | null) ?? null,
  }));

  const goal = goalRes.data;
  const nutrition = (
    goal?.content as {
      nutrition?: { target_calorie?: number; pfc?: { p?: number; f?: number; c?: number } };
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

  const askYesterday = askFlag ? yesterday : null;

  return (
    <>
      <MemberHeader title="食事" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f6f7f8]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          <DayDetailV2
            initialDate={date}
            today={today}
            week={week}
            target={target}
            userId={user.id}
            canEditPast={canEditPast}
            askYesterday={askYesterday}
            foods={foods}
            autoOpenLife={autoOpenLife}
            recordedDates={allRecordedDates}
          />
        </div>
      </main>
    </>
  );
}
