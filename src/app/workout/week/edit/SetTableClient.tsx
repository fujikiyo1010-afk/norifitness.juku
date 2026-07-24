"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { lookupVideoByName } from "@/lib/workout/video-master";
import { ExercisePickerSheet, type PickedExercise } from "./ExercisePickerSheet";
import { loadDraft, saveDraft, type DraftExercise, type DraftSet, type WeeklyDraft } from "../draft";

/**
 * セット表(§2-4・全経路の着地点)。のり初期値入りで開き最初から編集できる。
 * 触った所だけ紫(baseSets 基準)。追加種目はカード紫＋「追加」タグ。
 * 下部は「このメニューで決定する」1本のみ → 決定内容を localStorage に保存し表紙へ(完了はしない)。
 */
export function SetTableClient({
  kind,
  dayNumber,
  menuName,
  editLogId,
  todayKey,
  initialExercises,
  initialFavorites,
  resume,
}: {
  kind: "dist" | "custom";
  dayNumber: number | null;
  menuName: string;
  editLogId: string | null;
  todayKey: string;
  initialExercises: DraftExercise[];
  initialFavorites: string[];
  resume: boolean;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState<DraftExercise[]>(initialExercises);
  const [memo, setMemo] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  // 「← 修正する」で戻ってきた時(resume)は端末ローカルのドラフトを復元(rAF後=同期setState回避)
  useEffect(() => {
    if (!resume) return;
    const id = requestAnimationFrame(() => {
      const d = loadDraft(todayKey);
      if (d) {
        setExercises(d.exercises);
        setMemo(d.memo ?? "");
      }
    });
    return () => cancelAnimationFrame(id);
  }, [resume, todayKey]);

  function patchSet(ei: number, si: number, p: Partial<DraftSet>) {
    setExercises((prev) =>
      prev.map((ex, i) => (i === ei ? { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...p } : s)) } : ex))
    );
  }
  function addSet(ei: number) {
    setExercises((prev) => prev.map((ex, i) => (i === ei ? { ...ex, sets: [...ex.sets, { kg: null, reps: null }] } : ex)));
  }
  function removeSet(ei: number) {
    setExercises((prev) =>
      prev.map((ex, i) => (i === ei && ex.sets.length > 1 ? { ...ex, sets: ex.sets.slice(0, -1) } : ex))
    );
  }
  function removeExercise(ei: number) {
    setExercises((prev) => prev.filter((_, i) => i !== ei));
  }
  function onAdd(picked: PickedExercise[]) {
    setExercises((prev) => [
      ...prev,
      ...picked
        .filter((p) => !prev.some((ex) => ex.name === cleanExerciseName(p.name)))
        .map((p) => ({
          name: cleanExerciseName(p.name),
          source: "added" as const,
          videoUrl: p.videoUrl ?? lookupVideoByName(p.name),
          sets: [{ kg: null, reps: null }] as DraftSet[],
          baseSets: null, // 追加種目は常に紫扱い(のり基準に無い)
        })),
    ]);
  }

  function decide() {
    if (exercises.length === 0) return;
    const draft: WeeklyDraft = { kind, dayNumber, menuName, editLogId, exercises, memo, todayKey };
    saveDraft(draft);
    router.push("/workout/week/confirm");
  }

  // 紫判定: 追加種目=常に紫 / のり基準ありで値が異なる=紫
  function kgChanged(ex: DraftExercise, si: number): boolean {
    if (ex.source === "added") return true;
    if (!ex.baseSets) return false;
    const b = ex.baseSets[si];
    return !b || ex.sets[si].kg !== b.kg;
  }
  function repsChanged(ex: DraftExercise, si: number): boolean {
    if (ex.source === "added") return true;
    if (!ex.baseSets) return false;
    const b = ex.baseSets[si];
    return !b || ex.sets[si].reps !== b.reps;
  }
  function volumeOf(ex: DraftExercise): number {
    return ex.sets.reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0);
  }

  const existing = exercises.map((e) => e.name);

  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed] pb-40">
      <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
        <div className="flex items-center justify-between rounded-xl border border-[#cfe3d6] bg-[#f0f7f2] px-3.5 py-2">
          <b className="text-[12.5px] font-extrabold text-[#34603f]">{menuName}</b>
          <span className="text-[10px] font-bold text-[#6a6256]">編集できます</span>
        </div>

        {exercises.map((ex, ei) => {
          const added = ex.source === "added";
          return (
            <div
              key={`${ex.name}-${ei}`}
              className={`rounded-2xl border px-3 py-3 ${added ? "border-[#c8b6f0] bg-[#f4effc]" : "border-[#e7dcc9] bg-white"}`}
            >
              <div className="flex items-center gap-2">
                {ex.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: ex.videoUrl!, name: ex.name })}
                    aria-label="動画"
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#e8f3ec] text-[#34603f]"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20" /></svg>
                  </button>
                )}
                <b className={`flex-1 text-[13px] ${added ? "text-[#5b3fd6]" : "text-[#2b2620]"}`}>
                  {ei + 1}. {cleanExerciseName(ex.name)}
                  {added && (
                    <span className="ml-1.5 rounded-full border border-[#7a5af0] px-1.5 py-[1px] align-[2px] text-[9px] font-extrabold text-[#5b3fd6]">
                      追加
                    </span>
                  )}
                </b>
                <button
                  type="button"
                  onClick={() => removeExercise(ei)}
                  className="rounded-full border border-[#d8cdba] px-2.5 py-1 text-[10px] font-bold text-[#a59b8c]"
                >
                  はずす
                </button>
              </div>

              <div className="mt-2 flex flex-col gap-1.5">
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="w-5 text-center text-[10px] font-extrabold text-[#a59b8c]">{si + 1}</span>
                    <SetInput value={s.kg} onChange={(v) => patchSet(ei, si, { kg: v })} unit="kg" purple={kgChanged(ex, si)} />
                    <span className="text-[11px] text-[#a59b8c]">×</span>
                    <SetInput value={s.reps} onChange={(v) => patchSet(ei, si, { reps: v })} unit="回" purple={repsChanged(ex, si)} />
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-extrabold">
                <button type="button" onClick={() => removeSet(ei)} className="rounded-full border border-[#d8cdba] px-3 py-1 text-[#a59b8c]">
                  − セット削除
                </button>
                <button type="button" onClick={() => addSet(ei)} className="rounded-full border-[1.5px] border-[#4a875b] px-3 py-1 text-[#34603f]">
                  ＋ セット追加
                </button>
              </div>
              <div className="mt-1.5 text-right text-[9.5px] font-extrabold text-[#6a6256]">総ボリューム {volumeOf(ex)}kg</div>
            </div>
          );
        })}

        {exercises.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-6 text-center text-[12px] text-[#a59b8c]">
            下の「＋ 種目を追加する」から、やる種目を選んでください。
          </p>
        )}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full rounded-xl border-[1.5px] border-dashed border-[#4a875b] bg-white py-3 text-[13px] font-extrabold text-[#34603f]"
        >
          ＋ 種目を追加する
        </button>

        <div>
          <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">ひとことメモ（任意）</div>
          <textarea
            value={memo}
            onChange={(e) => {
                        setMemo(e.target.value);
            }}
            rows={2}
            placeholder="今日の調子など"
            className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
          />
        </div>
        <p className="text-[10.5px] leading-relaxed text-[#a59b8c]">
          ここでは「決定」まで。完了は次の確認画面（今日のトレーニングの表紙）で押します。
        </p>
      </div>

      <div
        className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-3 backdrop-blur"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-[460px]">
          <button
            type="button"
            onClick={decide}
            disabled={exercises.length === 0}
            className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-40"
          >
            このメニューで決定する
          </button>
        </div>
      </div>

      <ExercisePickerSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={onAdd}
        existing={existing}
        initialFavorites={initialFavorites}
      />

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
            <VimeoEmbed url={lightbox.url} />
            <div className="flex items-center justify-between bg-[#111] px-3.5 py-2.5 text-white">
              <span className="text-[13px] font-bold">{cleanExerciseName(lightbox.name)}</span>
              <button type="button" onClick={() => setLightbox(null)} className="text-lg text-zinc-400" aria-label="閉じる">✕</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function SetInput({
  value,
  onChange,
  unit,
  purple,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
  purple?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(null);
          const n = Number(v);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
        className={`h-10 w-full rounded-[9px] border text-center text-[15px] font-extrabold focus:outline-none ${
          purple
            ? "border-[#7a5af0] bg-[#efeafd] text-[#5b3fd6] focus:border-[#5b3fd6]"
            : "border-[#d9dce0] bg-white text-[#2b2620] focus:border-[#4a875b]"
        }`}
      />
      <span className="text-[9px] font-bold text-[#a59b8c]">{unit}</span>
    </div>
  );
}
