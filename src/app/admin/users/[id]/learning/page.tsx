import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * 受講生ハブ ・ 学習進捗タブ
 *
 * lesson_progress (is_completed) と lessons / chapters / courses をジョインして
 * コース別の視聴率を集計表示。
 */
export default async function UserLearningProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;
  const admin = createAdminClient();

  // 全コース → 章 → レッスン総数 を集計
  const { data: courses } = await admin
    .from("courses")
    .select("id, title, sort_order, chapters(id, lessons(id))")
    .order("sort_order");

  // 受講生の完了済レッスン
  const { data: completed } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .eq("is_completed", true);

  const completedSet = new Set(completed?.map((c) => c.lesson_id) ?? []);

  type CourseLike = {
    id: string;
    title: string;
    chapters?: { id: string; lessons?: { id: string }[] }[] | null;
  };
  const items =
    (courses as CourseLike[] | null)?.map((course) => {
      const lessonIds =
        course.chapters?.flatMap((ch) => ch.lessons?.map((l) => l.id) ?? []) ?? [];
      const total = lessonIds.length;
      const done = lessonIds.filter((id) => completedSet.has(id)).length;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      return { id: course.id, title: course.title, total, done, percent };
    }) ?? [];

  const totalLessons = items.reduce((acc, item) => acc + item.total, 0);
  const totalDone = items.reduce((acc, item) => acc + item.done, 0);
  const overallPercent = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* 全体進捗 */}
      <div className="rounded-[14px] border border-[#e8ebe9] bg-white px-5 py-4 mb-5">
        <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-2">
          全体進捗
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#00695c] font-mono">
            {overallPercent}%
          </span>
          <span className="text-xs text-zinc-500">
            ({totalDone} / {totalLessons} レッスン)
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-gradient-to-r from-[#00897b] to-[#00695c] rounded-full"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* コース別 */}
      <h2 className="text-sm font-bold text-zinc-900 mb-3">コース別進捗</h2>
      {items.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#e8ebe9] bg-white px-6 py-10 text-center text-sm text-zinc-500">
          コースが登録されていません
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[10px] border border-[#e8ebe9] bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-sm font-bold text-zinc-900 truncate flex-1 min-w-0 mr-3">
                  {item.title}
                </div>
                <div className="text-xs text-zinc-600 flex-shrink-0">
                  <span className="font-mono font-bold text-[#00695c]">
                    {item.percent}%
                  </span>
                  <span className="ml-1.5 text-zinc-400">
                    ({item.done} / {item.total})
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00897b] rounded-full"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
