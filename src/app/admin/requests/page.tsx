import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listPendingRequestsWithUserInfo } from "@/lib/workout/queries";
import { RequestCard } from "./RequestCard";

export const dynamic = "force-dynamic";

/**
 * 管理画面 個別対応受信箱 (/admin/requests)
 *
 * 設計:
 *   - 案 β: 両リクエストを 1 ページに統合
 *   - セクション分離: カルテ更新 / メニュー変更 を縦に分けて並べる
 *   - 動線: 「対応する」→ 受講生ハブ画面 (/admin/users/[id]) に遷移
 *   - 却下: Server Action で status='dismissed' に更新
 *
 * 設計元: /tmp/admin_inbox_v1.html (きよむさん合意 2026-06-02)
 *
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only.md)
 *
 * アクセス制御: requireAdmin
 */
export default async function AdminRequestsPage() {
  await requireAdmin();

  const { carte, workout } = await listPendingRequestsWithUserInfo();
  const totalPending = carte.length + workout.length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-6">
        {/* ページヘッダー */}
        <header className="rounded-[14px] border border-[#e8ebe9] bg-white px-6 py-5 mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200"
            aria-label="管理者ホームに戻る"
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
            <h1 className="text-lg font-bold text-zinc-900">
              受信箱 (個別対応)
            </h1>
            <p className="text-xs text-zinc-600 mt-0.5">
              受講生からのリクエストに対応する画面
            </p>
          </div>
          <span
            className={`ml-auto rounded-full px-4 py-1.5 text-xs font-bold ${
              totalPending > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            未対応 {totalPending} 件
          </span>
        </header>

        {/* 全件 0 のとき */}
        {totalPending === 0 && (
          <div className="rounded-[14px] border border-[#e8ebe9] bg-white p-8 text-center">
            <p className="text-sm text-zinc-700">
              未対応のリクエストはありません 🎉
            </p>
          </div>
        )}

        {/* セクション 1: カルテ更新リクエスト */}
        {carte.length > 0 && (
          <RequestSection
            type="carte"
            title="カルテ更新リクエスト"
            count={carte.length}
          >
            {carte.map((req) => (
              <RequestCard key={req.id} type="carte" request={req} />
            ))}
          </RequestSection>
        )}

        {/* セクション 2: メニュー変更リクエスト */}
        {workout.length > 0 && (
          <RequestSection
            type="workout"
            title="メニュー変更リクエスト"
            count={workout.length}
          >
            {workout.map((req) => (
              <RequestCard key={req.id} type="workout" request={req} />
            ))}
          </RequestSection>
        )}
      </div>
    </div>
  );
}

function RequestSection({
  type,
  title,
  count,
  children,
}: {
  type: "carte" | "workout";
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const iconBg = type === "carte" ? "bg-[#e0f2f1]" : "bg-orange-50";
  const iconColor = type === "carte" ? "text-[#00695c]" : "text-orange-700";
  const iconSvg =
    type === "carte" ? (
      // カルテ: clipboard icon
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ) : (
      // メニュー: dumbbell icon
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 5v14M2 9v6M18 5v14M22 9v6M6 12h12" />
      </svg>
    );

  return (
    <section className="mb-5 rounded-[14px] border border-[#e8ebe9] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#e8ebe9] bg-[#fafafa] flex items-center gap-2.5">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md ${iconBg} ${iconColor}`}
        >
          {iconSvg}
        </div>
        <h2 className="text-[17px] font-bold text-zinc-900">{title}</h2>
        <span className="text-[11px] text-zinc-500 font-medium">
          未対応 {count} 件
        </span>
      </div>
      <div>{children}</div>
    </section>
  );
}
