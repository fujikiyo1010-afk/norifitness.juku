"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { GalleryPhoto } from "@/lib/body-photos/queries";
import { addBodyPhoto, deleteBodyPhoto } from "@/lib/body-photos/actions";
import { compressImage } from "@/lib/images/compress";
import { createClient } from "@/lib/supabase/client";
import { useRefreshOnReturn } from "@/lib/hooks/useRefreshOnReturn";
import { BottomSheet } from "../BottomSheet";

/**
 * 体型写真ギャラリー本体 (案A改) ・ 2026-07-06 P6 再設計
 *
 *   - 月チップ: 全て + 各月(枚数付き)。タップでその月だけ表示。
 *   - アコーディオン: 「全て」表示時は最新月だけ開き、古い月は畳む
 *     (開いた月のサムネだけ読み込む = 毎日30枚でも軽い)。
 *   - サムネ(thumbUrl)で一覧、タップで拡大(fullUrl)＋削除。
 *   - ＋追加: 圧縮(フル+サムネ)→ プライベートbucket直アップ → body_photos 登録。
 */

function todayString(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}
function mdLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}
function monthKey(iso: string): string {
  return iso.slice(0, 7);
}
function monthLabel(key: string): string {
  return `${Number(key.slice(0, 4))}年${Number(key.slice(5, 7))}月`;
}

type MonthSection = { key: string; label: string; items: GalleryPhoto[] };

