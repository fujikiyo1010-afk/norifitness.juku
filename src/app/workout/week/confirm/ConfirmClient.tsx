"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanExerciseName } from "@/lib/workout/menu-display";
import { completeWeeklyWorkout } from "@/lib/workout/pool-actions";
import { clearDraft, loadDraft, type DraftExercise, type WeeklyDraft } from "../draft";

/**
 * 今日のトレーニングの表紙(§2-6)。決定内容の読み取り専用一覧＋未入力警告＋完了ボタン。
 * 完了ボタンは全経路でこの画面だけ。DB書き込みも完了時だけ。
 * rest=休養日直行(セット表を通らない・内容=休養日・ストレッチ)。
 */
export function ConfirmClient({
  todayKey,
  rest,
  restDayNumber,
}: {
  todayKey: string;
  rest: boolean;
  restDayNumber: number | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<WeeklyDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (rest) {
        setReady(true);
        return;
      }
      const d = loadDraft(todayKey);
      if (!d) {
        router.replace("/workout/week");
        return;
      }
      setDraft(d);
      setSaveName(d.menuName.replace(/（自分用）$/, ""));
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [rest, todayKey, router]);

  async function complete(saveAs: string | null) {
    setError(null);
    setBusy(true);
    try {
      const r = rest
        ? await completeWeeklyWorkout({ kind: "rest", dayNumber: restDayNumber })
        : await completeWeeklyWorkout({
            kind: draft!.kind,
            dayNumber: draft!.dayNumber,
            exercises: draft!.exercises.map((ex) => ({
              name: ex.name,
              source: ex.source,
              sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps })),
            })),
            memo: draft!.memo,
            saveAsName: saveAs,
            editLogId: draft!.editLogId,
          });
      if (!r.ok) throw new Error(r.message);
      clearDraft(todayKey);
      router.replace("/workout/week/do?done=1");
    } catch (e) {
      console.warn("[confirm] complete failed", e);
      setError("保存に失敗しました。もう一度お試しください。");
      setSaveOpen(false);
      setBusy(false);
    }
  }

  if (!ready) return <main className="min-h-[100dvh] bg-[#f9f5ed]" />;

  // ---- 休養日 ----
  if (rest) {
    return (
      <main className="min-h-[100dvh] bg-[#f9f5ed] pb-40">
        <div className="mx-auto flex max-w-[460px] flex-col gap-3 px-4 py-4">
          <div className="rounded-2xl border border-[#ebc9a6] bg-[#fffbe6] px-4 py-6 text-center">
            <div className="text-[10px] font-extrabold text-[#a5631f]">今日の内容</div>
            <b className="mt-1 block text-[16px] text-[#2b2620]">休養日・ストレッチ</b>
            <p className="mt-2 text-[12px] leading-relaxed text-[#7a6a35]">
              しっかり回復させましょう。疲労回復も大事なトレーニングです。
            </p>
          </div>
          {error && <p className="text-center text-[12px] text-[#8a4b32]">{error}</p>}
        </div>
        <FixedBar>
          <button
            type="button"
            onClick={() => complete(null)}
            disabled={busy}
            className="w-full rounded-xl py-3 text-[14px] font-bold text-white disabled:opacity-50"
            style={{ background: "#b6a35c", boxShadow: "0 4px 0 #96854a" }}
          >
            {busy ? "保存中…" : "✓ トレーニングを完了する"}
          </button>
        </FixedBar>
      </main>
    );
  }

  // ---- 配布/じぶん ----
  const d = draft!;
  const arranged = d.kind === "dist" && d.exercises.some((ex) => isArranged(ex));
  const title = d.kind === "custom" ? d.menuName : `${d.menuName}${arranged ? "（一部アレンジ）" : ""}`;
  const totalVolume = d.exercises.reduce(
    (a, ex) => a + ex.sets.reduce((b, s) => b + (s.kg ?? 0) * (s.reps ?? 0), 0),
    0
  );
  // 未入力(回数未入力)のセットを収集(§2-6・完了は可・警告のみ)
  const missing: string[] = [];
  for (const ex of d.exercises) {
    ex.sets.forEach((s, i) => {
      if (s.reps == null) missing.push(`${cleanExerciseName(ex.name)}の${i + 1}セット目`);
    });
  }

  return (
    <main className="min-h-[100dvh] bg-[#f9f5ed] pb-40">
      <div className="mx-auto flex max-w-[460px] flex-col gap-3 px-4 py-4">
        <div className="rounded-2xl border border-[#e7dcc9] bg-white px-3.5 py-3">
          <div className="text-[11px] font-extrabold text-[#6a6256]">{title}</div>
          <div className="mt-2 flex flex-col gap-2">
            {d.exercises.map((ex, ei) => {
              const added = ex.source === "added";
              return (
                <div key={`${ex.name}-${ei}`} className="border-b border-[#f3eddf] pb-2 last:border-b-0 last:pb-0">
                  <b className={`text-[13px] ${added ? "text-[#5b3fd6]" : "text-[#2b2620]"}`}>
                    {cleanExerciseName(ex.name)}
                    {added && <span className="ml-1 text-[9px] font-extrabold text-[#5b3fd6]">追加</span>}
                  </b>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2 text-[11.5px] text-[#6a6256]">
                        <span className="w-4 text-[9px] font-extrabold text-[#a59b8c]">{si + 1}</span>
                        <span className={setChanged(ex, si, "kg") ? "font-extrabold text-[#5b3fd6]" : "font-bold"}>
                          {s.kg != null ? `${s.kg}kg` : "自重"}
                        </span>
                        <span className="text-[#c9bfa9]">×</span>
                        <span className={setChanged(ex, si, "reps") ? "font-extrabold text-[#5b3fd6]" : "font-bold"}>
                          {s.reps != null ? `${s.reps}回` : <span className="text-[#c07a4a]">未入力</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {totalVolume > 0 && (
            <div className="mt-2 text-right text-[11px] font-bold text-[#6a6256]">総ボリューム {totalVolume}kg</div>
          )}
        </div>

        {missing.length > 0 && (
          <div className="rounded-lg border-l-4 border-[#c2693f] bg-[#fdf3ee] px-3 py-2.5 text-[11px] leading-relaxed text-[#8a3d2a]">
            {missing[0]}が未入力です。このまま完了すると記録に残りません。
            {missing.length > 1 && <span className="text-[#a5714f]">（ほか{missing.length - 1}件）</span>}
          </div>
        )}
        {error && <p className="text-[12px] text-[#8a4b32]">{error}</p>}
      </div>

      <FixedBar>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => complete(null)}
            disabled={busy}
            className="btn3d w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50"
          >
            {busy ? "保存中…" : "✓ トレーニングを完了する"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/workout/week/edit?resume=1")}
            disabled={busy}
            className="text-center text-[12px] font-extrabold text-[#34603f]"
          >
            ← 修正する
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            disabled={busy}
            className="text-center text-[11.5px] font-extrabold text-[#5b3fd6]"
          >
            じぶんメニューとして保存して完了 →
          </button>
        </div>
      </FixedBar>

      {saveOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-5" onClick={() => setSaveOpen(false)}>
          <div className="w-full max-w-[360px] rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-4" onClick={(e) => e.stopPropagation()}>
            <b className="text-[13px]">じぶんメニューとして保存</b>
            <p className="my-2 text-[11px] leading-relaxed text-[#6a6256]">
              次回から棚に並び、いつでも呼び出せます。セットの構成（セット数・kg・回）も一緒に保存されます。
            </p>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="メニュー名（例: 脚デー）"
              className="mb-3 h-11 w-full rounded-lg border border-[#e7dcc9] px-3 text-[13px] focus:border-[#4a875b] focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => complete(null)} disabled={busy} className="flex-1 rounded-lg border border-[#e7dcc9] bg-white py-2.5 text-[12px] font-bold text-[#6a6256]">
                保存せず完了だけ
              </button>
              <button
                type="button"
                onClick={() => complete(saveName.trim() || "じぶんメニュー")}
                disabled={busy}
                className="flex-1 rounded-lg bg-[#4a875b] py-2.5 text-[12px] font-bold text-white"
              >
                保存して完了
              </button>
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

function isArranged(ex: DraftExercise): boolean {
  if (ex.source === "added") return true;
  if (!ex.baseSets) return false;
  return ex.sets.some((s, i) => {
    const b = ex.baseSets![i];
    return !b || s.kg !== b.kg || s.reps !== b.reps;
  });
}
function setChanged(ex: DraftExercise, si: number, field: "kg" | "reps"): boolean {
  if (ex.source === "added") return true;
  if (!ex.baseSets) return false;
  const b = ex.baseSets[si];
  if (!b) return true;
  return field === "kg" ? ex.sets[si].kg !== b.kg : ex.sets[si].reps !== b.reps;
}
