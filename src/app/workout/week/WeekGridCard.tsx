"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { previewDistAction, logDetailAction } from "@/lib/workout/pool-actions";
import type { DistPreview, LogDetail } from "@/lib/workout/pool-detail";
import type { WeekCell } from "@/lib/workout/weekly";

const DOW = ["月", "火", "水", "木", "金", "土", "日"];

type Tap = { t: "dist"; day: number } | { t: "log"; logId: string } | { t: "rest" } | null;

/**
 * 今週の表(§2-1・案A=罫線格子＋部位略称)＋下見モーダル(§2-2・中央)。
 * 色は状態のみ。全マスタップ可。実施/先週マスはタップで実施記録、おすすめ順は配布内容。
 */
export function WeekGridCard({
  recRow,
  thisRow,
  lastRow,
  remaining,
}: {
  recRow: WeekCell[];
  thisRow: WeekCell[];
  lastRow: WeekCell[];
  remaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dist, setDist] = useState<DistPreview | null>(null);
  const [log, setLog] = useState<LogDetail | null>(null);
  const [restModal, setRestModal] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  function tapOf(cell: WeekCell, row: "rec" | "this" | "last"): Tap {
    if (cell.kind === "empty") return null;
    if (row === "rec") return cell.kind === "rest" ? { t: "rest" } : cell.kind === "dist" ? { t: "dist", day: cell.day } : null;
    // this/last: 記録マス
    if ("logId" in cell && cell.logId) return { t: "log", logId: cell.logId };
    return null;
  }

  async function onTap(tap: Tap) {
    if (!tap) return;
    setDist(null);
    setLog(null);
    setRestModal(false);
    setOpen(true);
    if (tap.t === "rest") {
      setRestModal(true);
      return;
    }
    setLoading(true);
    try {
      if (tap.t === "dist") setDist(await previewDistAction(tap.day));
      else setLog(await logDetailAction(tap.logId));
    } catch (e) {
      console.warn("[grid modal] load failed", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-3 py-3">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <th className="w-[46px] border border-[#e0d9c8] bg-[#f5f1e6] px-1 py-1.5 text-[9px] font-extrabold text-[#a59b8c]" />
            {DOW.map((d) => (
              <th key={d} className="border border-[#e0d9c8] bg-[#f5f1e6] px-1 py-1.5 text-[9.5px] font-extrabold text-[#a59b8c]">
                {d}
              </th>
            ))}
          </tr>
          <GridRow label="のりのおすすめ順" cells={recRow} row="rec" onTap={onTap} tapOf={tapOf} />
          <GridRow label="今週の実施" cells={thisRow} row="this" onTap={onTap} tapOf={tapOf} />
          <GridRow label="先週" cells={lastRow} row="last" onTap={onTap} tapOf={tapOf} />
        </tbody>
      </table>
      <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-bold text-[#a59b8c]">
        <span>マスを押すと中身が見られます</span>
        <b className="text-[10.5px] text-[#34603f]">今週の残り {remaining} メニュー</b>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[360px] rounded-2xl bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,.35)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="absolute right-3 top-3 flex items-center justify-center rounded-full bg-[#f0ead9] text-[13px] font-extrabold text-[#6f6a5b]"
              style={{ height: 26, width: 26 }}
            >
              ×
            </button>

            {loading && <p className="py-8 text-center text-[12px] text-[#a59b8c]">読み込み中…</p>}

            {!loading && restModal && (
              <div>
                <div className="text-[10px] font-extrabold text-[#a5631f]">今日の内容</div>
                <h2 className="mb-2 mt-1 text-[16px] font-bold text-[#2b2620]">休養日・ストレッチ</h2>
                <p className="mb-3 text-[11.5px] leading-relaxed text-[#7a6a35]">疲労回復も大事なトレーニングです。</p>
                <button
                  type="button"
                  onClick={() => router.push("/workout/week/confirm?rest=1")}
                  className="w-full rounded-xl py-3 text-center text-[13px] font-bold text-white"
                  style={{ background: "#b6a35c" }}
                >
                  今日は休養日にする
                </button>
              </div>
            )}

            {!loading && dist && (
              <div>
                <div className="text-[10px] font-extrabold text-[#b98a4d]">のりの配布メニュー</div>
                <h2 className="mb-2 mt-1 text-[17px] font-bold text-[#2b2620]">{dist.name}</h2>
                <div className="mb-2 flex flex-col">
                  {dist.exercises.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 border-b border-[#f0ead9] py-1.5 last:border-b-0 text-[12.5px]">
                      {e.videoUrl ? (
                        <button type="button" onClick={() => setLightbox({ url: e.videoUrl!, name: e.name })} aria-label="動画" className="text-[#a59b8c]">
                          ▶
                        </button>
                      ) : (
                        <span className="text-[#d8cdba]">・</span>
                      )}
                      <b className="text-[#2b2620]">{cleanExerciseName(e.name)}</b>
                      <span className="ml-auto font-bold text-[#6a6256]">{e.reps}</span>
                    </div>
                  ))}
                </div>
                <div className="mb-3 rounded-lg border border-[#ecdfb4] bg-[#fbf6e2] px-3 py-2 text-[11px] leading-relaxed text-[#7a6a35]">
                  ポイント: 無理のない重量で、フォームを意識して丁寧に行いましょう。
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/workout/week/edit?day=${dist.day}&from=main`)}
                  className="btn3d w-full rounded-xl py-3 text-center text-[13px] font-bold"
                >
                  このメニューをやる
                </button>
              </div>
            )}

            {!loading && log && (
              <div>
                <div className="text-[10px] font-extrabold text-[#6a6256]">
                  {log.isCustom ? "じぶんメニューの記録" : log.isRest ? "記録" : "実施記録"}・{mdOf(log.date)}
                </div>
                <h2 className="mb-2 mt-1 text-[16px] font-bold text-[#2b2620]">{log.menuName}</h2>
                {log.isRest ? (
                  <p className="mb-3 text-[12px] text-[#7a6a35]">この日は休養日にしました。</p>
                ) : (
                  <div className="mb-3 flex flex-col">
                    {log.exercises.map((ex, i) => (
                      <div key={i} className="border-b border-[#f0ead9] py-1.5 last:border-b-0">
                        <b className={`text-[12.5px] ${ex.source === "added" ? "text-[#5b3fd6]" : "text-[#2b2620]"}`}>
                          {cleanExerciseName(ex.name)}
                          {ex.source === "added" && <span className="ml-1 text-[9px] font-extrabold text-[#5b3fd6]">追加</span>}
                        </b>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[#6a6256]">
                          {ex.sets.map((s, si) => (
                            <span key={si} className={s.arranged ? "font-extrabold text-[#5b3fd6]" : "font-bold"}>
                              {s.kg != null ? `${s.kg}kg×` : ""}
                              {s.reps != null ? `${s.reps}回` : "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!log.isRest && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        log.isToday
                          ? `/workout/week/edit?edit=${log.logId}&from=main`
                          : `/workout/week/edit?last=${log.logId}&from=main`
                      )
                    }
                    className="btn3d w-full rounded-xl py-3 text-center text-[13px] font-bold"
                  >
                    {log.isToday ? "内容を修正する" : "もう一度やる"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
            <VimeoEmbed url={lightbox.url} />
            <div className="flex items-center justify-between bg-[#111] px-3.5 py-2.5 text-white">
              <span className="text-[13px] font-bold">{cleanExerciseName(lightbox.name)}</span>
              <button type="button" onClick={() => setLightbox(null)} className="text-lg text-zinc-400" aria-label="閉じる">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mdOf(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function GridRow({
  label,
  cells,
  row,
  onTap,
  tapOf,
}: {
  label: string;
  cells: WeekCell[];
  row: "rec" | "this" | "last";
  onTap: (t: Tap) => void;
  tapOf: (c: WeekCell, r: "rec" | "this" | "last") => Tap;
}) {
  return (
    <tr>
      <td className="border border-[#e0d9c8] bg-[#f5f1e6] px-1 py-1 text-[9px] font-extrabold leading-tight text-[#a59b8c]">
        {label}
      </td>
      {cells.map((c, i) => {
        const tap = tapOf(c, row);
        return (
          <td key={i} className="border border-[#e0d9c8] p-0">
            <button
              type="button"
              disabled={!tap}
              onClick={() => onTap(tap)}
              className={`flex h-[26px] w-full items-center justify-center text-[10px] font-extrabold ${cellClass(c, row)} ${
                tap ? "" : "cursor-default"
              }`}
            >
              {cellText(c)}
            </button>
          </td>
        );
      })}
    </tr>
  );
}

// 色は状態のみ(§2-1)。先週行は全てグレー。
function cellClass(c: WeekCell, row: "rec" | "this" | "last"): string {
  if (row === "last") {
    if (c.kind === "empty") return "bg-white text-transparent";
    return "bg-white text-[#c2bba9]"; // 過去はモノトーン
  }
  if (row === "rec") {
    if (c.kind === "rest") return "bg-white text-[#a8955a]";
    if (c.kind === "dist") return "bg-white text-[#2b2620]";
    return "bg-white text-transparent";
  }
  // this
  if (c.kind === "dist") return "bg-[#e7efe6] text-[#34603f]";
  if (c.kind === "custom") return "bg-white text-[#6d5a8e]";
  if (c.kind === "rest") return "bg-white text-[#a8955a]";
  return "bg-white text-transparent";
}
function cellText(c: WeekCell): string {
  if (c.kind === "dist") return c.abbr;
  if (c.kind === "custom") return "★";
  if (c.kind === "rest") return "休";
  return "";
}
