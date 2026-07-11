"use client";

import { useEffect, useState } from "react";

/**
 * Service Worker 登録 (2026-06-18 Web Push 基盤) + 体7 更新バナー
 *
 * 役割:
 *   - 初回マウント時に /sw.js を登録 (既登録ならスキップ)
 *   - 受講生が /account で 「有効にする」 を押した時に SW があれば即 subscribe へ進める
 *   - 体7: 新バージョン検知時に「新しいバージョンがあります」バナー → タップで再読み込み
 *
 * 注意:
 *   - layout.tsx で 1 回だけ描画。 子ページの遷移時は再実行されない (useEffect 1 回)
 *   - 失敗してもアプリ動作には影響しないため silent
 *   - sw.js は install で skipWaiting 済み。更新は「既存 controller がある状態で
 *     新 worker が installed になった時」= 純粋なアップデートのみバナー表示 (初回登録では出さない)
 */
export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;

        // 更新検知: 新 worker が installing → installed になり、かつ既に別 SW が
        // ページを制御している(= 初回ではなくアップデート)場合のみバナーを出す
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch((e) => {
        console.warn("[push] SW register failed", e);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="flex w-full max-w-[460px] items-center gap-3 rounded-xl bg-[#2b2620] px-4 py-3 text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)]">
        <span className="flex-1 text-[12.5px] font-bold leading-snug">
          新しいバージョンがあります
          <span className="block text-[10px] font-medium text-[#cfc8ba]">
            最新の状態に更新できます
          </span>
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex-shrink-0 rounded-full btn3d px-4 py-1.5 text-[12px] font-bold"
        >
          更新する
        </button>
      </div>
    </div>
  );
}
