"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * PWAInstallBanner: 受講生に「ホーム画面に追加して使ってね」を案内するバナー。
 *
 * 表示ロジック (パターン A + E、2026-05-27 きよむさん合意):
 *   - パターン E: 既に PWA としてホーム画面から起動済みなら絶対に出さない
 *     → window.matchMedia('(display-mode: standalone)').matches === true で判定
 *   - パターン A: 一度「閉じる」を押したら永久に出さない
 *     → localStorage の "pwa_banner_dismissed" フラグで判定
 *   - 管理画面 (/admin/*) では出さない (管理者は PC でブラウザ使う前提)
 *
 * 表示位置: 画面下部のフローティング (邪魔にならないサイズ)
 *
 * 「使い方を見る」ボタン → モーダルで iOS / Android の手順を表示
 */

const LS_KEY = "pwa_banner_dismissed";

export function PWAInstallBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // 管理画面では表示しない
    if (pathname.startsWith("/admin")) return;

    // 既に PWA としてホーム画面から起動済みなら表示しない (パターン E)
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      return;
    }
    // iOS Safari の standalone (古い iOS 用判定)
    if (
      typeof window !== "undefined" &&
      // @ts-expect-error iOS Safari 専用プロパティ
      window.navigator.standalone === true
    ) {
      return;
    }

    // 過去に閉じてれば表示しない (パターン A)
    if (typeof window !== "undefined" && localStorage.getItem(LS_KEY)) {
      return;
    }

    // 表示
    setVisible(true);
  }, [pathname]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, new Date().toISOString());
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* バナー本体 */}
      <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-md bg-white border border-[#e8ebe9] rounded-xl shadow-lg p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#00897b] text-white flex items-center justify-center flex-shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-zinc-900 mb-0.5">
            ホーム画面に追加すると快適
          </div>
          <div className="text-[11px] text-zinc-600">
            タップ 1 回で起動できるようになります
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setShowGuide(true)}
            className="text-[11px] px-3 py-1.5 bg-[#00897b] text-white rounded-md hover:bg-[#00695c] transition-colors whitespace-nowrap"
          >
            使い方を見る
          </button>
          <button
            onClick={handleDismiss}
            className="text-[11px] px-3 py-1 text-zinc-500 hover:text-zinc-700"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* ガイドモーダル */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#e8ebe9] flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-base font-bold text-zinc-900">
                ホーム画面に追加する方法
              </h2>
              <button
                onClick={() => setShowGuide(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* iPhone (Safari) */}
              <section>
                <h3 className="text-sm font-bold text-[#004d40] mb-2 flex items-center gap-1.5">
                  <span className="w-1 h-4 bg-[#00897b] rounded-full" />
                  iPhone (Safari) の場合
                </h3>
                <ol className="text-xs text-zinc-700 space-y-2 leading-relaxed pl-1">
                  <li>
                    <b>1.</b> Safari でこのページを開いた状態で、画面下中央の
                    <span className="inline-block mx-1 px-1.5 py-0.5 bg-[#f8f9fa] border border-[#e8ebe9] rounded">
                      共有ボタン (□↑)
                    </span>
                    をタップ
                  </li>
                  <li>
                    <b>2.</b> 出てきたメニューを下にスクロールして
                    <span className="inline-block mx-1 px-1.5 py-0.5 bg-[#f8f9fa] border border-[#e8ebe9] rounded">
                      ホーム画面に追加
                    </span>
                    を選ぶ
                  </li>
                  <li>
                    <b>3.</b> 右上の <b>追加</b> をタップ
                  </li>
                  <li>
                    <b>4.</b> ホーム画面に「筋肉塾」アイコンが追加されています
                  </li>
                </ol>
              </section>

              {/* Android (Chrome) */}
              <section>
                <h3 className="text-sm font-bold text-[#004d40] mb-2 flex items-center gap-1.5">
                  <span className="w-1 h-4 bg-[#00897b] rounded-full" />
                  Android (Chrome) の場合
                </h3>
                <ol className="text-xs text-zinc-700 space-y-2 leading-relaxed pl-1">
                  <li>
                    <b>1.</b> Chrome でこのページを開いた状態で、画面右上の
                    <span className="inline-block mx-1 px-1.5 py-0.5 bg-[#f8f9fa] border border-[#e8ebe9] rounded">
                      ︙ (メニュー)
                    </span>
                    をタップ
                  </li>
                  <li>
                    <b>2.</b> メニューから
                    <span className="inline-block mx-1 px-1.5 py-0.5 bg-[#f8f9fa] border border-[#e8ebe9] rounded">
                      ホーム画面に追加 / アプリをインストール
                    </span>
                    を選ぶ
                  </li>
                  <li>
                    <b>3.</b> 確認ダイアログで <b>追加 / インストール</b> をタップ
                  </li>
                  <li>
                    <b>4.</b> ホーム画面に「筋肉塾」アイコンが追加されています
                  </li>
                </ol>
              </section>

              {/* PC (補足) */}
              <section className="bg-[#f8f9fa] rounded-lg px-3 py-2.5">
                <div className="text-[11px] text-zinc-600 leading-relaxed">
                  <b>PC の場合:</b> Chrome / Edge ならアドレスバー右端の「インストール」アイコンから追加できます。普段スマホで使う前提なので、まずはスマホで追加してみてください。
                </div>
              </section>
            </div>

            <div className="px-5 py-4 border-t border-[#e8ebe9] flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  handleDismiss();
                  setShowGuide(false);
                }}
                className="text-xs px-4 py-2 bg-[#00897b] text-white rounded-md hover:bg-[#00695c]"
              >
                わかった、もう表示しない
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
