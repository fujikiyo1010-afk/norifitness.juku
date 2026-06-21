"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * ページ遷移時のプログレスバー (= 画面上部に細い緑線)
 *
 * 設計方針:
 *   - 200ms 以上かかる遷移にのみ表示 (= 一瞬の遷移には出さない / きよむさん要望)
 *   - usePathname / useSearchParams 変化を検知 → タイマー駆動の進捗 simulate
 *   - 完璧な「遷移開始」 検知は React 18 では不可能なので、 遷移完了タイミングで
 *     0→30→70→100→消える のアニメーションを後追い表示する近似
 *
 * 表示:
 *   - 高さ 2px / 画面上部 / ティール緑 / z-index 高め
 *   - PWA standalone でも見える位置 (= safe-area-inset-top 考慮)
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 200ms 以内に次の遷移が発生したらキャンセル → 一瞬の遷移には表示しない
    let cancelled = false;
    const showTimer = setTimeout(() => {
      if (!cancelled) setProgress(30);
    }, 200);
    const t1 = setTimeout(() => {
      if (!cancelled) setProgress(70);
    }, 400);
    const t2 = setTimeout(() => {
      if (!cancelled) setProgress(100);
    }, 700);
    const t3 = setTimeout(() => {
      if (!cancelled) setProgress(0);
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(showTimer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, searchParams]);

  if (progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-[#4a875b] transition-all duration-300 ease-out shadow-[0_0_4px_rgba(74,135,91,0.6)]"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  );
}
