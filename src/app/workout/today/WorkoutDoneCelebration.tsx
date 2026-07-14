"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * T3(2026-07-12): トレ完了 祝福専用画面。
 * モック: 08_guide/提案_受講生_トレ完了_祝福画面.html（確定=案2: ふわっと登場＋花吹雪・ルール21転写）
 *
 * 「✓今日のトレ完了」「✓内容を上書き保存」を押した直後(?done=1)だけ表示する行き止まりの祝福。
 * 編集UI/上書きバー/種目リスト/下部ナビは出さない（帰り道は緑の「ホームに戻る」）。
 * - アニメは mount時1回だけ（?done=1 の時しか描画されず、mount時に URL から ?done=1 を消すので
 *   リロード/再訪では出ない）。prefers-reduced-motion で無効化。
 * - 花吹雪は client でのみ生成（SSRしない＝hydration不一致を避ける）・pointer-events:none。
 * - ライブラリ追加なし（CSSのみ・keyframes は wkdone- で名前空間化）。
 */
export function WorkoutDoneCelebration({
  streakDays,
  doneCount,
  nextLabel,
  fullScreen = false,
}: {
  streakDays: number;
  doneCount: number;
  nextLabel: string | null;
  // 2026-07-14: ヘッダー無しのフルスクリーン表示(preview)。true の時は内容を縦中央に置いて上ズレを解消。
  fullScreen?: boolean;
}) {
  const router = useRouter();
  // 2026-07-13: この行き止まり画面が出ている間だけ下部ナビを隠す(記録中/開始前は出す)。
  //   URLの?done=1では区別しづらいので、画面のマウント/アンマウントに紐づける(戻れば即ナビ復帰)。
  useEffect(() => {
    document.documentElement.setAttribute("data-hide-membernav", "1");
    return () => document.documentElement.removeAttribute("data-hide-membernav");
  }, []);
  // 花吹雪(18枚・筋肉塾トーン3色+白)は client でのみ生成(SSR差異=hydration不一致を避ける)
  const [confetti, setConfetti] = useState<
    { left: string; bg: string; delay: string; w: string; h: string }[]
  >([]);
  useEffect(() => {
    // 完了直後に ?done=1 を URL から消す(リロード/深夜0時またぎで祝福が残らない)
    if (window.location.search.includes("done=1")) {
      window.history.replaceState(null, "", "/workout/today");
    }
    const colors = ["#4a875b", "#c9a227", "#c2693f", "#fffdf8"];
    const pieces = Array.from({ length: 18 }, (_, i) => ({
      left: `${4 + Math.random() * 92}%`,
      bg: colors[i % colors.length],
      delay: `${Math.random() * 0.7}s`,
      w: `${6 + Math.random() * 5}px`,
      h: `${9 + Math.random() * 6}px`,
    }));
    // rAF 後に反映(effect 本体での同期 setState を避ける・mount時1回)
    const id = requestAnimationFrame(() => setConfetti(pieces));
    return () => cancelAnimationFrame(id);
  }, []);

  const fillPct = `${Math.max(0, Math.min(1, doneCount / 3)) * 100}%`;

  return (
    <main
      className={`wkdone playing relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] ${
        fullScreen ? "flex flex-col justify-center" : ""
      }`}
      style={fullScreen ? { paddingTop: "env(safe-area-inset-top)" } : undefined}
    >
      {/* 花吹雪(装飾・操作を妨げない) */}
      <div className="confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {confetti.map((c, i) => (
          <i
            key={i}
            style={{ left: c.left, background: c.bg, animationDelay: c.delay, width: c.w, height: c.h }}
          />
        ))}
      </div>

      <div className="relative z-[2] mx-auto flex max-w-[420px] flex-col items-center px-6 pb-10 pt-8">
        {/* のりキャラ 140px 円形(scale1.2で黒円を枠外へ) */}
        <div className="chara fx d1 mb-5 h-[140px] w-[140px] overflow-hidden rounded-full bg-[#fffdf8] shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/nori-character.png"
            alt="のりキャラクター"
            className="h-full w-full scale-[1.2] object-cover"
          />
        </div>

        {/* ✓ 緑円 48px */}
        <div className="ck fx d2 mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-[#4a875b]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="fx d3 text-center text-[20px] font-bold text-[#2b2620]">
          今日のトレ、完了です！
        </h1>
        <p className="fx d4 mt-2 text-center text-[13px] leading-[1.7] text-[#52525b]">
          おつかれさまでした。
          <br />
          この記録はのりも見て、声かけに活かします。
        </p>

        {/* 継続◯日(炎SVG) */}
        {streakDays > 0 && (
          <span className="streak fx d5 mt-3.5 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#ebc9a6] bg-[#fbf2dd] px-3.5 py-[5px] text-[12px] font-extrabold text-[#a5631f]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a5631f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            継続 {streakDays} 日
          </span>
        )}

        {/* 今日の達成 x/3 バー(最後に伸びる) */}
        <div className="prog fx d6 mx-auto mt-4 flex w-full max-w-[260px] items-center gap-2">
          <b className="font-mono text-[13px] text-[#34603f]">{doneCount}/3</b>
          <span className="bar h-[7px] flex-1 overflow-hidden rounded-full bg-[#d8e6dc]">
            <i style={{ ["--fill" as string]: fillPct }} />
          </span>
          <small className="text-[10px] font-bold text-[#6a6256]">今日の達成</small>
        </div>

        {/* 次のトレーニング */}
        {nextLabel && (
          <div className="next fx d7 mt-5 flex w-full items-center justify-between rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-[15px] py-3.5">
            <span className="text-[11px] text-[#52525b]">次のトレーニング</span>
            <b className="text-[12.5px] font-extrabold text-[#2b2620]">{nextLabel}</b>
          </div>
        )}

        {/* ボタン群(副=白枠 / 主=緑 立体) */}
        <div className="btns fx d8 mt-[22px] flex w-full flex-col gap-[11px]">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="block w-full rounded-md border border-[#d4d4d8] bg-[#fffdf8] py-3 text-center text-[13px] font-semibold text-[#3f3f46]"
          >
            今日の記録を見る
          </button>
          <Link
            href="/"
            className="home block w-full rounded-[10px] py-[13px] text-center text-[13.5px] font-extrabold text-white"
          >
            ホームに戻る
          </Link>
        </div>
        <Link
          href="/workout/history"
          className="fx d8 mt-3.5 text-[12px] font-extrabold text-[#34603f]"
        >
          これまでの履歴を見る →
        </Link>
      </div>

      {/* モックCSS転写(keyframes は wkdone- で名前空間化・ライブラリ非依存) */}
      <style>{`
        .wkdone .fx{opacity:0;transform:translateY(14px);animation:wkdone-rise .55s ease-out forwards;}
        .wkdone .chara.fx{transform:translateY(14px) scale(.92);animation:wkdone-riseChara .6s ease-out forwards;}
        @keyframes wkdone-rise{to{opacity:1;transform:translateY(0);}}
        @keyframes wkdone-riseChara{to{opacity:1;transform:translateY(0) scale(1);}}
        .wkdone .d1{animation-delay:.05s}.wkdone .d2{animation-delay:.17s}.wkdone .d3{animation-delay:.29s}
        .wkdone .d4{animation-delay:.41s}.wkdone .d5{animation-delay:.53s}.wkdone .d6{animation-delay:.65s}
        .wkdone .d7{animation-delay:.77s}.wkdone .d8{animation-delay:.89s}
        .wkdone .prog .bar i{display:block;height:100%;width:0;background:#4a875b;border-radius:99px;animation:wkdone-fill .9s ease-out .8s forwards;}
        @keyframes wkdone-fill{to{width:var(--fill);}}
        .wkdone .home{background:linear-gradient(180deg,#54946a,#4a875b 45%,#34603f);box-shadow:0 5px 0 #274c31, 0 9px 18px rgba(52,96,63,.30);}
        .wkdone .home:active{transform:translateY(4px);box-shadow:0 1px 0 #274c31, 0 4px 10px rgba(52,96,63,.25);}
        .wkdone .confetti i{position:absolute;top:-12px;border-radius:2px;opacity:0;animation:wkdone-drop 2.3s ease-in forwards;}
        @keyframes wkdone-drop{
          0%{opacity:0;transform:translateY(0) rotate(0deg);}
          8%{opacity:1;}
          100%{opacity:0;transform:translateY(560px) rotate(540deg);}
        }
        @media (prefers-reduced-motion: reduce){
          .wkdone .fx{opacity:1 !important;transform:none !important;animation:none !important;}
          .wkdone .chara.fx{transform:none !important;}
          .wkdone .prog .bar i{animation:none !important;width:var(--fill) !important;}
          .wkdone .confetti{display:none !important;}
        }
      `}</style>
    </main>
  );
}
