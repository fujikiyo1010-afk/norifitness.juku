"use client";

import { useEffect, useState } from "react";

/**
 * 件1(2026-07-13): 食事写真のライトボックス(トレクラ手本)。
 * 黒半透明の背景・中央に原寸表示・複数枚は左右送り＋「1/N」・外側タップ/✕で閉じる。
 * 既存のVimeoライトボックスと同じ器(黒背景オーバーレイ・外側クリックで閉じる)を踏襲。
 *
 * 呼び出し側は open({ photos, index }) で state を持ち、null で閉じる。
 */
export function PhotoLightbox({
  photos,
  startIndex = 0,
  onClose,
}: {
  photos: string[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const n = photos.length;

  // Escape / 左右キーで操作(管理画面=PC前提)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((v) => (v + 1) % n);
      else if (e.key === "ArrowLeft") setI((v) => (v - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, onClose]);

  if (n === 0) return null;
  const prev = () => setI((v) => (v - 1 + n) % n);
  const next = () => setI((v) => (v + 1) % n);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      {/* ✕ 右上 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60"
      >
        ✕
      </button>

      {/* 左送り */}
      {n > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="前の写真"
          className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-3xl text-white hover:bg-black/60"
        >
          ‹
        </button>
      )}

      {/* 画像(中央・原寸)。画像自体のクリックは閉じない(外側=背景で閉じる) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[i]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />

      {/* 右送り */}
      {n > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="次の写真"
          className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-3xl text-white hover:bg-black/60"
        >
          ›
        </button>
      )}

      {/* 1/N */}
      {n > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[13px] font-bold text-white">
          {i + 1}/{n}
        </div>
      )}
    </div>
  );
}
