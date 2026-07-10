import { redirect } from "next/navigation";
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

  const meals = await getMealsForDate(date);
  const allPaths = meals.flatMap((m) => m.photos);
  const urlMap = await signMealPhotos(allPaths);

  const withUrls = meals.map((m) => ({
    ...m,
    photoUrls: m.photos.map((p) => urlMap.get(p) ?? "").filter(Boolean),
  }));

  return (
    <>
      <MemberHeader title="食事" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          <DayDetail date={date} meals={withUrls} today={jstTodayStr()} />
        </div>
      </main>
    </>
  );
}
