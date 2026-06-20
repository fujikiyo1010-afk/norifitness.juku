"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * フォアグラウンド復帰時に router.refresh() を発火する Client Component。
 *
 * 用途:
 *   - Push 通知タップで PWA に戻った瞬間に Server Component を再フェッチ
 *   - バックグラウンドから戻った時のデータ鮮度保証
 *
 * 配置:
 *   - 各 Push 着地先ページ (= /goal-sheet / /workout / /monthly-review 等) の
 *     先頭に <RefreshOnFocus /> として置く
 *   - 描画なし (null 返却) のため、 どこに置いても表示に影響しない
 *
 * 注意:
 *   - router.refresh() は Server Component を再実行するだけ (= Router Cache を更新)
 *   - 入力中のフォームが消えるわけではない (= state は保持される)
 */
export function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    function handleRevisible() {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    }
    // Push クリックや別アプリから戻った時に発火する 2 イベントを併用
    document.addEventListener("visibilitychange", handleRevisible);
    window.addEventListener("focus", handleRevisible);
    return () => {
      document.removeEventListener("visibilitychange", handleRevisible);
      window.removeEventListener("focus", handleRevisible);
    };
  }, [router]);

  return null;
}
