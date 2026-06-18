import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AnnouncementRow = {
  id: string;
  subject: string;
  status: "draft" | "sent";
  created_at: string;
  sent_at: string | null;
  recipient_count: number | null;
  include_opt_out_users: boolean;
};

/**
 * 管理画面 一斉アナウンス 一覧 (/admin/announcements ・ 2026-06-18 C-1)
 *
 * 役割:
 *   - 過去のアナウンス履歴 (= 送信済) と 下書き (= 未送信) を一覧表示
 *   - 右上「新規作成」 ボタン → /admin/announcements/new
 *
 * アクセス制御: requireAdmin
 */
export default async function AnnouncementsListPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("announcements")
    .select(
      "id, subject, status, created_at, sent_at, recipient_count, include_opt_out_users"
    )
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as AnnouncementRow[];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <h1 className="text-base font-semibold text-zinc-900">
              一斉アナウンス
            </h1>
            <p className="text-xs text-zinc-600">
              利用規約改定 / メンテ告知 / インシデント告知などを 受講生全員に一斉送信
            </p>
          </div>
          <Link
            href="/admin/announcements/new"
            className="rounded-[4px] bg-[#00897b] text-white px-4 py-2 text-sm font-bold hover:bg-[#00695c]"
          >
            + 新規作成
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-zinc-300 bg-white p-12 text-center">
            <p className="text-sm text-zinc-600">
              まだアナウンスはありません。 右上「新規作成」 から作成できます。
            </p>
          </div>
        ) : (
          <div className="rounded-[14px] border border-[#e8ebe9] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-700 text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">件名</th>
                  <th className="text-left px-4 py-2 font-medium w-[100px]">状態</th>
                  <th className="text-left px-4 py-2 font-medium w-[120px]">送信日</th>
                  <th className="text-right px-4 py-2 font-medium w-[100px]">配信数</th>
                  <th className="text-right px-4 py-2 font-medium w-[120px]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[#e8ebe9]">
                    <td className="px-4 py-3 text-zinc-900">{r.subject}</td>
                    <td className="px-4 py-3">
                      {r.status === "sent" ? (
                        <span className="inline-block rounded-full bg-[rgba(0,137,123,0.1)] text-[#00695c] px-2 py-0.5 text-[10px] font-bold">
                          送信済
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                          下書き
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-zinc-600 font-mono">
                      {r.sent_at
                        ? new Date(r.sent_at).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-zinc-600 font-mono">
                      {r.recipient_count !== null ? `${r.recipient_count} 件` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/announcements/${r.id}`}
                        className="text-[11px] text-[#00695c] font-bold hover:underline"
                      >
                        {r.status === "sent" ? "詳細 →" : "確認 / 送信 →"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
