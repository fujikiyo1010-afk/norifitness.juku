"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 体4: タブ/アプリを長時間離れて復帰した時に、サーバーコンポーネントを再取得する。
 *
 * 体組成・写真ギャラリーの画像は Supabase の署名付きURL(有効期限1時間)で表示している。
 * タブを1時間以上開きっぱなしで放置→復帰すると URL が切れて画像が全滅するため、
 * visibilitychange の「復帰」で router.refresh() し、署名URLを取り直す。
 * 毎回だと無駄なので、隠れていた時間が閾値(既定50分=期限切れ前)を超えた時だけ更新。
 */
export function useRefreshOnReturn(thresholdMs = 50 * 60 * 1000): void {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt >= thresholdMs) {
        hiddenAt = 0;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, [router, thresholdMs]);
}
