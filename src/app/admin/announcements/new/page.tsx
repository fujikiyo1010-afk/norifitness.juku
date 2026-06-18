import { requireAdmin } from "@/lib/auth/admin";
import Link from "next/link";
import { AnnouncementForm } from "./AnnouncementForm";

export const dynamic = "force-dynamic";

/**
 * 管理画面 一斉アナウンス 新規作成 (/admin/announcements/new ・ 2026-06-18 C-1)
 *
 * フロー:
 *   - 件名 + 本文 + 「メール OFF の人にも送るか」 トグル
 *   - 「下書きとして保存 → 確認画面へ」 ボタン (= createAnnouncementDraft)
 *   - 確認画面 (/admin/announcements/[id]) で 「送信」 押すと実発射
 *
 * アクセス制御: requireAdmin
 */
export default async function AnnouncementNewPage() {
  await requireAdmin();

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
          <div>
            <h1 className="text-base font-semibold text-zinc-900">
              新規アナウンス
            </h1>
            <p className="text-xs text-zinc-600">
              件名と本文を入力 → 次の画面で内容を確認してから送信
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <AnnouncementForm />
      </main>
    </div>
  );
}
