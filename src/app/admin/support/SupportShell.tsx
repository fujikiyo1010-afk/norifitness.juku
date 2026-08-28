"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminTicketRow } from "@/lib/support/admin-queries";
import type { TicketStatus } from "@/lib/support/types";

/**
 * お問い合わせ 左一覧(クライアント)。
 *
 * タブの意味 = 「誰の番か」。トリガ trg_support_reopen_on_user_message により
 * status が正になるので、status をそのまま使える。
 *   未対応 open        = 返信待ち(こちらの番) ← サイドバーの赤バッジと同じ数
 *   対応中 in_progress = 返信済み(相手の番)
 *   解決済み resolved  = 閉じた(受講生は書けない)
 *
 * 件数が少ないので絞り込みはクライアントで行う(レイアウトは searchParams を受け取れないため)。
 */
type Tab = "open" | "in_progress" | "resolved" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "未対応" },
  { key: "in_progress", label: "対応中" },
  { key: "resolved", label: "解決済み" },
  { key: "all", label: "すべて" },
];

function agoLabel(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return jstDate(iso);
}
/** JST の 月/日 (サーバはUTCで動くので必ず +9h して出す) */
function jstDate(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
function daysSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

export function SupportShell({
  tickets,
  currentVersion,
  children,
}: {
  tickets: AdminTicketRow[];
  currentVersion: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const selectedId = pathname.startsWith("/admin/support/")
    ? pathname.slice("/admin/support/".length).split("/")[0]
    : null;

  // タブは「手で選んだもの」を優先し、未選択なら“開いている件の状態”に自動で合わせる。
  //   → 通知から /admin/support/{id} に着地した時、その件が入っているタブが開く(§7)。
  //   状態の書き換えではなく導出なので、余計な再描画が起きない。
  const [pickedTab, setPickedTab] = useState<Tab | null>(null);
  const selectedStatus = selectedId
    ? tickets.find((x) => x.id === selectedId)?.status
    : undefined;
  const tab: Tab = pickedTab ?? (selectedStatus as Tab | undefined) ?? "open";
  const setTab = setPickedTab;

  const counts = useMemo(() => {
    const c: Record<TicketStatus, number> = { open: 0, in_progress: 0, resolved: 0 };
    for (const t of tickets) c[t.status]++;
    return c;
  }, [tickets]);

  const visible = useMemo(
    () => (tab === "all" ? tickets : tickets.filter((t) => t.status === tab)),
    [tickets, tab]
  );

  return (
    // 画面の高さで止める(h-full + overflow-hidden)。こうしないとページ全体が伸びて
    // ヘッダ・環境の帯・返信欄が一緒に流れてしまう。スクロールするのは一覧と本文だけ。
    <div className="flex h-full overflow-hidden">
      {/* 左 ・ 一覧 */}
      <aside className="flex h-full w-[400px] flex-shrink-0 flex-col border-r border-[#e8ebe9] bg-white">
        <div className="border-b border-[#e8ebe9] px-3.5 pt-3 pb-0">
          <h1 className="mb-2 text-[15px] font-bold">問い合わせ</h1>
          <div className="flex gap-1">
            {TABS.map((t) => {
              const n =
                t.key === "all" ? tickets.length : counts[t.key as TicketStatus];
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-t-lg border border-b-0 px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                    on
                      ? "border-[#e8ebe9] bg-[#f4f6f5] text-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {t.label}
                  <span
                    className={`ml-1 font-mono font-extrabold ${
                      t.key === "open" && n > 0 ? "text-red-500" : "text-zinc-400"
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12.5px] text-zinc-400">
              この状態の問い合わせはありません
            </div>
          ) : (
            visible.map((t) => (
              <Row
                key={t.id}
                t={t}
                selected={t.id === selectedId}
                stale={!!currentVersion && !!t.appVersion && t.appVersion !== currentVersion}
              />
            ))
          )}
        </div>
      </aside>

      {/* 右 ・ 詳細 (上=ヘッダ/環境の帯・下=返信欄 は固定、間の本文だけスクロール) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f6f5]">{children}</div>
    </div>
  );
}

function Chip({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "teal" | "warn" | "photo" | "unread" | "read" | "done";
}) {
  const cls = {
    gray: "bg-zinc-100 text-zinc-600",
    teal: "bg-[#eef6f4] text-[#00695c]",
    warn: "bg-[#fdeee6] text-[#c2410c] border border-[#fbd5bd]",
    photo: "bg-indigo-50 text-indigo-700",
    unread: "bg-red-50 text-red-700 border border-red-200",
    read: "bg-zinc-100 text-zinc-400",
    done: "bg-[#e3f4ec] text-[#2f9e78]",
  }[tone];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>
  );
}

function Row({
  t,
  selected,
  stale,
}: {
  t: AdminTicketRow;
  selected: boolean;
  stale: boolean;
}) {
  const unhandled = t.status === "open";
  return (
    <Link
      href={`/admin/support/${t.id}`}
      className={`block border-b border-zinc-100 px-3.5 py-2.5 transition-colors ${
        selected
          ? "bg-[#f0f7f5] shadow-[inset_3px_0_0_#00897b]"
          : unhandled
            ? "bg-amber-50 hover:bg-amber-100/70"
            : "hover:bg-zinc-50"
      }`}
    >
      <div className="mb-0.5 flex items-baseline gap-1.5">
        {unhandled && (
          <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-amber-500" />
        )}
        <span className="text-[13.5px] font-bold text-zinc-900">{t.userName}</span>
        <span className="ml-auto flex-shrink-0 font-mono text-[10.5px] text-zinc-400">
          {agoLabel(t.lastAt)}
        </span>
      </div>
      {/* 件名は1行に収める(はみ出しは…で切る) */}
      <div className="mb-1.5 truncate text-[12.5px] text-zinc-700">
        {t.subject || "（本文なし）"}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {t.screen && <Chip tone="teal">{t.screen}</Chip>}
        {t.isFollowUp && <Chip tone="unread">再質問</Chip>}
        {!t.userId && <Chip tone="warn">アプリ外</Chip>}
        {t.platform && <Chip>{t.platform}</Chip>}
        {t.appVersion && (
          <Chip tone={stale ? "warn" : "gray"}>
            {stale ? "⚠ " : ""}
            {t.appVersion}
          </Chip>
        )}
        {t.hasPhoto && <Chip tone="photo">写真</Chip>}
        {t.status === "in_progress" && t.studentRead === false && (
          <Chip tone="unread">未読</Chip>
        )}
        {t.status === "in_progress" && t.studentRead === true && <Chip tone="read">既読</Chip>}
        {t.status === "in_progress" && t.lastAdminAt && (
          <Chip>返信から{daysSince(t.lastAdminAt)}日</Chip>
        )}
        {t.status === "resolved" && <Chip tone="done">解決済み</Chip>}
      </div>
    </Link>
  );
}
