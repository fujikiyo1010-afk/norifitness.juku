"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { BottomSheet } from "@/app/record/BottomSheet";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { listExercisesWithVideo } from "@/lib/workout/video-master";
import type { LoggedItem } from "@/lib/workout/logs-types";
import { recordDistWorkout } from "@/lib/workout/pool-actions";

export type DoExercise = { name: string; reps: number | null; sets: number | null; videoUrl: string | null };

/**
 * 配布メニュー実施(pool・種目単位・モック画面4→記録)。既存V2記録画面の型を踏襲。
 * 完了は recordDistWorkout(日付キーinsert・cycle_number=NULL)。編集=種目追加・数値変更。
 * rest=休養日確認。
 */
export function WeekDoClient({
  mode,
  day,
  menuName,
  initial,
}: {
  mode: "dist" | "rest";
  day: number | null;
  menuName: string;
  initial: DoExercise[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<DoExercise[]>(initial);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function patch(i: number, p: Partial<DoExercise>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  }
  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addExercise(name: string) {
    setItems((prev) => [...prev, { name, reps: null, sets: null, videoUrl: null }]);
    setAddOpen(false);
  }

  async function save(status: "done" | "rest_done") {
    setError(null);
    setBusy(true);
    try {
      const payload: LoggedItem[] =
        status === "done"
          ? items.map((it) => ({
              exerciseName: it.name,
              source: "original" as const,
              weightKg: null,
              reps: it.reps,
              sets: it.sets,
            }))
          : [];
      const r = await recordDistWorkout({
        dayNumber: day ?? 1,
        intensity: "medium",
        items: payload,
        memo,
        status,
      });
      if (!r.ok) throw new Error(r.message);
      router.replace("/workout/week/do?done=1");
      router.refresh();
    } catch (e) {
      console.warn("[week do] save failed", e);
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "rest") {
    return (
      <main className="min-h-[100dvh] bg-[#f9f5ed] pb-28">
        <div className="mx-auto max-w-[460px] px-4 py-4">
          <div className="rounded-2xl border border-[#e7dcc9] bg-white px-4 py-6 text-center text-[13px] leading-relaxed text-[#5b5344]">
            今日は<b className="text-[#a5631f]">休養日</b>にします。
            <br />
            しっかり回復させましょう。心と体をリセットして、次に備えます。
          </div>
          {error && <p className="mt-3 text-center text-[12px] text-[#8a4b32]">{error}</p>}
        </div>
        <FixedBar>
          <button
            type="button"
            onClick={() => save("rest_done")}
            disabled={busy}
            className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50"
          >
            {busy ? "保存中…" : "✓ 休養を記録"}
          </button>
        </FixedBar>
      </main>
    );
  }

  const existing = items.map((it) => it.name);

  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed] pb-40">
      <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
        <div className="rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2 text-[12px] font-extrabold text-[#34603f]">
          {menuName}
        </div>

        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-[#e7dcc9] bg-white px-3 py-2.5">
              <div className="flex items-center gap-2">
                {it.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: it.videoUrl!, name: it.name })}
                    aria-label="動画"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#e8f3ec] text-[#34603f]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20" /></svg>
                  </button>
                )}
                <b className="flex-1 truncate text-[13px] text-[#2b2620]">{cleanExerciseName(it.name)}</b>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-full border border-[#d8cdba] px-2.5 py-1 text-[11px] font-bold text-[#a59b8c]"
                >
                  はずす
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <NumField label="kg" value={null} onChange={() => {}} disabled />
                <NumField label="回" value={it.reps} onChange={(v) => patch(i, { reps: v })} />
                <NumField label="セット" value={it.sets} onChange={(v) => patch(i, { sets: v })} />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full rounded-xl border-[1.5px] border-[#cfe0d4] bg-white py-3 text-[13px] font-extrabold text-[#34603f]"
        >
          ＋ 種目を追加
        </button>

        <div>
          <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">ひとことメモ（任意）</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="今日の調子など"
            className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
          />
        </div>
        {error && <p className="text-[12px] text-[#8a4b32]">{error}</p>}
      </div>

      <FixedBar>
        <button
          type="button"
          onClick={() => save("done")}
          disabled={busy}
          className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50"
        >
          {busy ? "保存中…" : "✓ 今日のトレ完了"}
        </button>
      </FixedBar>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="種目を追加">
        <AddSheet existing={existing} onAdd={addExercise} />
      </BottomSheet>

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

function FixedBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-3 backdrop-blur"
      style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-[460px]">{children}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex-1">
      <div className="mb-0.5 text-center text-[8px] font-bold text-[#a59b8c]">{label}</div>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        disabled={disabled}
        placeholder="—"
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(null);
          const n = Number(v);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
        className="h-10 w-full rounded-[9px] border border-[#d9dce0] bg-[#f7f7f9] text-center text-[15px] font-extrabold text-[#2b2620] focus:border-[#4a875b] focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}

function AddSheet({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim();
  const set = new Set(existing);
  const candidates =
    query.length === 0
      ? []
      : listExercisesWithVideo()
          .filter((e) => e.確定代表名.includes(query) && !set.has(e.確定代表名))
          .slice(0, 12);
  return (
    <div className="flex max-h-[58vh] flex-col">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="種目名で検索"
        className="h-11 w-full shrink-0 rounded-lg border border-[#e7dcc9] bg-white px-3 text-[14px] focus:border-[#4a875b] focus:outline-none"
      />
      {query.length === 0 ? (
        <p className="px-1 py-4 text-center text-[12px] text-[#a59b8c]">種目名を入力すると候補が出ます。</p>
      ) : (
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {candidates.map((c) => (
            <button
              key={c.確定代表名}
              type="button"
              onClick={() => onAdd(c.確定代表名)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#e7dcc9] bg-white px-3 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2b2620]">
                {cleanExerciseName(c.確定代表名)}
              </span>
              <span className="flex-shrink-0 text-[10px] font-bold text-[#4a875b]">動画あり</span>
            </button>
          ))}
          {!candidates.some((c) => c.確定代表名 === query) && (
            <button
              type="button"
              onClick={() => onAdd(query)}
              className="flex w-full items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#4a875b] bg-[#f0f7f2] py-2.5 text-[12.5px] font-bold text-[#34603f]"
            >
              ＋「{query}」を追加する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
