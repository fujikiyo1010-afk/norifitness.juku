"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UserListSummary } from "@/lib/workout/queries";
import { AUDIT_STATUS_LABELS_ADMIN } from "@/lib/monthly-audit/types";

type SortKey = "lastAction" | "joinedAt" | "name" | "actionsNeeded";
type FilterKey = "all" | "actionsNeeded" | "noMenu";

/**
 * 受講生一覧 (Client Component)
 *
 * 機能:
 *   - 検索: 名前のあいまいマッチ
 *   - フィルタ: 全員 / 要対応のみ / メニュー未配布のみ
 *   - ソート: 最終アクション / 加入日 / 名前 / 要対応数
 */
export function UsersListClient({ users }: { users: UserListSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("lastAction");

  const filtered = useMemo(() => {
    let list = users;

    // 検索
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => u.displayName.toLowerCase().includes(q));
    }

    // フィルタ
    if (filter === "actionsNeeded") {
      list = list.filter(
        (u) =>
          u.pendingRequestCount > 0 ||
          u.menuReviewNeeded ||
          u.latestAuditStatus === "c_submitted"
      );
    } else if (filter === "noMenu") {
      list = list.filter((u) => !u.hasCurrentMenu);
    }

    // ソート
    const sorted = [...list];
    if (sort === "lastAction") {
      sorted.sort((a, b) =>
        (b.lastActionAt ?? "").localeCompare(a.lastActionAt ?? "")
      );
    } else if (sort === "joinedAt") {
      sorted.sort((a, b) =>
        (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "")
      );
    } else if (sort === "name") {
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
    } else if (sort === "actionsNeeded") {
      sorted.sort((a, b) => actionScore(b) - actionScore(a));
    }

    return sorted;
  }, [users, query, filter, sort]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* ヘッダー */}
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900">受講生一覧</h1>
            <p className="text-sm text-zinc-600 mt-1">
              全 {users.length} 名 / 表示中 {filtered.length} 名
            </p>
          </div>
        </header>

        {/* 検索 + フィルタ + ソート */}
        <section className="mb-5 rounded-[14px] border border-[#e8ebe9] bg-white p-4 flex flex-wrap items-center gap-3">
          {/* 検索 */}
          <input
            type="search"
            placeholder="名前で検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px] rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#00897b]"
          />
          {/* フィルタ */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-zinc-500">表示:</span>
            <FilterChip
              label="全員"
              active={filter === "all"}
              onClick={() => setFilter("all")}
              count={users.length}
            />
            <FilterChip
              label="要対応"
              active={filter === "actionsNeeded"}
              onClick={() => setFilter("actionsNeeded")}
              count={users.filter(actionsNeededCount).length}
              tone="warning"
            />
            <FilterChip
              label="未配布"
              active={filter === "noMenu"}
              onClick={() => setFilter("noMenu")}
              count={users.filter((u) => !u.hasCurrentMenu).length}
            />
          </div>
          {/* ソート */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-zinc-500">並び:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-zinc-200 px-2 py-1.5 text-xs focus:outline-none focus:border-[#00897b]"
            >
              <option value="lastAction">最終アクション (新しい順)</option>
              <option value="joinedAt">加入日 (新しい順)</option>
              <option value="name">名前 (五十音順)</option>
              <option value="actionsNeeded">要対応数 (多い順)</option>
            </select>
          </div>
        </section>

        {/* 一覧 */}
        <section className="rounded-[14px] border border-[#e8ebe9] bg-white overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              該当する受講生がいません
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-[#e8ebe9]">
                <tr className="text-[10px] font-bold text-zinc-500 tracking-widest">
                  <th className="text-left px-4 py-3">受講生</th>
                  <th className="text-left px-3 py-3">カルテ</th>
                  <th className="text-left px-3 py-3">目標シート</th>
                  <th className="text-left px-3 py-3">月次</th>
                  <th className="text-left px-3 py-3">メニュー</th>
                  <th className="text-left px-3 py-3">リクエスト</th>
                  <th className="text-left px-3 py-3">最終アクション</th>
                  <th className="text-right px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

// =====================================================================
// 行
// =====================================================================

function UserRow({ user: u }: { user: UserListSummary }) {
  return (
    <tr className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm font-bold text-zinc-900">{u.displayName}</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">
          {u.age != null ? `${u.age}歳` : "—"}
          {u.ageBand && ` / ${u.ageBand}`}
          {u.gender && ` / ${u.gender}`}
          {u.joinedAt && (
            <>
              <span className="mx-1.5 text-zinc-300">|</span>
              加入 {formatShortDate(u.joinedAt)}
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <CarteStatusBadge
          submitted={u.hasCarteSubmitted}
          hasMenu={u.hasCurrentMenu}
          reviewNeeded={u.menuReviewNeeded}
        />
      </td>
      <td className="px-3 py-3">
        <GoalSheetStatusBadge state={u.goalSheetState} />
      </td>
      <td className="px-3 py-3">
        <AuditStatusBadge status={u.latestAuditStatus} />
        {u.latestAuditTargetMonth && (
          <div className="text-[9px] text-zinc-400 mt-0.5 font-mono">
            {u.latestAuditTargetMonth.slice(0, 7).replace("-", "/")}
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        {u.hasCurrentMenu ? (
          <span className="inline-flex rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium border border-emerald-200">
            配布済み
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-medium border border-amber-200">
            未配布
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        {u.pendingRequestCount > 0 ? (
          <span className="inline-flex rounded-full bg-orange-50 text-orange-700 px-2 py-0.5 text-[10px] font-bold border border-orange-200">
            未対応 {u.pendingRequestCount} 件
          </span>
        ) : (
          <span className="text-[10px] text-zinc-400">なし</span>
        )}
      </td>
      <td className="px-3 py-3 text-[10px] text-zinc-500 font-mono">
        {u.lastActionAt ? formatShortDate(u.lastActionAt) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/users/${u.id}`}
          className="rounded-[4px] border border-zinc-300 bg-white hover:bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700"
        >
          ハブを開く →
        </Link>
      </td>
    </tr>
  );
}

// =====================================================================
// 補助
// =====================================================================

function CarteStatusBadge({
  submitted,
  hasMenu,
  reviewNeeded,
}: {
  submitted: boolean;
  hasMenu: boolean;
  reviewNeeded: boolean;
}) {
  // 状態判定 (= ハブを開かなくても カルテ→メニュー の流れを 1 目で把握)
  //   - 未提出: カルテまだ提出されてない (= 受講生がオンボ後カルテ未記入)
  //   - メニュー作成中: カルテ提出済 + メニュー未配布 = admin 対応待ち
  //   - 更新依頼あり: 受講生が「カルテ変更依頼」 を出してる = admin 対応
  //   - 配布済: メニュー配布完了 + 更新依頼なし = 落ち着いた状態
  const state: "not_submitted" | "menu_pending" | "review_needed" | "delivered" =
    !submitted
      ? "not_submitted"
      : reviewNeeded
        ? "review_needed"
        : hasMenu
          ? "delivered"
          : "menu_pending";

  const config = {
    not_submitted: {
      label: "未提出",
      cls: "bg-zinc-100 text-zinc-600 border border-zinc-200",
    },
    menu_pending: {
      label: "メニュー作成中",
      cls: "bg-amber-50 text-amber-800 border border-amber-200 font-bold",
    },
    review_needed: {
      label: "更新依頼あり",
      cls: "bg-orange-100 text-orange-800 border border-orange-300 font-bold",
    },
    delivered: {
      label: "配布済",
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
  }[state];

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

function GoalSheetStatusBadge({
  state,
}: {
  state: UserListSummary["goalSheetState"];
}) {
  const config = {
    not_started: {
      label: "未記入",
      cls: "bg-zinc-100 text-zinc-600 border border-zinc-200",
    },
    in_review: {
      label: "添削待ち",
      cls: "bg-amber-50 text-amber-800 border border-amber-200 font-bold",
    },
    review_requested: {
      label: "再添削依頼",
      cls: "bg-orange-100 text-orange-800 border border-orange-300 font-bold",
    },
    reviewed: {
      label: "添削済",
      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
  }[state];

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

function AuditStatusBadge({
  status,
}: {
  status: UserListSummary["latestAuditStatus"];
}) {
  const cls =
    status === "c_submitted"
      ? "bg-rose-500 text-white font-bold"
      : status === "d_replied"
        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
        : status === "b_in_progress"
          ? "bg-amber-50 text-amber-800 border border-amber-200"
          : "bg-zinc-100 text-zinc-600 border border-zinc-200";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${cls}`}
    >
      {AUDIT_STATUS_LABELS_ADMIN[status]}
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: "warning";
}) {
  const activeColor =
    tone === "warning"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-[rgba(0,137,123,0.08)] text-[#00695c] border-[#00897b]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
        active
          ? activeColor
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
      }`}
    >
      {label}{" "}
      <span className="text-[9px] font-mono opacity-70">({count})</span>
    </button>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function actionScore(u: UserListSummary): number {
  return (
    u.pendingRequestCount +
    (u.menuReviewNeeded ? 1 : 0) +
    (u.latestAuditStatus === "c_submitted" ? 1 : 0)
  );
}

function actionsNeededCount(u: UserListSummary): boolean {
  return (
    u.pendingRequestCount > 0 ||
    u.menuReviewNeeded ||
    u.latestAuditStatus === "c_submitted"
  );
}
