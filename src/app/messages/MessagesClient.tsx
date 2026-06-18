"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { sendMessageAsUser } from "@/lib/chat/actions";
import { useRealtimeMessages } from "@/lib/chat/useRealtimeMessages";
import type { ChatMessage } from "@/lib/chat/types";

/**
 * 受講生 チャット Client (2026-06-18 #2)
 *
 * - 初回 SSR で得た messages を state に流し、 以降は Realtime で増分追加
 * - 送信フォーム = sendMessageAsUser (= server action)
 * - 自動スクロール (新着 + 自分送信時)
 */
export function MessagesClient({
  conversationId,
  initialMessages,
  myUserId,
  myName,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  myUserId: string;
  myName: string;
}) {
  void myUserId;
  void myName;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, startSending] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime 購読 (= postgres_changes INSERT)
  const handleNew = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);
  useRealtimeMessages(conversationId, handleNew);

  // 新着 or 自分送信時に最下部へスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const body = text.trim();
    if (body.length === 0 || sending) return;
    setText("");
    startSending(async () => {
      const r = await sendMessageAsUser(body);
      if (!r.ok) {
        alert(r.message);
        setText(body);
        return;
      }
      // 楽観的更新: 自分の送信を即時表示 (= Realtime が動かない時の保険)
      setMessages((prev) => {
        if (prev.some((m) => m.id === r.message.id)) return prev;
        return [...prev, r.message];
      });
    });
  }

  return (
    <>
      {/* メッセージリスト (スクロール) */}
      <div
        ref={listRef}
        className="flex-1 px-4 py-3 space-y-3 overflow-y-auto"
        style={{ minHeight: "300px" }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-[12px] text-[#6a6256] py-12">
            まだメッセージがありません。
            <br />
            気軽に質問・相談を送ってみましょう。
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* 送信フォーム (固定下) */}
      <div className="border-t border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5 sticky bottom-0">
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
            placeholder="メッセージを入力 (Cmd+Enter で送信)"
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none rounded-[14px] border border-[#e7dcc9] bg-[#f9f5ed] px-3 py-2 text-[14px] leading-[1.5] max-h-[120px] focus:outline-none focus:border-[#4a875b]"
          />
          <button
            type="button"
            disabled={sending || text.trim().length === 0}
            onClick={handleSend}
            className="flex-shrink-0 rounded-full bg-[#4a875b] hover:bg-[#34603f] text-white w-10 h-10 flex items-center justify-center disabled:bg-[#a59b8c]"
            aria-label="送信"
            title="送信"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender_kind === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[78%] bg-[#4a875b] text-white rounded-[16px] rounded-tr-[4px] px-3.5 py-2"
            : "max-w-[78%] bg-[#fffdf8] border border-[#e7dcc9] text-[#2b2620] rounded-[16px] rounded-tl-[4px] px-3.5 py-2"
        }
      >
        <p className="text-[14px] leading-[1.55] whitespace-pre-wrap break-words">
          {message.body}
        </p>
        <p
          className={`text-[10px] mt-1 font-mono ${
            isUser ? "text-white/70" : "text-[#a59b8c]"
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
