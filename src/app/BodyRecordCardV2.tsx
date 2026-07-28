"use client";

import { useState } from "react";
import Link from "next/link";
import type { BodyCard } from "@/lib/member/body-card";
import { BottomSheet } from "@/app/record/BottomSheet";
import { RecordSheetBody } from "@/app/record/RecordSheetBody";

/**
 * ホーム身体カード リッチ版(newHomeCard・4人先行) — 案C(緑フチ取り)+縦詰め。
 *  - 押せるのは下の2ボタンのみ。上の4チップは表示だけ(非活性)。
 *  - 上ボタン=その場で記録シートがせり上がる(/record の＋ボタンと同じ挙動・案A)。
 *  - 下「グラフを見る」=体組成ページ /record へ。
 *  - 数字(体重/ウエスト)のサイズは維持。周り・チップ・ボタンを縦に詰める。
 */
export function BodyRecordCardV2({ bodyCard }: { bodyCard: BodyCard }) {
  const [recordOpen, setRecordOpen] = useState(false);
  const recordedToday = bodyCard.daysSinceLatest === 0;
  const weight = bodyCard.currentWeight != null ? bodyCard.currentWeight.toFixed(1) : "—";
  const waist = bodyCard.currentWaist != null ? bodyCard.currentWaist.toFixed(1) : "—";

  const chips = [
    { label: "体重", icon: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 9l3-2 3 2" /></> },
    { label: "体脂肪", icon: <path d="M6 12a6 6 0 1 0 12 0c0-4-6-9-6-9S6 8 6 12z" /> },
    { label: "ウエスト", icon: <><path d="M3 12h18" /><path d="M6 9l-2 3 2 3" /><path d="M18 9l2 3-2 3" /></> },
    { label: "写真", icon: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></> },
  ];

  return (
    <div className="overflow-hidden rounded-[16px] border-2 border-[#4a875b] bg-[#fffdf8]">
      {/* 緑ヘッダー帯 */}
      <div
        className="flex items-start justify-between gap-2 px-[14px] py-[9px]"
        style={{ background: "linear-gradient(135deg,#3c7a54,#2f5a3c)" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="flex h-[29px] w-[29px] flex-none items-center justify-center rounded-[9px] bg-white/15 text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="4" /><circle cx="12" cy="10" r="2.4" /><path d="M12 12.4V15" /></svg>
          </span>
          <div>
            <div className="text-[14px] font-extrabold leading-tight text-white">今日の身体記録</div>
            <div className="mt-0.5 text-[9.5px] text-[#cfe6d6]">毎日の記録が、理想の自分への一歩です</div>
          </div>
        </div>
        <span className="flex flex-none items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#cfe3d5]" />
          {recordedToday ? "本日記録済み" : "本日未記録"}
        </span>
      </div>

      {/* 2大数字(体重=黒 / ウエスト=緑) — サイズ維持・上下だけ詰める */}
      <div className="flex px-[15px] pb-[9px] pt-[11px]">
        <div className="relative flex-1 text-center">
          <div className="text-[11px] font-bold text-[#6a6256]">体重</div>
          <div className="mt-0.5 text-[32px] font-black leading-none tracking-[-0.5px] text-[#111]">
            {weight}
            <span className="ml-0.5 text-[12px] font-extrabold text-[#8a8172]">kg</span>
          </div>
        </div>
        <div className="relative flex-1 text-center before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-px before:bg-[#eee3d0]">
          <div className="text-[11px] font-bold text-[#6a6256]">ウエスト</div>
          <div className="mt-0.5 text-[32px] font-black leading-none tracking-[-0.5px] text-[#34603f]">
            {waist}
            <span className="ml-0.5 text-[12px] font-extrabold text-[#4d7a5c]">cm</span>
          </div>
        </div>
      </div>

      {/* チップ4つ(表示だけ・非活性) — 約2割 縦短く */}
      <div className="flex gap-[7px] px-[13px] pb-[10px]">
        {chips.map((c) => (
          <div
            key={c.label}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-[10px] border border-[#e3d9c6] bg-[#fffef9] px-0.5 py-[5px]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a875b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
            <span className="text-[10px] font-extrabold text-[#5b5344]">{c.label}</span>
          </div>
        ))}
      </div>

      {/* ボタン2つ */}
      <div className="flex flex-col gap-[7px] px-[13px] pb-3">
        {/* 上=記録シートをその場でせり上げ(案A・＋ボタンと同じ) — 約1割 縦短く */}
        <button
          type="button"
          onClick={() => setRecordOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-[12px] py-[11.5px] text-[14px] font-extrabold text-white"
          style={{
            background: "linear-gradient(180deg,#529367,#4a875b 55%,#3f7350)",
            boxShadow: "0 2px 0 #2f5a3c,0 5px 11px rgba(52,96,63,0.22)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          今日の体重・サイズを記録
        </button>
        {/* 下=体組成ページ(グラフ) — 約2割 縦短く */}
        <Link
          href="/record"
          className="flex items-center justify-center gap-1.5 rounded-[12px] border border-[#dbe8df] bg-white py-[8.5px] text-[12.5px] font-extrabold text-[#4a875b]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M7 14l3-3 3 3 4-5" /></svg>
          グラフを見る
        </Link>
      </div>

      {/* 記録入力シート(/record の＋ボタンと同じ。保存で router.refresh → 数字更新) */}
      <BottomSheet open={recordOpen} onClose={() => setRecordOpen(false)} title="今日の記録">
        <RecordSheetBody
          initialWeight={bodyCard.currentWeight}
          initialBodyFat={bodyCard.currentBodyFat}
          initialWaist={bodyCard.currentWaist}
          onSaved={() => setRecordOpen(false)}
        />
      </BottomSheet>
    </div>
  );
}
