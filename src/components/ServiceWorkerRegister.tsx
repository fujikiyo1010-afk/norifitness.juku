"use client";

import { useEffect } from "react";

/**
 * Service Worker 登録 (2026-06-18 Web Push 基盤)
 *
 * 役割:
 *   - 初回マウント時に /sw.js を登録 (既登録ならスキップ)
 *   - 受講生が /account で 「有効にする」 を押した時に SW があれば即 subscribe へ進める
 *
 * 注意:
 *   - layout.tsx で 1 回だけ描画。 子ページの遷移時は再実行されない (useEffect 1 回)
 *   - 失敗してもアプリ動作には影響しないため silent
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((e) => {
        console.warn("[push] SW register failed", e);
      });
  }, []);
  return null;
}
