"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { compressImage } from "@/lib/images/compress";
import {
  replySupportTicket,
  resolveSupportTicket,
  reopenSupportTicket,
} from "@/lib/support/admin-actions";
import type { SupportMessage, TicketStatus } from "@/lib/support/types";

/**
 * お問い合わせ 詳細の下半分(やりとり + 返信欄)。
 *
 * ・写真はクリックで拡大(署名URLはサーバで付与済み)
 * ・返信すると status が自動で in_progress へ上がり、赤バッジから外れる
 * ・「解決済みにする」= 受講生の入力欄が消える重い操作なので確認を挟む
 */
export function SupportThread({
  ticketId,
  status,
  messages,
  readAt,
}: {
  ticketId: string;
  status: TicketStatus;
  messages: SupportMessage[];
  readAt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const closed = status === "resolved";

  function onSend() {
    const body = text.trim();
    if (!body && !photo) return;
    startBusy(async () => {
      const fd = new FormData();
      fd.append("body", body);
      if (photo) {
        try {
          const blob = await compressImage(photo, 1600, 0.82);
          fd.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        } catch {
          alert("画像の処理に失敗しました");
          return;
        }
      }
      const r = await replySupportTicket(ticketId, fd);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setText("");
      setPhoto(null);
      router.refresh();
    });
  }

  function onResolve() {
    if (
      !confirm(
        "解決済みにしますか？\n\n受講生はこの問い合わせに書けなくなります（入力欄が消えます）。"
      )
    )
      return;
    startBusy(async () => {
      const r = await resolveSupportTicket(ticketId);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  function onReopen() {
    startBusy(async () => {
      const r = await reopenSupportTicket(ticketId);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <>
      {lightbox && <PhotoLightbox photos={[lightbox]} onClose={() => setLightbox(null)} />}

      {/* やりとり */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center text-[12.5px] text-zinc-400">
            まだやりとりがありません
          </div>
        ) : (
          messages.map((m) => {
            const isAdmin = m.sender_kind === "admin";
            const seen = isAdmin && readAt && readAt >= m.created_at;
            return (
              <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[66%]">
                  <div
                    className={
                      isAdmin
                        ? "rounded-[14px] rounded-tr-[4px] bg-[#a3c98e] px-3.5 py-2 text-[#2b2620]"
                        : "rounded-[14px] rounded-tl-[4px] border border-[#e8ebe9] bg-white px-3.5 py-2 text-zinc-800"
                    }
                  >
                    {m.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.photo_url}
                        alt=""
                        loading="lazy"
                        onClick={() => setLightbox(m.photo_url as string)}
                        className="mb-1.5 max-h-[220px] cursor-zoom-in rounded-lg border border-black/5 object-cover"
                      />
                    )}
                    {m.photo_path && !m.photo_url && (
                      <div className="mb-1.5 rounded-lg bg-black/5 px-2 py-1.5 text-[11px] text-zinc-500">
                        画像を読み込めませんでした
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.6]">
                      {m.body}
                    </p>
                    <p
                      className={`mt-1 font-mono text-[10px] ${
                        isAdmin ? "text-[#34603f]/70" : "text-zinc-400"
                      }`}
                    >
                      {jstTime(m.created_at)}
                      {seen ? " ・ 既読" : ""}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 返信 or 閉じた表示 */}
      {closed ? (
        <div className="flex-shrink-0 border-t border-[#e8ebe9] bg-zinc-100 px-5 py-3.5 text-center">
          <p className="text-[12px] text-zinc-600">
            この問い合わせは<b>解決済み</b>です。受講生の入力欄は閉じています。
          </p>
          <button
            type="button"
            onClick={onReopen}
            disabled={busy}
            className="mt-2 rounded-md border border-[#e8ebe9] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#00695c] transition-colors hover:border-[#00897b] disabled:opacity-50"
          >
            対応中に戻す
          </button>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-[#e8ebe9] bg-white px-5 py-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="返信を入力（受講生のアプリ内に届きます）"
            className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-[13.5px] leading-[1.6] focus:border-[#00897b] focus:outline-none"
          />
          {photo && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-[#cfe3df] bg-[#f0f7f5] px-2.5 py-1.5 text-[12px]">
              <span className="max-w-[220px] truncate">{photo.name}</span>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="text-zinc-400 hover:text-zinc-700"
                aria-label="添付を取り消す"
              >
                ✕
              </button>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (f && !f.type.startsWith("image/")) {
                  alert("画像ファイルを選んでください");
                  return;
                }
                setPhoto(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-md border border-[#e8ebe9] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#00695c] transition-colors hover:border-[#00897b] hover:bg-[#00897b]/10 disabled:opacity-50"
            >
              写真を添付
            </button>
            <span className="text-[11px] text-zinc-500">
              送信すると「対応中」に移り、赤バッジから消えます
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onResolve}
                disabled={busy}
                className="rounded-md border border-[#e8ebe9] bg-white px-3 py-1.5 text-[11.5px] font-bold text-zinc-600 transition-colors hover:border-zinc-400 disabled:opacity-50"
              >
                解決済みにする
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={busy || (text.trim().length === 0 && !photo)}
                className="rounded-md bg-[#00897b] px-4 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-[#00695c] disabled:bg-zinc-400"
              >
                {busy ? (
                  <>
                    <LoadingSpinner /> 送信中…
                  </>
                ) : (
                  "送信する"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** JST の 月/日 時:分 (サーバはUTCで動くので必ず +9h) */
function jstTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
