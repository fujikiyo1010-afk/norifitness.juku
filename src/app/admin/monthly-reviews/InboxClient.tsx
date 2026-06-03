"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUploadJob } from "@/lib/upload/UploadJobContext";

/**
 * 月次添削 受信箱 (管理画面) のクライアントコンポーネント。
 *
 * 設計元: /tmp/admin_monthly_inbox.html (Phase 2-7 モック)
 *
 * 役割:
 *   - 検索バー (受講生名でクライアントサイドフィルタ)
 *   - フィルタタブ (全て / 未返答 / 返答済 + 件数バッジ)
 *   - 行のメタ情報を「入会 YYYY/MM ・ 過去返信 N 回」で表示
 *   - 楽観的 UI: UploadJob の状態を購読し、送信中の audit を即座に「返答済」側へ
 *     仮表示する (2026-05-27 きよむさん要望)。失敗時は未返答リストに失敗マーク付き
 *     で復元、ユーザーは画面リロードなしで状態を把握できる。
 *
 * 配色 (2026-05-26 きよむさん指示):
 *   - 未返答 = 薄い赤 (#d32f2f + 背景 #fef5f5)
 *   - 返答済 = ティール緑 (#00897b)
 *   - 送信中 (楽観) = 黄色注意喚起 (#b8860b)
 */

export type InboxAudit = {
  id: string;
  userName: string;
  joinedAtLabel: string; // "2025/09"
  replyCount: number; // 全期間累計
  submittedDateLabel: string | null;
  publishedDateLabel: string | null;
  videoDurationLabel: string | null;
  daysSinceSubmit: number;
  // ↓ 楽観表示用 (クライアントで合成、サーバーから渡されない)
  isOptimistic?: boolean;
  optimisticStatus?: "uploading" | "success";
  failureReason?: string;
};

type Tab = "all" | "waiting" | "done";

