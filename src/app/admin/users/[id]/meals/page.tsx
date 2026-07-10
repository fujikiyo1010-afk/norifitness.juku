import { getMealDaysForUser } from "@/lib/admin/meals";
import { MealsHistory } from "./MealsHistory";

export const dynamic = "force-dynamic";

/**
 * 管理画面 受講生ハブ ・ 食事記録タブ (M3/M4・P4-a)
 * 直近の食事を日別に一覧。行クリックで展開し、その日の各食(写真+品目)+デイリーFBを表示。
 */
export default async function UserMealsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const days = await getMealDaysForUser(userId, 30);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-3 text-[11px] font-bold tracking-widest text-zinc-500">
        食事記録（直近30日・写真ベース）
      </div>
      {days.length === 0 ? (
        <div className="rounded-2xl border border-[#e8ebe9] bg-white p-8 text-center text-[13px] text-zinc-500">
          まだ食事の記録はありません。
        </div>
      ) : (
        <MealsHistory days={days} />
      )}
    </div>
  );
}
