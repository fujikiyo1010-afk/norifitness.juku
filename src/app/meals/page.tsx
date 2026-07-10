import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { jstTodayStr } from "@/lib/date/jst";
import { getMealsForDate, signMealPhotos } from "@/lib/meals/queries";
import { DayDetail } from "./DayDetail";

export const dynamic = "force-dynamic";

/**
 * 食事 日別詳細 (M6・チップナビ型B・P4-a・ベータ限定)。
 * 上部チップ(朝/昼/夕/間) + 記録済みカードのみ表示 + 医療ただし書き常設。
 */
export default async function MealsDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const sp = await searchParams;
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : jstTodayStr();

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
          />
        </div>
      </main>
    </>
  );
}
