"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { getUserBodyPhotosForDaily } from "./photo-actions";
import {
  deriveBeforeAfter,
  type AdminBodyPhoto,
} from "@/lib/admin/body-photos-shared";

/**
 * デイリー添削「写真」タブ(2026-07-22): 受講生の体型写真を見やすく閲覧する。
 * 期間チップ(全期間/3ヶ月/1ヶ月) + ビフォーアフター(初回→最新) + 全写真グリッド(新しい順・タップで拡大)。
 * 体型写真は body_photos(プライベートbucket・署名URL)。タブを開いた時だけ取得(遅延)。
 */

type Range = "all" | "3m" | "1m";
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: "all", label: "全期間", days: null },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "1m", label: "1ヶ月", days: 30 },
];

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
    active
      ? "bg-[#00897b] text-white"
      : "bg-white border border-[#e8ebe9] text-zinc-500 hover:text-zinc-800"
  }`;
}
function mdLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}
function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000);
}

export default function PhotoTab({ userId }: { userId: string }) {
  const [photos, setPhotos] = useState<AdminBodyPhoto[] | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [lbIndex, setLbIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getUserBodyPhotosForDaily(userId)
      .then((r) => alive && setPhotos(r))
      .catch(() => alive && setPhotos([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  // 期間で絞る(新しい順の配列・先頭が最新)。
  const filtered = useMemo(() => {
    if (!photos || photos.length === 0) return [];
    const cur = RANGES.find((r) => r.key === range) ?? RANGES[0];
    if (cur.days == null) return photos;
    const newest = Date.parse(photos[0].recordedAt);
    return photos.filter(
      (p) => Date.parse(p.recordedAt) >= newest - cur.days! * 86_400_000
    );
  }, [photos, range]);

  // ライトボックス用: フルURLがある写真だけ(新しい順)。グリッドと同じ並びで index を合わせる。
  const viewable = useMemo(() => filtered.filter((p) => p.fullUrl), [filtered]);
  const fullUrls = useMemo(
    () => viewable.map((p) => p.fullUrl as string),
    [viewable]
  );

  if (photos === null) {
    return (
      <div className="py-10 text-center text-[12px] text-zinc-400">読み込み中…</div>
    );
  }
  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e8ebe9] bg-[#fafbfb] p-6 text-center text-[12px] text-zinc-500">
        体型写真の記録はまだありません。
      </div>
    );
  }

  const { count, first, last } = deriveBeforeAfter(filtered);

  return (
    <div className="space-y-3">
      {lbIndex !== null && (
        <PhotoLightbox
          photos={fullUrls}
          startIndex={lbIndex}
          onClose={() => setLbIndex(null)}
        />
      )}

      {/* ヘッダー: 枚数 + 期間チップ */}
      <div className="flex items-center">
        <div className="text-[13px] font-bold text-zinc-900 flex items-center gap-1.5">
          <PhotoIcon />
          体型写真 <span className="text-[11px] font-semibold text-zinc-400">{count}枚</span>
        </div>
        <div className="ml-auto flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={chipClass(range === r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ビフォーアフター(2枚以上のとき) */}
      {first && last && (
        <div className="rounded-[11px] border border-[#e8ebe9] bg-white p-4">
          <div className="mb-3 text-[11px] font-bold text-zinc-500">
            ビフォーアフター
          </div>
          <div
            className="grid items-center gap-4"
            style={{ gridTemplateColumns: "1fr auto 1fr" }}
          >
            <BeforeAfterCell label={`初回 ${mdLabel(first.recordedAt)}`} photo={first} onOpen={() => openAt(first)} />
            <div className="flex flex-col items-center gap-1 text-[11px] font-bold text-[#00897b]">
              <span style={{ fontSize: 22, lineHeight: 1 }}>→</span>
              <span>{daysBetween(first.recordedAt, last.recordedAt)}日</span>
            </div>
            <BeforeAfterCell label={`最新 ${mdLabel(last.recordedAt)}`} photo={last} onOpen={() => openAt(last)} />
          </div>
        </div>
      )}

      {/* すべての写真(新しい順・タップで拡大) */}
      <div className="rounded-[11px] border border-[#e8ebe9] bg-white p-4">
        <div className="mb-3 flex items-center">
          <div className="text-[11px] font-bold text-zinc-500">
            すべての写真（新しい順）
          </div>
          <div className="ml-auto text-[10.5px] text-zinc-400">タップで拡大</div>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {viewable.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLbIndex(i)}
              className="relative aspect-[3/4] cursor-zoom-in overflow-hidden rounded-lg border border-[#e8ebe9] bg-[#eef1ef]"
              aria-label={`${mdLabel(p.recordedAt)} の写真を拡大`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumbUrl ?? (p.fullUrl as string)}
                alt=""
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-3 text-[10.5px] font-bold text-white">
                {mdLabel(p.recordedAt)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ビフォーアフターのセルをタップ → その写真をライトボックスで開く(viewable内のindexへ)
  function openAt(target: AdminBodyPhoto) {
    const idx = viewable.findIndex((p) => p.id === target.id);
    if (idx >= 0) setLbIndex(idx);
  }
}

function BeforeAfterCell({
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
      <div className="mb-1.5 text-center text-[10px] font-bold text-zinc-400">
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
      width={15}
      height={15}
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
