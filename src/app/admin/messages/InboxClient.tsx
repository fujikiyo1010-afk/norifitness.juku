"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminConversationRow } from "@/lib/chat/types";
import { ackChatUnreplied, unackChatUnreplied } from "@/lib/admin/chat-ack";

/**
 * 受信箱 Client(2026-07-24 新モデル)。
 * 「未対応」＝受講生の最終発言が、こちらの返信/完了より後の会話。開いても既読にならない。
 * 消えるのは「返信」か行の「完了」ボタンだけ(＝ホーム警報と共通の admin_chat_acks)。完了は取り消し可。
 */
export function InboxClient({
  conversations,
}: {
  conversations: AdminConversationRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [unhandledOnly, setUnhandledOnly] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = conversations;
    if (unhandledOnly) list = list.filter((c) => c.unhandled);
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((c) => {
        const hay = [c.user_name, c.user_email, c.last_message_body ?? ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [conversations, query, unhandledOnly]);

  function run(userId: string, fn: (i: { userId: string }) => Promise<unknown>) {
    setBusyId(userId);
    startTransition(async () => {
      await fn({ userId });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 検索 + フィルタ */}
      <div className="px-6 py-3 border-b border-zinc-200 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="受講生名 ・ メール ・ 本文 で検索"
            className="w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-[#00897b]"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={unhandledOnly}
            onChange={(e) => setUnhandledOnly(e.target.checked)}
            className="rounded"
          />
          未対応のみ
        </label>
      </div>

      {/* 一覧 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 py-12">
            {query.trim().length > 0 || unhandledOnly
              ? "該当する会話がありません"
              : "まだ会話がありません"}
          </div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const u = c.unhandled;
              const uid = c.conversation.user_id;
              const busy = pending && busyId === uid;
              return (
                <li key={c.conversation.id}>
                  <div
                    className={`flex items-stretch border-b border-zinc-100 transition-colors ${
                      u ? "bg-[#fff8ec]" : "bg-white hover:bg-zinc-50"
                    }`}
                  >
                    <Link
                      href={`/admin/messages/${c.conversation.id}`}
                      className="flex-1 min-w-0 flex items-start gap-3 px-6 py-3.5"
                    >
                      <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-[#00897b] text-white flex items-center justify-center text-sm font-bold">
                        {(c.user_name || "?").charAt(0)}
                        {u && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div
                            className={`text-[14px] truncate ${
                              u ? "font-bold text-zinc-900" : "font-semibold text-zinc-700"
                            }`}
                          >
                            {c.user_name}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono whitespace-nowrap flex-shrink-0">
                            {formatRelative(c.conversation.last_message_at)}
                          </div>
                        </div>
                        <div className="text-[10.5px] text-zinc-400 font-mono mb-1 truncate">
                          {c.user_email}
                        </div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-[12px] flex-1 truncate ${
                              u ? "text-zinc-900 font-medium" : "text-zinc-500"
                            }`}
                          >
                            {c.last_message_sender === "admin" && "↩ "}
                            {c.last_message_body ?? "(まだメッセージなし)"}
                          </p>
                          {u && c.unread_count > 0 && (
                            <span className="flex-shrink-0 min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 flex items-center justify-center font-mono">
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* 操作: 未対応=完了 / 完了済み=取り消し / 返信済み=表示のみ */}
                    <div className="flex items-center px-4 flex-shrink-0">
                      {u ? (
                        <button
                          type="button"
                          onClick={() => run(uid, ackChatUnreplied)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e8ebe9] rounded-md text-xs font-semibold text-[#00695c] hover:border-[#00897b] hover:bg-[#00897b]/10 transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3.5 h-3.5"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {busy ? "…" : "完了"}
                        </button>
                      ) : c.last_message_sender === "admin" ? (
                        <span className="text-[11px] font-semibold text-[#00897b] whitespace-nowrap">
                          ↩ 返信済み
                        </span>
                      ) : c.last_message_sender === "user" ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-[11px] font-semibold text-zinc-400">
                            対応済み
                          </span>
                          <button
                            type="button"
                            onClick={() => run(uid, unackChatUnreplied)}
                            disabled={busy}
                            className="text-[11px] font-semibold text-[#00695c] underline decoration-dotted hover:text-[#00897b] disabled:opacity-50"
                          >
                            取り消し
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}時間前`;
  if (diffMin < 60 * 24 * 7) return `${Math.floor(diffMin / (60 * 24))}日前`;
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${m}/${day}`;
}