export function InboxClient({
  pending,
  replied,
  adminName,
  adminInitial,
}: {
  pending: InboxAudit[];
  replied: InboxAudit[];
  adminName: string;
  adminInitial: string;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("waiting");
  const { job } = useUploadJob();

  // 楽観表示用の audit ID 計算
  const optimisticId =
    (job.status === "uploading" || job.status === "success") && job.auditId
      ? job.auditId
      : null;
  const failedId = job.status === "error" && job.auditId ? job.auditId : null;
  const failedReason = failedId ? job.errorMessage ?? "送信失敗" : null;

  // 楽観行: 未返答から消して返答済の先頭に仮表示
  const { displayPending, displayReplied, pendingCount, repliedCount } =
    useMemo(() => {
      // 1. 未返答から optimisticId を除外、failedId には reason 付与
      const filteredPending: InboxAudit[] = pending
        .filter((a) => a.id !== optimisticId)
        .map((a) =>
          a.id === failedId && failedReason
            ? { ...a, failureReason: failedReason }
            : a
        );

      // 2. 返答済の先頭に optimistic 行を仮挿入 (本物の audit が既にあれば置換)
      let filteredReplied: InboxAudit[] = replied;
      if (optimisticId) {
        const optimisticItem: InboxAudit = {
          id: optimisticId,
          userName: job.userName ?? "(送信中)",
          joinedAtLabel: "",
          replyCount: 0,
          submittedDateLabel: null,
          publishedDateLabel: null,
          videoDurationLabel: null,
          daysSinceSubmit: 0,
          isOptimistic: true,
          optimisticStatus: job.status === "success" ? "success" : "uploading",
        };
        filteredReplied = [
          optimisticItem,
          ...replied.filter((a) => a.id !== optimisticId),
        ];
      }

      return {
        displayPending: filteredPending,
        displayReplied: filteredReplied,
        pendingCount: filteredPending.length,
        repliedCount: filteredReplied.length,
      };
    }, [pending, replied, optimisticId, failedId, failedReason, job.userName, job.status]);

  // 検索フィルタ
  const { showWaiting, showDone } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filterFn = (list: InboxAudit[]) =>
      q ? list.filter((a) => a.userName.toLowerCase().includes(q)) : list;
    return {
      showWaiting: tab === "done" ? [] : filterFn(displayPending),
      showDone: tab === "waiting" ? [] : filterFn(displayReplied),
    };
  }, [displayPending, displayReplied, search, tab]);

  const totalCount = pendingCount + repliedCount;

  return (
    <main className="min-h-screen bg-[#e8ebec] p-6">
      <div className="max-w-[1300px] mx-auto bg-white border border-[#e8ebe9] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,.08)] overflow-hidden">
        {/* === 管理画面ヘッダー === */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#e8ebe9] bg-white">
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="text-base font-bold text-[#004d40] flex items-center gap-1.5 hover:opacity-70"
              title="管理者ホームに戻る"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              筋肉塾 管理
            </a>
            <div className="text-[11px] text-zinc-500 pl-3 border-l border-[#e8ebe9]">
              月次添削 / 受信箱
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <div className="w-7 h-7 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-xs">
              {adminInitial}
            </div>
            {adminName}
          </div>
        </header>

        {/* === コンテンツ === */}
        <div className="bg-[#f8f9fa] px-6 py-5">
          {/* ページタイトル */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900">月次添削 受信箱</h2>
          </div>

          {/* 検索バー */}
          <div className="bg-white border border-[#e8ebe9] rounded-lg px-3.5 py-2.5 flex items-center gap-2 mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-zinc-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="受講生名で検索..."
              className="flex-1 border-none outline-none text-sm bg-transparent text-zinc-900 placeholder-zinc-400"
            />
            <span className="text-[11px] text-zinc-500 pl-3 border-l border-[#e8ebe9]">
              古い順
            </span>
          </div>

          {/* フィルタタブ */}
          <div className="flex gap-1 mb-4 border-b border-[#e8ebe9]">
            <FilterTab label="全て" count={totalCount} active={tab === "all"} onClick={() => setTab("all")} />
            <FilterTab label="未返答" count={pendingCount} active={tab === "waiting"} onClick={() => setTab("waiting")} danger />
            <FilterTab label="返答済" count={repliedCount} active={tab === "done"} onClick={() => setTab("done")} />
          </div>

          {/* === 未返答セクション === */}
          {(tab === "all" || tab === "waiting") && (
            <>
              <SectionLabel color="danger" text={`未返答 (古い順)`} />
              {showWaiting.length === 0 ? (
                <EmptyBlock
                  text={
                    search ? "該当する受講生はいません" : "未返答の月次添削はありません"
                  }
                />
              ) : (
                <InboxList>
                  {showWaiting.map((a) => (
                    <InboxRow key={a.id} audit={a} status="waiting" />
                  ))}
                </InboxList>
              )}
            </>
          )}

          {/* === 返答済セクション === */}
          {(tab === "all" || tab === "done") && (
            <div className={tab === "all" ? "mt-5" : ""}>
              <SectionLabel color="done" text={`返答済 (直近)`} />
              {showDone.length === 0 ? (
                <EmptyBlock
                  text={
                    search ? "該当する受講生はいません" : "返答済の月次添削はまだありません"
                  }
                />
              ) : (
                <InboxList>
                  {showDone.map((a) => (
                    <InboxRow key={a.id} audit={a} status="done" />
                  ))}
                </InboxList>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// =====================================================================
// 子コンポーネント
// =====================================================================

function FilterTab({
  label,
  count,
  active,
  danger = false,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const baseTab = active
    ? "text-[#00695c] border-b-2 border-[#00897b] font-bold"
    : "text-zinc-600 border-b-2 border-transparent hover:text-zinc-900";

  let countClass: string;
  if (active && danger) countClass = "bg-[#d32f2f] text-white";
  else if (active) countClass = "bg-[#00897b] text-white";
  else if (danger) countClass = "bg-[#fef5f5] text-[#d32f2f]";
  else countClass = "bg-[#f8f9fa] text-zinc-600";

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm flex items-center gap-2 cursor-pointer ${baseTab}`}
    >
      {label}
      <span
        className={`text-[11px] px-2 py-0.5 rounded-full font-medium font-mono ${countClass}`}
      >
        {count}
      </span>
    </button>
  );
}

function SectionLabel({
  color,
  text,
}: {
  color: "danger" | "done";
  text: string;
}) {
  const dotColor = color === "danger" ? "#d32f2f" : "#00897b";
  return (
    <div className="text-[11px] text-zinc-500 mt-4 mb-2 uppercase tracking-wider font-bold pl-1 flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: dotColor }}
      />
      {text}
    </div>
  );
}

function InboxList({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#e8ebe9] rounded-xl overflow-hidden">
      {children}
    </div>
  );
}

function InboxRow({
  audit,
  status,
}: {
  audit: InboxAudit;
  status: "waiting" | "done";
}) {
  // ===== 楽観表示: 「送信中」or「送信完了 (画面切替中)」 =====
  if (audit.isOptimistic) {
    const isUploading = audit.optimisticStatus === "uploading";
    return (
      <div
        className="grid items-center gap-3.5 px-5 py-3.5 border-b border-[#e8ebe9] last:border-b-0 bg-[rgba(255,235,59,0.05)] cursor-not-allowed"
        style={{ gridTemplateColumns: "32px 1fr 160px 100px 24px" }}
        title="動画送信中、画面操作はリロード後に有効になります"
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {isUploading ? (
            <div className="w-3.5 h-3.5 border-2 border-[#fef9e6] border-t-[#b8860b] rounded-full animate-spin" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00897b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 mb-0.5">
            {audit.userName}
          </div>
          <div className="text-[11px] text-[#b8860b] font-mono truncate">
            {isUploading
              ? "Vimeo にアップロード中..."
              : "送信完了 (画面切替中)"}
          </div>
        </div>
        <div>
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(255,235,59,0.4)] text-[#b8860b] border border-[#b8860b]/30">
            {isUploading ? "送信中…" : "送信完了 ✓"}
          </span>
        </div>
        <div className="text-xs text-zinc-400 text-right font-mono">—</div>
        <div></div>
      </div>
    );
  }

  // ===== 通常表示 (失敗時は赤強調 + 理由併記) =====
  const hasFailure = !!audit.failureReason;

  return (
    <Link
      href={`/admin/monthly-reviews/${audit.id}`}
      className={`grid items-center gap-3.5 px-5 py-3.5 border-b border-[#e8ebe9] last:border-b-0 hover:bg-[#f8f9fa] transition-colors ${
        status === "done" ? "opacity-60" : ""
      } ${hasFailure ? "bg-[#fef5f5] border-l-4 border-l-[#d32f2f]" : ""}`}
      style={{ gridTemplateColumns: "32px 1fr 160px 100px 24px" }}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        {status === "waiting" ? (
          <span className="w-2.5 h-2.5 rounded-full bg-[#d32f2f]" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00897b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-900 mb-0.5">
          {audit.userName}
        </div>
        <div className="text-[11px] text-zinc-500 font-mono truncate">
          {status === "waiting"
            ? `入会 ${audit.joinedAtLabel} ・ 過去返信 ${audit.replyCount} 回`
            : `返信 ${audit.publishedDateLabel ?? "—"}${
                audit.videoDurationLabel
                  ? ` ・ 動画 ${audit.videoDurationLabel}`
                  : ""
              }`}
        </div>
        {hasFailure && (
          <div className="text-[10px] text-[#d32f2f] font-medium mt-0.5 truncate">
            ⚠ 送信失敗: {audit.failureReason}
          </div>
        )}
      </div>
      <div>
        {hasFailure ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d32f2f] text-white">
            送信失敗
          </span>
        ) : status === "waiting" ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#fef5f5] text-[#d32f2f]">
            未返答
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(0,137,123,.1)] text-[#00695c]">
            返答済
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-700 text-right font-mono">
        {status === "waiting" ? (
          <>
            <b className="text-base font-bold text-zinc-900">
              {audit.daysSinceSubmit}
            </b>{" "}
            日経過
          </>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </div>
      <div className="text-zinc-400 text-xs font-mono text-right">▶</div>
    </Link>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="bg-white border border-dashed border-[#e8ebe9] rounded-xl px-6 py-8 text-center text-xs text-zinc-500">
      {text}
    </div>
  );
}
