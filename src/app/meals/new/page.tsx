import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { jstTodayStr } from "@/lib/date/jst";
import {
  getMealsForDate,
  getMealLogById,
  signMealPhotos,
  MEAL_TYPES,
  type MealType,
} from "@/lib/meals/queries";
import { MealPostForm } from "./MealPostForm";

export const dynamic = "force-dynamic";

/** 現在の JST 時刻から食事タイプを自動選択 */
function defaultMealType(nowMs: number = Date.now()): MealType {
  const h = new Date(nowMs + 9 * 3600 * 1000).getUTCHours();
  if (h >= 5 && h <= 10) return "朝";
  if (h >= 11 && h <= 15) return "昼";
  if (h >= 16 && h <= 21) return "夕";
  return "間";
}

export default async function MealNewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string; edit?: string }>;
}) {
  // 食事はベータ限定(P4-a)。非ベータは導線なし＝ホームへ。
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/meals/new");

  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : jstTodayStr();

  // 編集モード
  if (sp.edit) {
    const log = await getMealLogById(sp.edit);
    if (!log) redirect(`/meals?date=${date}`);
    const urlMap = await signMealPhotos(log.photos);
    return (
      <>
        <MemberHeader title="食事を編集" fallbackHref={`/meals?date=${log.date}`} />
        <main className="min-h-[100dvh] bg-[#f9f5ed]">
          <div className="mx-auto max-w-[460px] px-4 py-4">
            <MealPostForm
              userId={user.id}
              date={log.date}
              initialType={log.meal_type}
              editId={log.id}
              initialMemo={log.memo}
              initialItems={log.items.map((i) => ({ name: i.name }))}
              initialPhotos={log.photos
                .map((p) => ({ path: p, url: urlMap.get(p) ?? "" }))
                .filter((p) => p.url)}
            />
          </div>
        </main>
      </>
    );
  }

  // 新規: タイプ指定 or 時刻から自動
  const reqType = MEAL_TYPES.includes(sp.type as MealType)
    ? (sp.type as MealType)
    : defaultMealType();

  // 同日同タイプ(朝昼夕=1枠)が既にあれば既存編集へ誘導。間食は複数OK。
  if (reqType !== "間") {
    const meals = await getMealsForDate(date);
    const existing = meals.find((m) => m.meal_type === reqType);
    if (existing) redirect(`/meals/new?edit=${existing.id}`);
  }

  return (
    <>
      <MemberHeader title="食事を記録" fallbackHref={`/meals?date=${date}`} />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          <MealPostForm userId={user.id} date={date} initialType={reqType} />
        </div>
      </main>
    </>
  );
}
