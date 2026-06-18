import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { SendButton } from "./SendButton";

export const dynamic = "force-dynamic";

/**
 * 管理画面 アナウンス詳細 / 送信前確認 (/admin/announcements/[id] ・ 2026-06-18 C-1)
 *
 * 役割:
 *   - 下書き → プレビュー → 「送信する」 ボタン (= 誤送信防止)
 *   - 送信済 → プレビュー + 配信数 + 送信日時 表示 (= 監査ログ)
 *
 * アクセス制御: requireAdmin
 */
export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("announcements")
    .select(
      "id, subject, body_text, audience, include_opt_out_users, status, created_at, sent_at, recipient_count"
    )
    .eq("id", id)
    .maybeSingle();
  if (!row) {
    notFound();
  }

  // 配信対象見込み (= 下書き時のみ意味あり、 sent 時は recipient_count を表示)
  let estimateCount: number | null = null;
  if (row.status === "draft") {
    let q = admin.from("users").select("id", { count: "exact", head: true }).eq("status", "active");
    if (!row.include_opt_out_users) {
      q = q.neq("email_notification_enabled", false);
    }
    const { count } = await q;
    estimateCount = count ?? 0;
  }

  const isDraft = row.status === "draft";
  const isSent = row.status === "sent";

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-[#e8ebe9] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/admin/announcements"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label="一覧に戻る"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-zinc-900">
              {isDraft ? "送信前 確認" : "アナウンス 詳細"}
            </h1>
            <p className="text-xs text-zinc-600">
              {isSent
                ? `送信済 ・ ${new Date(row.sent_at as string).toLocaleString("ja-JP")} ・ ${row.recipient_count} 件`
                : `配信対象 見込み ${estimateCount ?? 0} 件`}
            </p>
          </div>
          {isSent && (
            <span className="rounded-full bg-[rgba(0,137,123,0.1)] text-[#00695c] px-3 py-1 text-[11px] font-bold">
              送信済
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* 件名 */}
        <div className="bg-white border border-[#e8ebe9] rounded-[14px] p-5">
          <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-2">
            件名
          </div>
          <div className="text-base font-bold text-zinc-900">{row.subject}</div>
        </div>

        {/* 本文 */}
        <div className="bg-white border border-[#e8ebe9] rounded-[14px] p-5">
          <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-2">
            本文
          </div>
          <pre className="text-sm text-zinc-900 leading-relaxed whitespace-pre-wrap font-sans">
            {row.body_text}
          </pre>
        </div>

        {/* 送信オプション */}
        <div className="bg-white border border-[#e8ebe9] rounded-[14px] p-5">
          <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-3">
            配信オプション
          </div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-xs">
            <dt className="text-zinc-500">配信対象</dt>
            <dd className="text-zinc-900 font-semibold">
              {row.audience === "all_active" ? "アクティブな全受講生" : row.audience}
            </dd>
            <dt className="text-zinc-500">メール OFF 受講生</dt>
            <dd className="text-zinc-900 font-semibold">
              {row.include_opt_out_users ? (
                <span className="text-amber-700">送信する (= 強制配信)</span>
              ) : (
                <span>送らない</span>
              )}
            </dd>
            <dt className="text-zinc-500">配信数</dt>
            <dd className="text-zinc-900 font-semibold font-mono">
              {isSent ? `${row.recipient_count} 件` : `見込み ${estimateCount ?? 0} 件`}
            </dd>
          </dl>
        </div>

        {/* 送信ボタン (下書き時のみ) */}
        {isDraft && (
          <div className="bg-amber-50 border border-amber-300 rounded-[14px] p-5">
            <div className="text-sm font-bold text-amber-900 mb-2">
              ⚠ 送信前 最終確認
            </div>
            <p className="text-xs text-amber-800 leading-relaxed mb-4">
              この内容で {estimateCount ?? 0} 件の受講生にメールが送信されます。
              送信後は内容を変更できません。 件名 / 本文 / オプション をよく確認してから送信ボタンを押してください。
            </p>
            <SendButton id={row.id as string} />
          </div>
        )}
      </main>
    </div>
  );
}
