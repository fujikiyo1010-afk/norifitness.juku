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

  // 2026-07-18 全受講生へ公開: 過去日の食事・生活を全員が編集できる(ロックなし・添削済み含む)。
  //   記録し忘れの後追い入力に対応。将来また対象を絞るなら、ここを許可リスト判定に戻す。
  const canEditPast = true;

  // S2-B: 互いに独立な読み取りを1つの Promise.all で並列化(9段の直列→約4段)。
  //   依存のある「meals→署名URL」は1単位で内部順序を保持。shouldAskYesterday は
  //   date===today のときだけ実クエリ(元の条件を保つ)。
  //   ※lib関数がthrowする挙動は従来の逐次awaitと同じ(全体エラー)＝フォールバックは元のまま。
  const today = jstTodayStr();
  const yesterday = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  // 細8: 週ストリップ用・当該週(日〜土)
  const baseMs = Date.parse(`${date}T00:00:00Z`);
  const sunday = new Date(baseMs - new Date(baseMs).getUTCDay() * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const saturday = new Date(Date.parse(`${sunday}T00:00:00Z`) + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [mealsData, fbRes, goalRes, condRes, askFlag, foods, weekRes] =
    await Promise.all([
      (async () => {
        const meals = await getMealsForDate(date);
        const urlMap = await signMealPhotos(meals.flatMap((m) => m.photos));
        return { meals, urlMap };
      })(),
      supabase
        .from("daily_feedbacks")
        .select("body, date")
        .eq("date", date)
        .eq("status", "sent")
        .maybeSingle(),
      supabase
        .from("goal_sheets")
        .select("content")
        .eq("user_id", user.id)
        .maybeSingle(),
      getDailyCondition(date),
      date === today ? shouldAskYesterday(yesterday) : Promise.resolve(false),
      getActiveFoods(),
      supabase
        .from("meal_logs")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", sunday)
        .lte("date", saturday),
    ]);

  const withUrls = mealsData.meals.map((m) => ({
    ...m,
    photoUrls: m.photos.map((p) => mealsData.urlMap.get(p) ?? "").filter(Boolean),
  }));

  // 着地切替(M6): その日のデイリーFB(送信済)を「のりからのコメント」として食事詳細に表示。
  const fbRow = fbRes.data;
  const feedback = fbRow?.body ? (fbRow.body as string) : null;

  // 合計ゲージの「ものさし」= 目標PFC(既存 goal_sheets.content.nutrition)
  const goal = goalRes.data;
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

  // 生活記録(P6): 今日を見ている時のみ昨日分を聞く
  const askYesterday = askFlag ? yesterday : null;

  const recordedDates = Array.from(
    new Set(((weekRes.data ?? []) as { date: string }[]).map((m) => m.date))
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
            canEditPast={canEditPast}
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
