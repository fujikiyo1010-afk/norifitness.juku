"use client";

import { useMemo, useState } from "react";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import {
  deriveBeforeAfter,
  type AdminBodyPhoto,
} from "@/lib/admin/body-photos-shared";

/**
 * 受講生ハブ 体組成タブ の体型写真セクション(2026-07-22)。
 * サマリの下に「ビフォーアフター(初回→最新) + 撮影日順タイムライン」を出す。
 * データは page.tsx(server)で署名URL化して props で受け取る。写真が無ければ何も出さない。
 */
function mdLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}
function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000);
}

export function MetricsPhotoSection({ photos }: { photos: AdminBodyPhoto[] }) {
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  // ライトボックス用: フルURLがある写真だけ(新しい順)。index を合わせる。
  const viewable = useMemo(() => photos.filter((p) => p.fullUrl), [photos]);
  const fullUrls = useMemo(
    () => viewable.map((p) => p.fullUrl as string),
    [viewable]
  );
  // タイムラインは古い順(左→右)で見せる。
  const timeline = useMemo(() => [...viewable].reverse(), [viewable]);

  if (photos.length === 0) return null;
  const { count, first, last } = deriveBeforeAfter(photos);
  const openById = (id: string) => {
    const idx = viewable.findIndex((p) => p.id === id);
    if (idx >= 0) setLbIndex(idx);
  };

  return (
    <div className="bg-white border border-[#e8ebe9] rounded-2xl p-4 mb-4">
      {lbIndex !== null && (
        <PhotoLightbox
          photos={fullUrls}
          startIndex={lbIndex}
          onClose={() => setLbIndex(null)}
        />
      )}
      <div className="text-[11px] font-bold tracking-widest text-zinc-500 mb-3">
        体型写真 <span className="text-zinc-400">{count}枚</span>
      </div>

      {/* ビフォーアフター(2枚以上) */}
      {first && last && (
        <div
          className="grid items-center gap-4 mb-4"
          style={{ gridTemplateColumns: "1fr auto 1fr" }}
        >
          <PhotoCell label={`初回 ${mdLabel(first.recordedAt)}`} photo={first} onOpen={() => openById(first.id)} />
          <div className="flex flex-col items-center gap-1 text-[11px] font-bold text-[#00897b]">
            <span style={{ fontSize: 22, lineHeight: 1 }}>→</span>
            <span>{daysBetween(first.recordedAt, last.recordedAt)}日</span>
          </div>
          <PhotoCell label={`最新 ${mdLabel(last.recordedAt)}`} photo={last} onOpen={() => openById(last.id)} />
        </div>
      )}

      {/* タイムライン(撮影日順・横スクロール) */}
      <div className="text-[11px] font-bold text-zinc-500 mb-2">
        タイムライン（撮影日順）
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {timeline.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openById(p.id)}
            className="relative aspect-[3/4] w-[78px] flex-shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-[#e8ebe9] bg-[#eef1ef]"
            aria-label={`${mdLabel(p.recordedAt)} の写真を拡大`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.thumbUrl ?? (p.fullUrl as string)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {mdLabel(p.recordedAt)}
            </span>
          </button>
        ))}
      </div>
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
      <div className="mb-1.5 text-center text-[11px] font-bold text-zinc-700">
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
