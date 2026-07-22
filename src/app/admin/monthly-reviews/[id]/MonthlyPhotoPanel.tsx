"use client";

import { useMemo, useState } from "react";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import {
  deriveBeforeAfter,
  type AdminBodyPhoto,
} from "@/lib/admin/body-photos-shared";

/**
 * 月次添削 個別作業・動画返信エリア右側の体型写真パネル(2026-07-22)。
 * 対象月に撮影された写真だけを受け取り、月初→月末のビフォーアフター + その月の撮影一覧を出す。
 * 録画ボタンのすぐ隣で「1ヶ月の体の変化」を見ながら添削できるようにする狙い。
 */
function mdLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

export function MonthlyPhotoPanel({
  photos,
  monthLabel,
}: {
  photos: AdminBodyPhoto[];
  monthLabel: string;
}) {
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  // 新しい順。ライトボックス/一覧は古い順(左→右)で見せる。
  const viewable = useMemo(() => photos.filter((p) => p.fullUrl), [photos]);
  const ordered = useMemo(() => [...viewable].reverse(), [viewable]);
  const fullUrls = useMemo(
    () => ordered.map((p) => p.fullUrl as string),
    [ordered]
  );
  const openById = (id: string) => {
    const idx = ordered.findIndex((p) => p.id === id);
    if (idx >= 0) setLbIndex(idx);
  };

  const { count, first, last } = deriveBeforeAfter(photos);

  return (
    <div className="bg-white/75 border border-[#e8ebe9] rounded-xl p-3.5 flex flex-col">
      {lbIndex !== null && (
        <PhotoLightbox
          photos={fullUrls}
          startIndex={lbIndex}
          onClose={() => setLbIndex(null)}
        />
      )}
      <div className="flex items-center mb-2.5">
        <span className="text-[11px] font-bold text-zinc-600 flex items-center gap-1.5">
          <PhotoIcon />
          体型写真（今月）
        </span>
        <span className="ml-auto text-[10px] text-zinc-400 font-mono">
          {monthLabel}
        </span>
      </div>

      {count === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-[#e8ebe9] bg-white/60 px-3 py-6 text-center text-[11px] text-zinc-400">
          今月アップされた体型写真はありません
        </div>
      ) : (
        <>
          {/* 月初 → 月末(2枚以上のとき) */}
          {first && last && (
            <div
              className="grid items-center gap-2 mb-2.5"
              style={{ gridTemplateColumns: "1fr auto 1fr" }}
            >
              <PhotoCell label={`月初 ${mdLabel(first.recordedAt)}`} photo={first} onOpen={() => openById(first.id)} />
              <div className="text-center text-[16px] font-bold text-[#00897b]">→</div>
              <PhotoCell label={`月末 ${mdLabel(last.recordedAt)}`} photo={last} onOpen={() => openById(last.id)} />
            </div>
          )}

          {/* この月の撮影 */}
          <div className="text-[10px] font-bold text-zinc-500 mb-1.5">今月の撮影</div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {ordered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openById(p.id)}
                className="relative aspect-[3/4] w-[56px] flex-shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-[#e8ebe9] bg-[#eef1ef]"
                aria-label={`${mdLabel(p.recordedAt)} の写真を拡大`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbUrl ?? (p.fullUrl as string)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 py-0.5 text-[9.5px] font-bold leading-none text-white">
                  {mdLabel(p.recordedAt)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PhotoCell({
  label,
  photo,
  onOpen,
}: {
  label: string;
  photo: AdminBodyPhoto;
  onOpen: () => void;
}) {
  return (
    <div>
      <div className="mb-1 text-center text-[10.5px] font-bold text-zinc-700">
        {label}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-lg border border-[#e8ebe9] bg-[#eef1ef]"
        aria-label={`${label} の写真を拡大`}
      >
        {photo.thumbUrl || photo.fullUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumbUrl ?? (photo.fullUrl as string)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </button>
    </div>
  );
}

function PhotoIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00897b"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
