"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VimeoEmbed } from "@/components/VimeoEmbed";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { listExerciseMaster, partByExerciseName } from "@/lib/workout/video-master";
import {
  recordCustomWorkout,
  updateCustomMenu,
  toggleFavorite,
  type CustomExerciseInput,
} from "@/lib/workout/pool-actions";

/** 部位チップ(モック画面5・正)。8カテのうち お尻/腹筋/全身 は「すべて」から。 */
const PART_CHIPS = ["脚", "胸", "背中", "肩", "腕"] as const;

type SetRow = { kg: number | null; reps: number | null };
type ExState = { name: string; videoUrl: string | null; sets: SetRow[] };

/** じぶんメニュー作成(モック画面5→6→8)。種目選択(検索/部位/リボン/複数)→セット記録→完了/保存。 */
export function CustomBuilderClient({
  initialFavorites,
  initial,
  menuId,
  purpose = "record",
}: {
  initialFavorites: string[];
  initial?: { name: string; exercises: ExState[] } | null;
  /** record: このメニューを元に実施 / edit: 棚のこのメニューを上書き保存 */
  menuId?: string | null;
  purpose?: "record" | "edit";
}) {
  const router = useRouter();
  const master = useMemo(() => listExerciseMaster(), []);
  const [step, setStep] = useState<"select" | "record">(initial ? "record" : "select");
  const [fav, setFav] = useState<Set<string>>(new Set(initialFavorites));
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<"fav" | "all" | (typeof PART_CHIPS)[number]>("all");
  const [picked, setPicked] = useState<ExState[]>(initial?.exercises ?? []);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState(initial?.name ?? "");

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
      prev.some((p) => p.name === name)
        ? prev.filter((p) => p.name !== name)
        : [...prev, { name, videoUrl, sets: [{ kg: null, reps: null }] }]
    );
  }
  async function onToggleFav(name: string) {
    setFav((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    await toggleFavorite(name); // 楽観的更新
  }

  // --- record step ---
  function patchSet(ei: number, si: number, p: Partial<SetRow>) {
    setPicked((prev) =>
      prev.map((ex, i) =>
        i === ei ? { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...p } : s)) } : ex
      )
    );
  }
  function addSet(ei: number) {
    setPicked((prev) => prev.map((ex, i) => (i === ei ? { ...ex, sets: [...ex.sets, { kg: null, reps: null }] } : ex)));
  }
  function removeSet(ei: number) {
    setPicked((prev) =>
      prev.map((ex, i) => (i === ei && ex.sets.length > 1 ? { ...ex, sets: ex.sets.slice(0, -1) } : ex))
    );
  }
  function volumeOf(ex: ExState): number {
    return ex.sets.reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0);
  }

  function toInput(): CustomExerciseInput[] {
    return picked.map((ex) => ({
      exerciseName: ex.name,
      sets: ex.sets.map((s) => ({ weightKg: s.kg, reps: s.reps })),
    }));
  }

  async function complete(saveAs: string | null) {
    setError(null);
    setBusy(true);
    try {
      const r = await recordCustomWorkout({
        exercises: toInput(),
        memo,
        saveAsName: saveAs,
        fromMenuId: menuId ?? null,
      });
      if (!r.ok) throw new Error(r.message);
      router.replace("/workout/week/do?done=1");
      router.refresh();
    } catch (e) {
      console.warn("[custom] save failed", e);
      setError("保存に失敗しました。もう一度お試しください。");
      setSaveOpen(false);
    } finally {
      setBusy(false);
    }
  }

  // edit モード: 棚のメニューを上書き保存(実施しない)
  async function saveEdit() {
    if (!menuId) return;
    setError(null);
    setBusy(true);
    try {
      const r = await updateCustomMenu({ id: menuId, name: saveName.trim() || "じぶんメニュー", exercises: toInput() });
      if (!r.ok) throw new Error(r.message);
      router.replace("/workout/week/menus");
      router.refresh();
    } catch (e) {
      console.warn("[custom] edit failed", e);
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  // =========================== SELECT ===========================
  if (step === "select") {
    return (
      <main className="min-h-[100dvh] bg-[#f9f5ed] pb-40">
        <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="種目を検索（例: スクワット）"
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

          <div className="flex flex-col gap-1.5">
            {candidates.map((e) => {
              const on = pickedNames.has(e.確定代表名);
              const isFav = fav.has(e.確定代表名);
              return (
                <div key={e.確定代表名} className="flex items-center gap-2.5 rounded-xl border border-[#e7dcc9] bg-white px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => togglePick(e.確定代表名, e.video_url || null)}
                    aria-label="選択"
                    className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-2 ${
                      on ? "border-[#4a875b] bg-[#4a875b] text-white" : "border-[#cfc4ad]"
                    }`}
                  >
                    {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                  <b className="min-w-0 flex-1 truncate text-[12.5px] text-[#2b2620]">{cleanExerciseName(e.確定代表名)}</b>
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
            {candidates.length === 0 && (
              <p className="py-6 text-center text-[12px] text-[#a59b8c]">該当する種目がありません。</p>
            )}
          </div>
        </div>

        {/* 下部: 選択済みチップ + 追加ボタン */}
        <div className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-2.5 backdrop-blur" style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-[460px]">
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
              onClick={() => setStep("record")}
              className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-40"
            >
              {picked.length}個の種目を追加
            </button>
          </div>
        </div>

        <Lightbox lightbox={lightbox} onClose={() => setLightbox(null)} />
      </main>
    );
  }

  // =========================== RECORD ===========================
  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed] pb-44">
      <div className="mx-auto flex max-w-[460px] flex-col gap-2.5 px-4 py-4">
        <button type="button" onClick={() => setStep("select")} className="self-start text-[11.5px] font-bold text-[#34603f]">
          ← 種目を選び直す
        </button>
        {purpose === "edit" && (
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="メニュー名"
            className="h-11 w-full rounded-xl border border-[#e7dcc9] bg-white px-3.5 text-[14px] font-bold focus:border-[#4a875b] focus:outline-none"
          />
        )}
        {picked.map((ex, ei) => (
          <div key={ex.name} className="rounded-2xl border border-[#e7dcc9] bg-white px-3 py-3">
            <b className="text-[13px] text-[#2b2620]">
              {ei + 1}. {cleanExerciseName(ex.name)}
            </b>
            <div className="mt-2 flex flex-col gap-1.5">
              {ex.sets.map((s, si) => (
                <div key={si} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[10px] font-extrabold text-[#a59b8c]">{si + 1}</span>
                  <SetInput value={s.kg} onChange={(v) => patchSet(ei, si, { kg: v })} unit="kg" />
                  <SetInput value={s.reps} onChange={(v) => patchSet(ei, si, { reps: v })} unit="回" />
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-extrabold">
              <button type="button" onClick={() => removeSet(ei)} className="rounded-full border border-[#d8cdba] px-3 py-1 text-[#a59b8c]">− セット削除</button>
              <button type="button" onClick={() => addSet(ei)} className="rounded-full border-[1.5px] border-[#4a875b] px-3 py-1 text-[#34603f]">＋ セット追加</button>
            </div>
            <div className="mt-1.5 text-right text-[9.5px] font-extrabold text-[#6a6256]">総ボリューム {volumeOf(ex)}kg</div>
          </div>
        ))}
        <div>
          <div className="mb-1.5 text-[11px] font-bold text-[#6a6256]">メモ（任意）</div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none" />
        </div>
        <p className="text-[10.5px] leading-relaxed text-[#a59b8c]">
          kg・回が入っているセットを実績として記録します。空の行は保存されません。完了後は当日修正できます。
        </p>
        {error && <p className="text-[12px] text-[#8a4b32]">{error}</p>}
      </div>

      <div className="fixed inset-x-0 z-40 border-t border-[#e7dcc9] bg-[#f9f5ed]/95 px-4 pb-3 pt-3 backdrop-blur" style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-[460px] flex flex-col gap-2">
          {purpose === "edit" ? (
            <button type="button" onClick={saveEdit} disabled={busy} className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50">
              {busy ? "保存中…" : "✓ 保存する"}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => complete(null)} disabled={busy} className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50">
                {busy ? "保存中…" : "✓ 今日のトレ完了"}
              </button>
              <button type="button" onClick={() => setSaveOpen(true)} disabled={busy} className="text-center text-[11.5px] font-extrabold text-[#34603f]">
                じぶんメニューとして保存して完了 →
              </button>
            </>
          )}
        </div>
      </div>

      {/* 画面8: 名前を付けて保存 */}
      {saveOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-5" onClick={() => setSaveOpen(false)}>
          <div className="w-full max-w-[360px] rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-4" onClick={(e) => e.stopPropagation()}>
            <b className="text-[13px]">じぶんメニューとして保存</b>
            <p className="my-2 text-[11px] leading-relaxed text-[#6a6256]">次回から棚に並び、いつでも呼び出せます。セットの構成（セット数・kg・回）も一緒に保存されます。</p>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="メニュー名（例: 脚デー）" className="mb-3 h-11 w-full rounded-lg border border-[#e7dcc9] px-3 text-[13px] focus:border-[#4a875b] focus:outline-none" />
            <div className="flex gap-2">
              <button type="button" onClick={() => complete(null)} disabled={busy} className="flex-1 rounded-lg border border-[#e7dcc9] bg-white py-2.5 text-[12px] font-bold text-[#6a6256]">保存せず完了だけ</button>
              <button type="button" onClick={() => complete(saveName.trim() || "じぶんメニュー")} disabled={busy} className="flex-1 rounded-lg bg-[#4a875b] py-2.5 text-[12px] font-bold text-white">保存して完了</button>
            </div>
          </div>
        </div>
      )}

      <Lightbox lightbox={lightbox} onClose={() => setLightbox(null)} />
    </main>
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
      style={{
        background: on ? "#4a875b" : "#d8cdba",
        clipPath: "polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)",
      }}
    />
  );
}

function SetInput({ value, onChange, unit }: { value: number | null; onChange: (v: number | null) => void; unit: string }) {
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
        className="h-10 w-full rounded-[9px] border border-[#d9dce0] bg-white text-center text-[15px] font-extrabold text-[#2b2620] focus:border-[#4a875b] focus:outline-none"
      />
      <span className="text-[9px] font-bold text-[#a59b8c]">{unit}</span>
    </div>
  );
}

function Lightbox({ lightbox, onClose }: { lightbox: { url: string; name: string } | null; onClose: () => void }) {
  if (!lightbox) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
        <VimeoEmbed url={lightbox.url} />
        <div className="flex items-center justify-between bg-[#111] px-3.5 py-2.5 text-white">
          <span className="text-[13px] font-bold">{cleanExerciseName(lightbox.name)}</span>
          <button type="button" onClick={onClose} className="text-lg text-zinc-400" aria-label="閉じる">✕</button>
        </div>
      </div>
    </div>
  );
}
