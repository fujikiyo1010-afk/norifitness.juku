"use client";

import { useMemo, useState } from "react";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { listExerciseMaster, partByExerciseName } from "@/lib/workout/video-master";
import { toggleFavorite } from "@/lib/workout/pool-actions";

/** 部位チップ(既存の種目選択UIと同一)。お尻/腹筋/全身は「すべて」から。 */
const PART_CHIPS = ["脚", "胸", "背中", "肩", "腕"] as const;

export type PickedExercise = { name: string; videoUrl: string | null };

/**
 * 既存「種目を選ぶ」UI(検索＋部位チップ＋リボン＋複数チェック＋「◯個の種目を追加」)を
 * 下からせり上がる全画面シートとして流用(§2-5・機能改変なし)。決定→onAdd で親のセット表へ挿入。
 */
export function ExercisePickerSheet({
  open,
  onClose,
  onAdd,
  existing,
  initialFavorites,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (picked: PickedExercise[]) => void;
  existing: string[];
  initialFavorites: string[];
}) {
  const master = useMemo(() => listExerciseMaster(), []);
  const [fav, setFav] = useState<Set<string>>(new Set(initialFavorites));
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<"fav" | "all" | (typeof PART_CHIPS)[number]>("all");
  const [picked, setPicked] = useState<PickedExercise[]>([]);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const existingSet = useMemo(() => new Set(existing), [existing]);
  const pickedNames = useMemo(() => new Set(picked.map((p) => p.name)), [picked]);

  const candidates = useMemo(() => {
    const query = q.trim();
    return master
      .filter((e) => {
        if (chip === "fav") return fav.has(e.確定代表名);
        if (chip !== "all") return partByExerciseName(e.確定代表名) === chip;
        return true;
      })
      .filter((e) => (query ? e.確定代表名.includes(query) : true))
      .slice(0, 60);
  }, [master, q, chip, fav]);

  function togglePick(name: string, videoUrl: string | null) {
    setPicked((prev) =>
      prev.some((p) => p.name === name) ? prev.filter((p) => p.name !== name) : [...prev, { name, videoUrl }]
    );
  }
  async function onToggleFav(name: string) {
    setFav((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    await toggleFavorite(name);
  }
  function commit() {
    if (picked.length === 0) return;
    onAdd(picked);
    setPicked([]);
    setQ("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true">
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-8 flex flex-col rounded-t-2xl bg-[#f9f5ed] shadow-[0_-10px_30px_rgba(0,0,0,.2)]">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <b className="text-[14px] text-[#2b2620]">種目を追加する</b>
          <button type="button" onClick={onClose} aria-label="閉じる" className="text-[18px] leading-none text-[#a59b8c]">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2.5 px-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="種目名で検索（例: スクワット）"
            className="h-11 w-full rounded-xl border border-[#e7dcc9] bg-white px-3.5 text-[14px] focus:border-[#4a875b] focus:outline-none"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip on={chip === "fav"} onClick={() => setChip("fav")}>
              <Ribbon on />
            </Chip>
            <Chip on={chip === "all"} onClick={() => setChip("all")}>
              すべて
            </Chip>
            {PART_CHIPS.map((p) => (
              <Chip key={p} on={chip === p} onClick={() => setChip(p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto px-4 pb-2">
          {candidates.map((e) => {
            const already = existingSet.has(e.確定代表名);
            const on = pickedNames.has(e.確定代表名) || already;
            const isFav = fav.has(e.確定代表名);
            return (
              <div key={e.確定代表名} className="flex items-center gap-2.5 rounded-xl border border-[#e7dcc9] bg-white px-3 py-2.5">
                <button
                  type="button"
                  disabled={already}
                  onClick={() => togglePick(e.確定代表名, e.video_url || null)}
                  aria-label="選択"
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-2 ${
                    on ? "border-[#4a875b] bg-[#4a875b] text-white" : "border-[#cfc4ad]"
                  } ${already ? "opacity-50" : ""}`}
                >
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <b className="min-w-0 flex-1 truncate text-[12.5px] text-[#2b2620]">
                  {cleanExerciseName(e.確定代表名)}
                  {already && <span className="ml-1 text-[9px] font-bold text-[#a59b8c]">追加済み</span>}
                </b>
                <button type="button" onClick={() => onToggleFav(e.確定代表名)} aria-label="お気に入り" className="flex-none px-1">
                  <Ribbon on={isFav} />
                </button>
                {e.video_url && (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: e.video_url, name: e.確定代表名 })}
                    aria-label="動画"
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#e8f3ec] text-[#34603f]"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20" /></svg>
                  </button>
                )}
              </div>
            );
          })}
          {candidates.length === 0 && <p className="py-6 text-center text-[12px] text-[#a59b8c]">該当する種目がありません。</p>}
        </div>

        <div className="border-t border-[#e7dcc9] bg-[#f9f5ed] px-4 pb-3 pt-2.5" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          {picked.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {picked.map((p) => (
                <span key={p.name} className="flex flex-none items-center gap-1 rounded-full border border-[#cfe0d4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#34603f]">
                  {cleanExerciseName(p.name)}
                  <button type="button" onClick={() => togglePick(p.name, p.videoUrl)} aria-label="外す" className="text-[#a59b8c]">✕</button>
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={commit}
            className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-40"
          >
            {picked.length}個の種目を追加
          </button>
        </div>
      </div>

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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-none items-center rounded-full border-[1.5px] px-3 py-1.5 text-[11px] font-extrabold ${
        on ? "border-[#34603f] bg-[#34603f] text-white" : "border-[#e0d6c2] bg-white text-[#6a6256]"
      }`}
    >
      {children}
    </button>
  );
}

function Ribbon({ on }: { on: boolean }) {
  return (
    <span
      className="inline-block h-[14px] w-[11px]"
      style={{ background: on ? "#4a875b" : "#d8cdba", clipPath: "polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)" }}
    />
  );
}
