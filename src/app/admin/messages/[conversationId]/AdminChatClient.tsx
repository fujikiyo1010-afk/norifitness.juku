"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { sendMessageAsAdmin } from "@/lib/chat/actions";
import { fetchMessagesForAdmin } from "./_actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useRealtimeMessages } from "@/lib/chat/useRealtimeMessages";
import type { ChatMessage } from "@/lib/chat/types";

/**
 * admin チャット Client ・送信 + ポーリング + Realtime + 楽観的更新
 */
export function AdminChatClient({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleNew = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);
  useRealtimeMessages(conversationId, handleNew);

  // フォールバック 5 秒ポーリング
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(async () => {
      const latest = await fetchMessagesForAdmin(conversationId);
      setMessages((prev) => {
        if (latest.length === prev.length) return prev;
        return latest;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const body = text.trim();
    if (body.length === 0 || sending) return;
    setText("");
    startSending(async () => {
      const r = await sendMessageAsAdmin(conversationId, body);
      if (!r.ok) {
        alert(r.message);
        setText(body);
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === r.message.id)) return prev;
        return [...prev, r.message];
      });
    });
  }

  return (
    <>
      {/* メッセージリスト */}
      <div
        className="flex-1 px-6 py-4 space-y-3 overflow-y-auto bg-[#e8efe1]"
        style={{ minHeight: "300px" }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-[12px] text-zinc-500 py-12">
            まだメッセージがありません。
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* 送信フォーム */}
      <div className="border-t border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="返信を入力 (Cmd+Enter で送信)"
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-[1.5] max-h-[160px] focus:outline-none focus:border-[#00897b]"
          />
          <button
            type="button"
            disabled={sending || text.trim().length === 0}
            onClick={handleSend}
            className="flex-shrink-0 rounded-md bg-[#00897b] hover:bg-[#00695c] text-white px-5 py-2 text-sm font-bold disabled:bg-zinc-400"
          >
            {sending ? (
              <>
                <LoadingSpinner /> 送信中…
              </>
            ) : (
              "送信"
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  // admin 視点: admin 発 = 右、 user 発 = 左
  const isAdmin = message.sender_kind === "admin";
  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isAdmin
            ? "max-w-[78%] bg-[#a3c98e] text-[#2b2620] rounded-[16px] rounded-tr-[4px] px-3.5 py-2"
            : "max-w-[78%] bg-[#fffdf8] text-[#2b2620] rounded-[16px] rounded-tl-[4px] px-3.5 py-2 shadow-sm"
        }
      >
        <p className="text-[14px] leading-[1.55] whitespace-pre-wrap break-words">
          {message.body}
        </p>
        <p
          className={`text-[10px] mt-1 font-mono ${
            isAdmin ? "text-[#34603f]/70" : "text-zinc-500"
          }`}
        >
          {formatJstTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

function formatJstTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  const today = new Date(Date.now() + 9 * 3600 * 1000);
  const isToday =
    jst.getUTCFullYear() === today.getUTCFullYear() &&
    jst.getUTCMonth() === today.getUTCMonth() &&
    jst.getUTCDate() === today.getUTCDate();
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  if (isToday) return `${hh}:${mm}`;
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}
