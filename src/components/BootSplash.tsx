"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 起動スプラッシュ (= アプリ起動 / リロード時のブランド待機画面)
 *
 * 設計:
 *   - root layout に常設。SSR で初期 HTML に含まれるため、ページの中身が
 *     描画される前から全面表示される (= OS の起動画面から チラつきなく連続)。
 *   - マウント後 約1.4秒 表示 → フェード → DOM から除去。
 *   - 「起動 / リロード = 初回描画」 のときだけ出る。アプリ内のページ遷移
 *     (= クライアントナビ) では再表示しない (visible が既に false のため)。
 *   - 管理画面 (/admin) は デスクトップ運用なので 出さない。
 *
 * スタイルは globals.css の .boot-splash 系を使用。
 */

const DISPLAY_MS = 1400; // 表示時間 (アニメ 1.0s + 余韻)
const FADE_MS = 450; // globals.css の transition と一致

export function BootSplash() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  // 起動/リロードのみ対象 = 初期マウント時に true。SSR と一致させるため初期値 true。
  const [mounted, setMounted] = useState(true);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      setMounted(false);
      return;
    }
    const hideTimer = setTimeout(() => setHiding(true), DISPLAY_MS);
    const removeTimer = setTimeout(() => setMounted(false), DISPLAY_MS + FADE_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
    // 初回マウント時のみ実行 (= 起動/リロード)。以後のナビでは再発火させない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 管理画面では SSR 段階から描画しない
  if (isAdmin || !mounted) return null;

  return (
    <div className={`boot-splash${hiding ? " boot-hide" : ""}`} aria-hidden="true">
      <div className="boot-char">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/nori-character.png" alt="" />
      </div>
      <div className="boot-logo">筋肉塾</div>
      <div className="boot-tag">NORIFITNESS</div>
      <div className="boot-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
