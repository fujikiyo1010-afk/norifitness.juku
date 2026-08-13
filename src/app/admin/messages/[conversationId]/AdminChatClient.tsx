"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { sendMessageAsAdmin, sendImageMessageAsAdmin } from "@/lib/chat/actions";
import { fetchMessagesForAdmin } from "./_actions";
import { compressImage } from "@/lib/images/compress";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useRealtimeMessages } from "@/lib/chat/useRealtimeMessages";
import { MessageBody } from "@/components/chat/MessageBody";
import { ChatImage } from "@/components/chat/ChatImage";
import { listLessonsForPicker, type LessonPickerItem } from "./_lessons";
import { getRecordsForQuote, type QuoteRecords } from "./_records";
import type { ChatMessage } from "@/lib/chat/types";

/**
 * admin チャット Client ・送信 + ポーリング + Realtime + 楽観的更新
 */
export function AdminChatClient({
  conversationId,
  userId,
  initialMessages,
}: {
  conversationId: string;
  userId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, startSending] = useTransition();
  // 誤送信防止: 送信ボタンの真上に「送信しますか？」の確認を出してから送る(案C)。
  const [confirming, setConfirming] = useState(false);
  // レッスンを選んで貼る(段2)。
  const [lessonOpen, setLessonOpen] = useState(false);
  const [lessons, setLessons] = useState<LessonPickerItem[] | null>(null);
  const [lessonQ, setLessonQ] = useState("");
  // 記録を引用(段3)。
  const [recordOpen, setRecordOpen] = useState(false);
  const [records, setRecords] = useState<QuoteRecords | null>(null);
  const [recordTab, setRecordTab] = useState<"meals" | "weights">("meals");
  // 画像添付(段4)。
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
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

  // レッスンピッカー: 開いた時に一度だけ取得。
  async function toggleLessonPicker() {
    const next = !lessonOpen;
    setLessonOpen(next);
    if (next && lessons === null) {
      try {
        setLessons(await listLessonsForPicker());
      } catch {
        setLessons([]);
      }
    }
  }
  // 選択 → 「タイトル + URL」を本文に挿入(URLは送信後チップになる)。
  function insertLesson(item: LessonPickerItem) {
    const ins = `${item.title}\n${item.url}`;
    setText((t) => (t.trim() ? `${t}\n${ins}` : ins));
    setLessonOpen(false);
    setLessonQ("");
  }
  const filteredLessons = (lessons ?? [])
    .filter((l) => l.title.toLowerCase().includes(lessonQ.trim().toLowerCase()))
    .slice(0, 60);

  // 記録を引用ピッカー: 開いた時に一度だけ取得。
  async function toggleRecordPicker() {
    const next = !recordOpen;
    setRecordOpen(next);
    setLessonOpen(false);
    if (next && records === null) {
      try {
        setRecords(await getRecordsForQuote(userId));
      } catch {
        setRecords({ meals: [], weights: [] });
      }
    }
  }
  function insertQuote(text: string) {
    setText((t) => (t.trim() ? `${t}\n${text}` : text));
    setRecordOpen(false);
  }

  // 画像を選ぶ → クライアント圧縮(フル+サムネ) → アップロード送信(本文=キャプション)。
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選んでください");
      return;
    }
    setUploadingImg(true);
    try {
      const full = await compressImage(file, 1600, 0.82);
      const thumb = await compressImage(file, 400, 0.7);
      const fd = new FormData();
      fd.append("full", new File([full], "full.jpg", { type: "image/jpeg" }));
      fd.append("thumb", new File([thumb], "thumb.jpg", { type: "image/jpeg" }));
      fd.append("caption", text.trim());
      const r = await sendImageMessageAsAdmin(conversationId, fd);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setText("");
      setMessages((prev) =>
        prev.some((m) => m.id === r.message.id) ? prev : [...prev, r.message]
      );
    } catch {
      alert("画像の送信に失敗しました");
    } finally {
      setUploadingImg(false);
    }
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
      {lightbox && (
        <PhotoLightbox photos={[lightbox]} onClose={() => setLightbox(null)} />
      )}
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
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} onImageClick={setLightbox} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 送信フォーム */}
      <div className="border-t border-zinc-200 bg-white px-4 py-3">
        {/* ツールバー(段2: レッスン / 段4: 画像) */}
        <div className="relative mb-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImg}
            className="inline-flex items-center gap-1 rounded-md border border-[#e8ebe9] bg-white px-2 py-1 text-[12px] font-semibold text-[#00695c] hover:border-[#00897b] hover:bg-[#00897b]/10 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            {uploadingImg ? "送信中…" : "画像"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
          <button
            type="button"
            onClick={toggleLessonPicker}
            className="inline-flex items-center gap-1 rounded-md border border-[#e8ebe9] bg-white px-2 py-1 text-[12px] font-semibold text-[#00695c] hover:border-[#00897b] hover:bg-[#00897b]/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
            </svg>
            レッスンを貼る
          </button>

          {lessonOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-[340px] rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
              <div className="px-1 pb-1.5 text-[11px] font-bold text-zinc-500">
                レッスンを選んで貼る
              </div>
              <input
                value={lessonQ}
                onChange={(e) => setLessonQ(e.target.value)}
                placeholder="レッスン名で検索…"
                className="mb-1.5 w-full rounded border border-zinc-300 px-2 py-1 text-[12px] focus:border-[#00897b] focus:outline-none"
              />
              <div className="max-h-52 overflow-y-auto">
                {lessons === null ? (
                  <div className="px-2 py-3 text-center text-[12px] text-zinc-400">
                    読み込み中…
                  </div>
                ) : filteredLessons.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[12px] text-zinc-400">
                    該当なし
                  </div>
                ) : (
                  filteredLessons.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => insertLesson(l)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-[#f0f7f5] hover:text-[#00695c]"
                    >
                      ▶ {l.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={toggleRecordPicker}
            className="inline-flex items-center gap-1 rounded-md border border-[#e8ebe9] bg-white px-2 py-1 text-[12px] font-semibold text-[#00695c] hover:border-[#00897b] hover:bg-[#00897b]/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M9 13h6M9 17h4" />
            </svg>
            記録を引用
          </button>

          {recordOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-[340px] rounded-lg border border-zinc-200 bg-white p-2 shadow-xl">
              <div className="px-1 pb-1.5 text-[11px] font-bold text-zinc-500">
                この受講生の記録を引用
              </div>
              <div className="mb-1.5 flex gap-1.5">
                {(["meals", "weights"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRecordTab(t)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      recordTab === t
                        ? "bg-[#00897b] text-white"
                        : "border border-zinc-300 bg-white text-zinc-500"
                    }`}
                  >
                    {t === "meals" ? "食事" : "体重"}
                  </button>
                ))}
              </div>
              <div className="max-h-52 overflow-y-auto">
                {records === null ? (
                  <div className="px-2 py-3 text-center text-[12px] text-zinc-400">
                    読み込み中…
                  </div>
                ) : (recordTab === "meals" ? records.meals : records.weights)
                    .length === 0 ? (
                  <div className="px-2 py-3 text-center text-[12px] text-zinc-400">
                    記録なし
                  </div>
                ) : (
                  (recordTab === "meals" ? records.meals : records.weights).map(
                    (r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => insertQuote(r.text)}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-[#f0f7f5] hover:text-[#00695c]"
                      >
                        {r.label}
                      </button>
                    )
                  )
                )}
              </div>
            </div>
          )}
        </div>

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

function MessageBubble({
  message,
  onImageClick,
}: {
  message: ChatMessage;
  onImageClick?: (url: string) => void;
}) {
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
        <ChatImage message={message} onImageClick={onImageClick} />
        {message.body && (
          <p className="text-[14px] leading-[1.55] whitespace-pre-wrap break-words">
            <MessageBody text={message.body} />
          </p>
        )}
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
