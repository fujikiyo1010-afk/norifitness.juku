"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 下からふわっとせり上がる ボトムシート (2026-07-06 体組成改修)
 *
 * 体組成の「体重を指定して計算」「記録する」で共通利用。
 * コースの動画のように下からスライドインする。
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  backClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** 体1(ベータ): スマホの「戻る」で閉じる。全体公開時に既定true化→propごと削除。 */
  backClose?: boolean;
}) {
  const [shown, setShown] = useState(false);
  // onClose を ref 経由にして、effect を open の変化だけで動かす(毎レンダーで再push しない)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    let cleanupHistory = () => {};
    // 体1(ベータのみ): スマホの「戻る」でシート/写真ライトボックスを閉じる
    if (backClose) {
      window.history.pushState({ bottomSheet: true }, "");
      pushedRef.current = true;
      const onPop = () => {
        pushedRef.current = false; // 戻るで積んだ履歴は消費済み
        onCloseRef.current();
      };
      window.addEventListener("popstate", onPop);
      cleanupHistory = () => {
        window.removeEventListener("popstate", onPop);
        // UI/保存で閉じた時は、積んだ履歴を1つ戻して後始末(戻るで閉じた時は消費済)
        if (pushedRef.current) {
          pushedRef.current = false;
          window.history.back();
        }
      };
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => {
      cleanupHistory();
      cancelAnimationFrame(id);
      document.body.style.overflow = "";
      setShown(false);
    };
  }, [open, backClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 bg-[#f9f5ed] rounded-t-[22px] px-5 pt-2 pb-8 shadow-[0_-8px_24px_rgba(0,0,0,0.2)] transition-transform duration-300 ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-1 mb-3 h-1 w-10 rounded-full bg-[#cabfa9]" />
        {title ? (
          <h3 className="mb-4 text-center text-[15px] font-bold text-[#004d40]">
            {title}
          </h3>
        ) : null}
        {children}
      </div>
    </div>
  );
}
