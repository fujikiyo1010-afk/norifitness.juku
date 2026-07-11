"use client";

import { useEffect } from "react";

/**
 * 新3a: 完了演出バナーを一度表示したら URL から ?done=1 を消す。
 * これでリロードや深夜0時またぎでバナーが残り続け「連続完了」に見える不具合を防ぐ。
 * history.replaceState を使い、Next のナビゲーション(再マウント)は起こさない。
 */
export function StripDoneQuery() {
  useEffect(() => {
    if (window.location.search.includes("done=1")) {
      window.history.replaceState(null, "", "/workout/today");
    }
  }, []);
  return null;
}
