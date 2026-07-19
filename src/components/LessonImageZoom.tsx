"use client";

import { useState } from "react";

/**
 * レッスン画像の「タップで拡大」ライトボックス (2026-07-19)。
 *
 * アプリは viewport maximumScale:1 でブラウザのピンチ拡大を無効化しているため、
 * 拡大は自前で行う: タップ → フルスクリーン表示 → 画像タップで 2倍トグル(スクロール可)。
 * 保存は端末標準の「長押し → 写真に保存」を案内する(明示ボタンは置かない=保存A)。
 *
 * サムネ(inline)は親から thumbClassName で見た目を受け取る。
 */
export function LessonImageZoom({
  src,
  thumbClassName,
}: {
  src: string;
  thumbClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const close = () => {
    setOpen(false);
    setZoomed(false);
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        onClick={() => setOpen(true)}
        role="button"
        aria-label="画像を拡大"
        className={`${thumbClassName ?? ""} cursor-zoom-in`}
      />

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={close}
            aria-label="閉じる"
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white"
          >
            ×
          </button>

          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              onClick={() => setZoomed((z) => !z)}
              className={`origin-center object-contain transition-transform duration-200 ${
                zoomed
                  ? "scale-[2] cursor-zoom-out"
                  : "max-h-full max-w-full cursor-zoom-in"
              }`}
            />
          </div>

          <div
            className="pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2 text-center text-xs text-white/80"
            onClick={(e) => e.stopPropagation()}
          >
            長押しで写真に保存できます ・ タップで拡大
          </div>
        </div>
      )}
    </>
  );
}
