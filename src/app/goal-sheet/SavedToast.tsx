"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 目標管理シート 閲覧モードで「保存しました」 トーストを表示する。
 *
 * 編集モードの handleSave (本保存) で sessionStorage に "goal-sheet-just-saved" を
 * 書き、 閲覧モードのこのコンポーネントが マウント時に読んで トースト表示 + 削除。
 *
 * 設計:
 *   - フェードイン 0.3s → 3 秒間表示 → フェードアウト 0.3s (= きよむさん指定の「ふわっと」)
 *   - 表示位置 = 画面上部 fixed
 *   - React StrictMode 二重実行対策 = useRef でガード
 */
export function SavedToast() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      if (sessionStorage.getItem("goal-sheet-just-saved") === "1") {
        sessionStorage.removeItem("goal-sheet-just-saved");
        setMounted(true);
        // 次フレームで visible=true に切り替え → opacity transition でフェードイン
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
        // 3 秒後にフェードアウト → 0.3s 後に DOM から削除
        // 注: cleanup で clearTimeout しない。 React StrictMode の useEffect 二重
        //     実行で cleanup が走るとタイマーが消えて トーストが永久表示になるため。
        //     1 回限りのトーストなのでメモリリーク影響なし。
        setTimeout(() => setVisible(false), 3000);
        setTimeout(() => setMounted(false), 3300);
      }
    } catch {}
  }, []);

  if (!mounted) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-zinc-900 text-white rounded-lg shadow-lg text-xs font-bold whitespace-nowrap transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="text-[#7ad6c8] mr-1">✓</span>
      保存しました
    </div>
  );
}
