import { redirect } from "next/navigation";

/**
 * 独立の食事投稿ページは廃止(M16改・2026-07-10)。
 * 投稿は /meals(日別詳細)のスロット「＋」から開くボトムシートに統合。
 * 旧リンク互換のため /meals へ寄せる。
 */
export default async function MealNewRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.date ? `?date=${sp.date}` : "";
  redirect(`/meals${q}`);
}