export function PhotoGallery({
  photos,
  userId,
  isBeta = false,
}: {
  photos: GalleryPhoto[]; // recorded_at 降順
  userId: string;
  /** 体1(戻るで閉じる)・体2再試行文言のベータ出し分け。裏側(後始末/画像再取得)は全体。 */
  isBeta?: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);

  // 体4: 長時間離れて復帰したら署名URLを取り直す(1時間切れで画像が全滅するのを防ぐ)
  useRefreshOnReturn();

  const sections = useMemo<MonthSection[]>(() => {
    const map = new Map<string, GalleryPhoto[]>();
    for (const p of photos) {
      const k = monthKey(p.recorded_at);
      (map.get(k) ?? map.set(k, []).get(k)!).push(p);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      label: monthLabel(key),
      items,
    }));
  }, [photos]);

  const latestKey = sections[0]?.key ?? null;
  // "all" or a month key
  const [selected, setSelected] = useState<string>("all");
  // 「全て」表示時のアコーディオン開閉 (最新月のみ既定で開く)
  const [openMonths, setOpenMonths] = useState<Set<string>>(
    () => new Set(latestKey ? [latestKey] : [])
  );

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleSections =
    selected === "all"
      ? sections
      : sections.filter((s) => s.key === selected);

  return (
    <div>
      {/* ヘッダー行 (追加ボタン) */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="text-[12px] text-[#6a6256]">
          {photos.length === 0 ? "まだ写真がありません" : `全 ${photos.length} 枚`}
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-full bg-[#4a875b] px-4 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#34603f]"
        >
          ＋ 写真を追加
        </button>
      </div>

      {/* 月セレクタ (sticky) */}
      {sections.length > 0 ? (
        <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-y border-[#e7dcc9] bg-[#fffdf8] px-4 py-2.5">
          <Chip
            label="全て"
            count={photos.length}
            active={selected === "all"}
            onClick={() => setSelected("all")}
          />
          {sections.map((s) => (
            <Chip
              key={s.key}
              label={`${Number(s.key.slice(5, 7))}月`}
              count={s.items.length}
              active={selected === s.key}
              onClick={() => setSelected(s.key)}
            />
          ))}
        </div>
      ) : null}

      {/* 本体 */}
      <div className="px-4 py-4">
        {photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8cdba] bg-[#fffdf8] p-8 text-center">
            <div className="text-[13px] font-bold text-[#5b5344]">
              最初の1枚を追加しましょう
            </div>
            <div className="mt-1 text-[11px] text-[#a59b8c]">
              撮った写真で見た目の変化を並べて見られます。
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleSections.map((s) => {
              const open = selected !== "all" || openMonths.has(s.key);
              return (
                <div key={s.key}>
                  <button
                    type="button"
                    onClick={() =>
                      selected === "all" ? toggleMonth(s.key) : undefined
                    }
                    className="flex w-full items-center justify-between py-2"
                  >
                    <span className="text-[12px] font-bold text-[#004d40]">
                      {s.label}
                    </span>
                    <span className="flex items-center gap-2 text-[10px] font-bold text-[#8a8172]">
                      {!open ? (
                        <span className="flex gap-1">
                          {s.items.slice(0, 3).map((p) => (
                            <span
                              key={p.id}
                              className="relative block h-[26px] w-[26px] overflow-hidden rounded-[6px] bg-[#f0ece2]"
                            >
                              {p.thumbUrl ? (
                                <Image
                                  src={p.thumbUrl}
                                  alt=""
                                  fill
                                  sizes="26px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : null}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {s.items.length}枚
                      {selected === "all" ? (
                        <span
                          className={`transition-transform ${open ? "" : "-rotate-90"}`}
                        >
                          ▼
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {open ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      {s.items.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setLightbox(p)}
                          className="relative aspect-square overflow-hidden rounded-[10px] border border-[#e7dcc9] bg-[#f0ece2]"
                        >
                          {p.thumbUrl ? (
                            <Image
                              src={p.thumbUrl}
                              alt={mdLabel(p.recorded_at)}
                              fill
                              sizes="(max-width:460px) 33vw, 150px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : null}
                          <span className="absolute bottom-1 left-1 rounded-full bg-black/50 px-1.5 py-[1px] text-[8px] font-bold text-white">
                            {mdLabel(p.recorded_at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 追加シート */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="写真を追加"
        backClose={isBeta}
      >
        <PhotoAddForm
          userId={userId}
          isBeta={isBeta}
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
        title={lightbox ? `${mdLabel(lightbox.recorded_at)} の記録` : ""}
        backClose={isBeta}
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

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
        active
          ? "border-[#4a875b] bg-[#4a875b] text-white"
          : "border-[#e7dcc9] bg-white text-[#6a6256]"
      }`}
    >
      {label}
      <span
        className={`ml-1 text-[9px] font-bold ${active ? "text-[#d8ecdd]" : "text-[#a59b8c]"}`}
      >
        {count}
      </span>
    </button>
  );
}

function PhotoAddForm({
  userId,
  onSaved,
  isBeta = false,
}: {
  userId: string;
  onSaved: () => void;
  isBeta?: boolean;
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
    const supabase = createClient();
    const base = `${userId}/${recordedAt}-${Date.now()}`;
    const fullPath = `${base}.jpg`;
    const thumbPath = `${base}_t.jpg`;
    // 体2: 上げたファイルを追跡し、失敗時にまとめて後始末(孤立ファイル防止)
    const uploaded: string[] = [];
    try {
      const [full, thumb] = await Promise.all([
        compressImage(file, 1080, 0.82),
        compressImage(file, 240, 0.72),
      ]);
      const up1 = await supabase.storage
        .from("body-photos")
        .upload(fullPath, full, { contentType: "image/jpeg", upsert: false });
      if (up1.error) throw new Error(up1.error.message);
      uploaded.push(fullPath);
      const up2 = await supabase.storage
        .from("body-photos")
        .upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });
      // サムネ失敗は致命的でない(フルで代替できる)ので握りつぶさず記録だけ
      const thumbOk = !up2.error;
      if (thumbOk) uploaded.push(thumbPath);

      const result = await addBodyPhoto({
        recorded_at: recordedAt,
        storage_path: fullPath,
        thumb_path: thumbOk ? thumbPath : null,
        note: note.trim() || null,
      });
      if (!result.ok) throw new Error(result.message);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onSaved();
    } catch (e) {
      // 体2: 失敗時は上げたファイルを必ず削除(後始末)。フォームは保持=そのまま再試行可
      if (uploaded.length) {
        try {
          await supabase.storage.from("body-photos").remove(uploaded);
        } catch {}
      }
      setError(
        e instanceof Error
          ? `${e.message}（もう一度お試しください）`
          : "アップロードに失敗しました。もう一度お試しください。"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
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

      <div>
        <label className="mb-1.5 block text-[11px] font-bold text-[#6a6256]">
          撮影日
        </label>
        <input
          type="date"
          value={recordedAt}
          max={todayString()}
          onChange={(e) => setRecordedAt(e.target.value)}
          className="w-full appearance-none rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-left text-[13px] text-[#2b2620] [color-scheme:light] focus:border-[#4a875b] focus:outline-none"
        />
      </div>

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
        {busy
          ? "アップロード中..."
          : error && isBeta
            ? "再試行する"
            : "保存する"}
      </button>
    </div>
  );
}

function LightboxBody({
  photo,
  onDeleted,
}: {
  photo: GalleryPhoto;
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
        {photo.fullUrl ? (
          <Image
            src={photo.fullUrl}
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
