"use client";

import { useEffect, useRef, useState } from "react";

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

  // ===== 対策C: 凍結復元PWAの鮮度チェック (2026-09-04) =====
  // iOSはPWAを前夜から開きっぱなしにすると画面ごと凍結保存し、翌朝そのまま復元する。
  // 凍結中にデプロイが挟まると、古い画面の保存ボタンが接続先を失い黙って失敗する
  // (実例: 朝6:30-7:30の体重記録が消える/過去日に入る)。
  // → 復帰の瞬間に /api/version と自分の版を突き合わせ、古ければ読み込み直す。
  //
  // 安全弁(入力を壊さない):
  //   - シートやモーダルが開いている(= body の overflow が hidden) → 自動リロードせずバナー提示
  //   - 入力欄にフォーカス中 → 同上
  //   - 管理画面(/admin)は下書き作業が長いので常にバナー提示のみ(自動リロードしない)
  //   - 短い離脱(60秒未満)では確認そのものをしない(アプリ切替の度に走らせない)
  const baseVersionRef = useRef<string | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchVersion = async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return null;
        const j = (await res.json()) as { v?: string | null };
        return j.v ?? null;
      } catch {
        return null; // オフライン等は静かに諦める(次の復帰で再試行)
      }
    };

    // 基準版: マウント直後の本番版を「この画面の版」とみなす
    void fetchVersion().then((v) => {
      if (baseVersionRef.current === null) baseVersionRef.current = v;
    });

    const MIN_HIDDEN_MS = 60_000;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      // ここから「復帰」
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt === null || Date.now() - hiddenAt < MIN_HIDDEN_MS) return;
      if (checkingRef.current) return;
      checkingRef.current = true;
      void fetchVersion()
        .then((now) => {
          const base = baseVersionRef.current;
          if (!now || !base || now === base) return; // 最新 or 判定不能 → 何もしない
          // 版が違う = 凍結中にデプロイがあった
          const sheetOpen = document.body.style.overflow === "hidden";
          const tag = document.activeElement?.tagName ?? "";
          const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
          const isAdmin = window.location.pathname.startsWith("/admin");
          if (sheetOpen || typing || isAdmin) {
            setUpdateAvailable(true); // 自動リロードは危険 → バナーで本人に委ねる
            return;
          }
          window.location.reload();
        })
        .finally(() => {
          checkingRef.current = false;
        });
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

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
