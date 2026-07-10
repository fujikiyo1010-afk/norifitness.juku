import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { jstTodayStr } from "@/lib/date/jst";
import { getMealsForDate, signMealPhotos } from "@/lib/meals/queries";
import { getActiveFoods } from "@/lib/meals/food";
import { getDailyCondition, shouldAskYesterday } from "@/lib/conditions/queries";
import { DayDetail } from "./DayDetail";

export const dynamic = "force-dynamic";

/**
 * 食事 日別詳細 (M6・チップナビ型B・P4-a・ベータ限定)。
 * 上部チップ(朝/昼/夕/間) + 記録済みカードのみ表示 + 医療ただし書き常設。
 */
export default async function MealsDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; life?: string }>;
}) {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const sp = await searchParams;
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : jstTodayStr();
  // 細21: ホームの生活入口(/meals?life=1)から来たら4問シートを自動で開く
  const autoOpenLife = sp.life === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/meals");

  const meals = await getMealsForDate(date);
  const allPaths = meals.flatMap((m) => m.photos);
  const urlMap = await signMealPhotos(allPaths);

  const withUrls = meals.map((m) => ({
    ...m,
    photoUrls: m.photos.map((p) => urlMap.get(p) ?? "").filter(Boolean),
  }));

  // 着地切替(M6): その日のデイリーFB(送信済)を「のりからのコメント」として食事詳細に表示。
  const { data: fbRow } = await supabase
    .from("daily_feedbacks")
    .select("body, date")
    .eq("date", date)
    .eq("status", "sent")
    .maybeSingle();
  const feedback = fbRow?.body ? (fbRow.body as string) : null;

  // 合計ゲージの「ものさし」= 目標PFC(既存 goal_sheets.content.nutrition)
  const { data: goal } = await supabase
    .from("goal_sheets")
    .select("content")
    .eq("user_id", user.id)
    .maybeSingle();
  const nutrition = (goal?.content as { nutrition?: { target_calorie?: number; pfc?: { p?: number; f?: number; c?: number } } } | null)
    ?.nutrition;
  const target = nutrition
    ? {
        kcal: nutrition.target_calorie ?? null,
        p: nutrition.pfc?.p ?? null,
        f: nutrition.pfc?.f ?? null,
        c: nutrition.pfc?.c ?? null,
      }
    : null;

  // 生活記録(P6): その日の記録 + 翌日補完(今日を見ている時のみ昨日分を聞く)
  const today = jstTodayStr();
  const condRes = await getDailyCondition(date);
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const askYesterday =
    date === today && (await shouldAskYesterday(yesterday)) ? yesterday : null;

  const foods = await getActiveFoods();

  // 細8: 週ストリップ用・当該週(日〜土)で記録がある日
  const baseMs = Date.parse(`${date}T00:00:00Z`);
  const sunday = new Date(baseMs - new Date(baseMs).getUTCDay() * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const saturday = new Date(Date.parse(`${sunday}T00:00:00Z`) + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: weekMeals } = await supabase
    .from("meal_logs")
    .select("date")
    .eq("user_id", user.id)
    .gte("date", sunday)
    .lte("date", saturday);
  const recordedDates = Array.from(
    new Set(((weekMeals ?? []) as { date: string }[]).map((m) => m.date))
  );

  return (
    <>
      <MemberHeader title="食事" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          <DayDetail
            date={date}
            meals={withUrls}
            today={jstTodayStr()}
            feedback={feedback}
            target={target}
            userId={user.id}
            condition={condRes?.data ?? null}
            askYesterday={askYesterday}
            foods={foods}
            recordedDates={recordedDates}
            autoOpenLife={autoOpenLife}
          />
        </div>
      </main>
    </>
  );
}
