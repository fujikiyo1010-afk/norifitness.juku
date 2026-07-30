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
  // 誤送信防止: 送信ボタンの真上に「送信しますか？」の確認を出してから送る(案C)。
  const [confirming, setConfirming] = useState(false);
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

  // 送信ボタン/Cmd+Enter は即送信せず、まず確認の吹き出しを出す。
  function askConfirm() {
    if (text.trim().length === 0 || sending) return;
    setConfirming(true);
  }
  // 「はい」で実送信。
  function confirmSend() {
    setConfirming(false);
    handleSend();
  }

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
                askConfirm();
              }
            }}
            placeholder="返信を入力 (Cmd+Enter で確認)"
            rows={4}
            maxLength={2000}
            className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-[1.5] max-h-[320px] focus:outline-none focus:border-[#00897b]"
          />
          <div className="relative flex-shrink-0">
            {/* 誤送信防止の確認(案C): 送信ボタンの真上に吹き出し */}
            {confirming && !sending && (
              <div
                className="absolute bottom-full right-0 mb-2 w-[188px] rounded-lg border border-zinc-200 bg-white p-2.5 shadow-lg"
                style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,.1))" }}
              >
                <div className="mb-2 text-center text-[12px] font-bold text-zinc-800">
                  送信しますか？
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[12px] font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    いいえ
                  </button>
                  <button
                    type="button"
                    onClick={confirmSend}
                    className="flex-1 rounded-md bg-[#00897b] px-2 py-1.5 text-[12px] font-bold text-white hover:bg-[#00695c]"
                  >
                    はい
                  </button>
                </div>
                {/* 下向きの三角(ボタンを指す) */}
                <div className="absolute top-full right-6 -mt-1.5 h-2.5 w-2.5 rotate-45 border-b border-r border-zinc-200 bg-white" />
              </div>
            )}
            <button
              type="button"
              disabled={sending || text.trim().length === 0}
              onClick={askConfirm}
              className="rounded-md bg-[#00897b] hover:bg-[#00695c] text-white px-5 py-2 text-sm font-bold disabled:bg-zinc-400"
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
