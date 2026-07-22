"use client";

import { useState } from "react";
import Link from "next/link";
import { VimeoEmbed } from "@/components/VimeoEmbed";

export type DetailExercise = { name: string; reps: string; videoUrl: string | null };

/** 配布メニュー詳細(モック画面4)。種目(▶動画)＋ポイント＋「このメニューを実施する」→既存記録画面へ。 */
export function WeekMenuDetail({
  day,
  name,
  exercises,
}: {
  day: number;
  name: string;
  exercises: DetailExercise[];
}) {
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed] pb-28">
      <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
        <div className="rounded-2xl border border-[#cfe3d6] bg-gradient-to-br from-[#e8f3ec] to-[#fffbe6] px-3.5 py-3">
          <div className="text-[9.5px] font-extrabold text-[#a5631f]">今日の内容 ・ {exercises.length}種目</div>
          <b className="text-[15px] text-[#2b2620]">{name}</b>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#fffdf8]">
          {exercises.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[#f3eddf] px-3 py-2.5 last:border-b-0"
            >
              {e.videoUrl ? (
                <button
                  type="button"
                  onClick={() => setLightbox({ url: e.videoUrl!, name: e.name })}
                  aria-label="フォーム動画を見る"
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#e8f3ec] text-[#34603f]"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20" /></svg>
                </button>
              ) : (
                <span className="h-[30px] w-[30px] flex-none" aria-hidden />
              )}
              <b className="min-w-0 flex-1 truncate text-[13px] text-[#2b2620]">{e.name}</b>
              <span className="whitespace-nowrap text-[11px] font-bold text-[#6a6256]">{e.reps}</span>
            </div>
          ))}
          {exercises.length === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-[#a59b8c]">この日の種目は設定されていません。</p>
          )}
        </div>

        <div className="rounded-xl border border-[#f0e0a0] bg-[#fffbe6] px-3.5 py-2.5 text-[11.5px] font-bold leading-relaxed text-[#6b5410]">
          ポイント: 無理のない重量で、フォームを意識して丁寧に行いましょう。
        </div>
      </div>

      {/* 下部固定: このメニューを実施する → 既存記録画面(pool保存) */}
      <div
        className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-3 backdrop-blur"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-[460px]">
          <Link
            href={`/workout/week/do?day=${day}`}
            className="btn3d block rounded-xl py-3 text-center text-[14px] font-bold"
          >
            このメニューを実施する
          </Link>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
            <VimeoEmbed url={lightbox.url} />
            <div className="flex items-center justify-between bg-[#111] px-3.5 py-2.5 text-white">
              <span className="text-[13px] font-bold">{lightbox.name}</span>
              <button type="button" onClick={() => setLightbox(null)} className="text-lg text-zinc-400" aria-label="閉じる">✕</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
