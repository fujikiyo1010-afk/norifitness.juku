"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminConversationRow } from "@/lib/chat/types";

/**
 * 受信箱 Client ・検索 + 未読フィルタ
 */
export function InboxClient({
  conversations,
}: {
  conversations: AdminConversationRow[];
}) {
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = conversations;
    if (unreadOnly) list = list.filter((c) => c.unread_count > 0);
    const q = query.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((c) => {
        const hay = [
          c.user_name,
          c.user_email,
          c.last_message_body ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [conversations, query, unreadOnly]);

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
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded"
          />
          未読のみ
        </label>
      </div>

      {/* 一覧 */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 py-12">
            {query.trim().length > 0 || unreadOnly
              ? "該当する会話がありません"
              : "まだ会話がありません"}
          </div>
        ) : (
          <ul>
            {filtered.map((c) => (
              <li key={c.conversation.id}>
                <Link
                  href={`/admin/messages/${c.conversation.id}`}
                  className="block px-6 py-3.5 border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00897b] text-white flex items-center justify-center text-sm font-bold">
                      {(c.user_name || "?").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-[14px] font-bold text-zinc-900 truncate">
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
                            c.unread_count > 0
                              ? "text-zinc-900 font-medium"
                              : "text-zinc-500"
                          }`}
                        >
                          {c.last_message_sender === "admin" && "↩ "}
                          {c.last_message_body ?? "(まだメッセージなし)"}
                        </p>
                        {c.unread_count > 0 && (
                          <span className="flex-shrink-0 min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 flex items-center justify-center font-mono">
                            {c.unread_count > 99 ? "99+" : c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
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
