"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { BodyPhoto } from "@/lib/body-photos/queries";
import { addBodyPhoto, deleteBodyPhoto } from "@/lib/body-photos/actions";
import { compressImage } from "@/lib/images/compress";
import { createClient } from "@/lib/supabase/client";
import { BottomSheet } from "./BottomSheet";

/**
 * 体型ビフォーアフター写真 (2026-07-06 P6) ・ ウエスト＋写真タブ内
 *
 *   - 「写真を追加」→ シートで 日付/写真/メモ → クライアント圧縮(EXIF除去)
 *     → プライベート bucket 直アップロード → body_photos 登録
 *   - 2枚以上: 最初(入会時ごろ) / 最後(現在) をビフォーアフター表示
 *   - タイムライン: 全枚数を横スクロール、タップで拡大(ライトボックス)＋削除
 */

function todayString(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

export function PhotoSection({
  photos,
  userId,
}: {
  photos: BodyPhoto[];
  userId: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [lightbox, setLightbox] = useState<BodyPhoto | null>(null);

  const first = photos[0] ?? null;
  const last = photos.length > 1 ? photos[photos.length - 1] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="text-[12px] font-bold text-[#5b5344]">
          ビフォーアフター写真
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-full bg-[#4a875b] px-3.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#34603f]"
        >
          ＋ 写真を追加
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8cdba] bg-[#fffdf8] p-6 text-center">
          <div className="text-[13px] font-bold text-[#5b5344]">
            まだ写真がありません
          </div>
          <div className="mt-1 text-[11px] text-[#a59b8c]">
            撮った写真で見た目の変化を並べられます。まずは今の1枚を追加しましょう。
          </div>
        </div>
      ) : (
        <>
          {/* ビフォーアフター */}
          <div className="grid grid-cols-2 gap-2.5">
            <PhotoFrame
              label={last ? "入会時ごろ" : "記録"}
              photo={first}
              onClick={() => first && setLightbox(first)}
            />
            {last ? (
              <PhotoFrame
                label="現在"
                photo={last}
                onClick={() => setLightbox(last)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8cdba] bg-[#fffdf8] p-4 text-center text-[11px] text-[#a59b8c]">
                もう1枚追加すると
                <br />
                並べて比較できます
              </div>
            )}
          </div>

          {/* タイムライン */}
          {photos.length > 1 ? (
            <div>
              <div className="mb-1.5 px-0.5 text-[11px] font-bold text-[#6a6256]">
                すべての記録（{photos.length}枚）
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightbox(p)}
                    className="flex-none"
                  >
                    <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#e7dcc9] bg-[#f0ece2]">
                      {p.url ? (
                        <Image
                          src={p.url}
                          alt={dateLabel(p.recorded_at)}
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-center text-[9px] font-bold text-[#6a6256]">
                      {dateLabel(p.recorded_at)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* 追加シート */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="写真を追加"
      >
        <PhotoAddForm
          userId={userId}
          onSaved={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      </BottomSheet>

      {/* ライトボックス */}
      <BottomSheet
        open={lightbox != null}
        onClose={() => setLightbox(null)}
        title={lightbox ? `${dateLabel(lightbox.recorded_at)} の記録` : ""}
      >
        {lightbox ? (
          <LightboxBody
            photo={lightbox}
            onDeleted={() => {
              setLightbox(null);
              router.refresh();
            }}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

function PhotoFrame({
  label,
  photo,
  onClick,
}: {
  label: string;
  photo: BodyPhoto | null;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="block text-left">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#f0ece2]">
        {photo?.url ? (
          <Image
            src={photo.url}
            alt={label}
            fill
            sizes="(max-width:460px) 45vw, 200px"
            className="object-cover"
            unoptimized
          />
        ) : null}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
          {label}
        </span>
      </div>
      {photo ? (
        <div className="mt-1 text-center text-[10px] font-bold text-[#6a6256]">
          {dateLabel(photo.recorded_at)}
        </div>
      ) : null}
    </button>
  );
}

function PhotoAddForm({
  userId,
  onSaved,
}: {
  userId: string;
  onSaved: () => void;
}) {
  const [recordedAt, setRecordedAt] = useState(todayString());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function handleSave() {
    if (!file) {
      setError("写真を選んでください");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${userId}/${recordedAt}-${Date.now()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("body-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const result = await addBodyPhoto({
        recorded_at: recordedAt,
        storage_path: path,
        note: note.trim() || null,
      });
      if (!result.ok) {
        // 行の登録に失敗したら孤立オブジェクトを掃除
        await supabase.storage.from("body-photos").remove([path]);
        throw new Error(result.message);
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* 写真選択 / プレビュー */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative mx-auto flex aspect-[3/4] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#c9bfad] bg-[#fffdf8]"
      >
        {previewUrl ? (
          // プレビューは blob URL。next/image を通さず素の img で十分
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="プレビュー"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="px-4 text-center text-[12px] font-bold text-[#6a6256]">
            タップして写真を選ぶ
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {/* 日付 */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold text-[#6a6256]">
          撮影日
        </label>
        <input
          type="date"
          value={recordedAt}
          max={todayString()}
          onChange={(e) => setRecordedAt(e.target.value)}
          className="w-full rounded-lg border border-[#e7dcc9] px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
      </div>

      {/* メモ */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold text-[#6a6256]">
          メモ (任意)
        </label>
        <input
          type="text"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="正面 / 横 など"
          className="w-full rounded-lg border border-[#e7dcc9] px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
      </div>

      <p className="text-[10px] leading-relaxed text-[#a59b8c]">
        写真は非公開です。端末内で軽量化し、位置情報などは削除してから保存します。
      </p>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          ⚠ {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={busy || !file}
        className="w-full rounded-2xl bg-[#4a875b] py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#34603f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "アップロード中..." : "保存する"}
      </button>
    </div>
  );
}

function LightboxBody({
  photo,
  onDeleted,
}: {
  photo: BodyPhoto;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBodyPhoto(photo.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDeleted();
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#f0ece2]">
        {photo.url ? (
          <Image
            src={photo.url}
            alt="体型写真"
            fill
            sizes="260px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </div>
      {photo.note ? (
        <div className="text-center text-[12px] text-[#5b5344]">{photo.note}</div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          ⚠ {error}
        </div>
      ) : null}

      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-2xl border border-[#e7dcc9] py-2.5 text-[13px] font-bold text-[#6a6256]"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="flex-1 rounded-2xl bg-red-600 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "削除中..." : "削除する"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-2xl border border-red-200 py-2.5 text-[13px] font-bold text-red-600"
        >
          この写真を削除
        </button>
      )}
    </div>
  );
}
