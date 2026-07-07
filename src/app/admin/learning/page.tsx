import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getLearningOverview } from "@/lib/admin/learning-overview";

export const dynamic = "force-dynamic";

/**
 * 管理画面 ・ 学習進捗（全受講生一覧） (/admin/learning) ・ 2026-07-07
 *
 * 各受講生が「完了」を何個付けたか＝進捗を一覧で確認する。
 * 進捗の実体は lesson_progress.is_completed（手動の完了トグル）＝再生秒数ではない。
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only)。
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdminLearningOverviewPage() {
  await requireAdmin();
  const { totalLessons, studentCount, averagePercent, rows } =
    await getLearningOverview();

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <h1 className="text-lg font-bold text-zinc-900">学習進捗（全受講生）</h1>
      <p className="mt-1 text-xs text-zinc-500">
        各受講生がレッスンの「完了」を何個付けたか＝進捗の一覧です。
        <span className="text-zinc-400">
          {" "}
          ※完了トグルの数（動画の再生秒数ではありません）
        </span>
      </p>

      {/* サマリ */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "受講生", value: `${studentCount}名` },
          { label: "全レッスン数", value: `${totalLessons}` },
          { label: "平均進捗", value: `${averagePercent}%` },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[12px] border border-[#e8ebe9] bg-white px-4 py-3"
          >
            <div className="text-[10px] font-bold tracking-widest text-zinc-500">
              {s.label}
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-[#00695c]">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 一覧 */}
      <div className="mt-5 overflow-hidden rounded-[14px] border border-[#e8ebe9] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eef1ef] text-left text-[11px] font-bold tracking-wider text-zinc-500">
              <th className="px-4 py-3">受講生</th>
              <th className="px-4 py-3 w-[90px]">入会日</th>
              <th className="px-4 py-3 w-[110px]">完了</th>
              <th className="px-4 py-3 w-[240px]">進捗</th>
              <th className="px-4 py-3 w-[130px]">最終活動</th>
              <th className="px-4 py-3 w-[70px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  受講生がいません
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const ago = daysAgo(r.lastActivity);
                const stale = ago != null && ago >= 7;
                return (
                  <tr
                    key={r.userId}
                    className="border-b border-[#f3f5f4] last:border-0 hover:bg-[#f7faf9]"
                  >
                    <td className="px-4 py-3 font-bold text-zinc-900">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {fmtDate(r.joinedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-[#00695c]">
                        {r.completed}
                      </span>
                      <span className="ml-1 text-xs text-zinc-400">
                        / {totalLessons}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#00897b] to-[#00695c]"
                            style={{ width: `${r.percent}%` }}
                          />
                        </div>
                        <span className="w-9 text-right font-mono text-xs font-bold text-[#00695c]">
                          {r.percent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.lastActivity ? (
                        <span className={stale ? "font-bold text-[#c2410c]" : "text-zinc-500"}>
                          {fmtDate(r.lastActivity)}
                          {stale ? `（${ago}日前）` : ""}
                        </span>
                      ) : (
                        <span className="text-zinc-400">記録なし</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${r.userId}/learning`}
                        className="text-xs font-bold text-[#00897b] hover:underline"
                      >
                        詳細 →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
