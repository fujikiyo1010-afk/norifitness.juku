import Link from "next/link";
import { getCurrentMenuForAdmin } from "@/lib/workout/queries";
import { cleanExerciseName } from "@/lib/workout/menu-display";

export const dynamic = "force-dynamic";

/**
 * 総1: 受講生ハブ「筋トレメニュー」タブ。
 * これまでタブはあるがページが無く 404 だった。配布済みの原本メニューを読み取り表示し、
 * 「編集して再配布」で既存の配布画面(/menu/new?from_current=1)へ送る(編集ロジックは持たない)。
 */
export default async function UserMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const menu = await getCurrentMenuForAdmin(userId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-zinc-900">筋トレメニュー（配布中）</h2>
        <Link
          href={`/admin/users/${userId}/menu/new?from_current=1`}
          className="rounded-md border border-[#00897b] bg-[#00897b] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#00796b]"
        >
          編集して再配布
        </Link>
      </div>

      {!menu ? (
        <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          まだメニューが配布されていません。
          <div className="mt-3">
            <Link
              href={`/admin/users/${userId}/menu/new`}
              className="font-bold text-[#00695c] underline"
            >
              メニューを配布する →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {menu.notes && (
            <p className="rounded-lg border border-[#e8ebe9] bg-[#fafbfa] px-3.5 py-2.5 text-[12px] text-zinc-600">
              {menu.notes}
            </p>
          )}
          {menu.cycles.map((stage, si) => (
            <section
              key={si}
              className="overflow-hidden rounded-[12px] border border-[#e8ebe9] bg-white"
            >
              <div className="border-b border-[#f1f3f2] bg-[#fafbfa] px-4 py-2.5 text-[12.5px] font-bold text-zinc-800">
                {stage.段階}強度
                {stage.シート名 ? (
                  <span className="ml-2 text-[11px] font-normal text-zinc-500">
                    {stage.シート名}
                  </span>
                ) : null}
              </div>
              <div className="divide-y divide-[#f1f3f2]">
                {stage.週.map((day, di) => (
                  <div key={di} className="px-4 py-3">
                    <div className="mb-1.5 text-[12px] font-bold text-[#00695c]">
                      {day.日}
                      {day.種別 && (
                        <span className="ml-2 text-[11px] font-normal text-zinc-500">
                          （{day.種別 === "休息" ? "休養日" : "パーソナル指導日"}）
                        </span>
                      )}
                    </div>
                    {day.種目.filter((e) => e.種目名).length === 0 ? (
                      <div className="text-[12px] text-zinc-400">
                        {day.種別 ? "この日はメニューなし" : "種目が設定されていません"}
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {day.種目
                          .filter((e) => e.種目名)
                          .map((e, ei) => (
                            <li
                              key={ei}
                              className="flex items-baseline justify-between gap-3 text-[12.5px]"
                            >
                              <span className="font-medium text-zinc-800">
                                {cleanExerciseName(e.種目名)}
                              </span>
                              {e.回数 && (
                                <span className="flex-shrink-0 text-[11.5px] text-zinc-500">
                                  {e.回数}
                                </span>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
