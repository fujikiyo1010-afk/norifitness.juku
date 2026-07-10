"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { createMealLog, updateMealLog, type MealItemInput } from "@/lib/meals/actions";
import { MEAL_LABEL, type MealLog, type MealType } from "@/lib/meals/types";

/**
 * 食事 投稿/編集シート(M16改・第2部・v1-a)。
 *  - タイプはシート見出しに固定(ピル廃止)。写真+品目+メモ。写真だけでもOK。
 *  - 品目: 名前 + 任意の手入力数値4セル(一部だけOK・空欄は合計外)。
 *    出所ラベル3色(表=緑/手入力=金茶/数値なし=グレー)。v1-aはfood_table空=手入力/数値なしのみ。
 *  - 保存→onSaved(枠に写真+トースト)。閉じる時に内容あれば破棄確認。
 */

type DraftItem = {
  name: string;
  kcal: string;
  p: string;
  f: string;
  c: string;
  open: boolean; // 数値入力を開いているか
};

type ExistingPhoto = { path: string; url: string };

export function MealSheet({
  userId,
  date,
  mealType,
  editLog,
  onClose,
  onSaved,
}: {
  userId: string;
  date: string;
  mealType: MealType;
  editLog: (MealLog & { photoUrls: string[] }) | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!editLog;
  const [memo, setMemo] = useState(editLog?.memo ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    (editLog?.items ?? []).map((it) => ({
      name: it.name,
      kcal: it.kcal != null ? String(it.kcal) : "",
      p: it.protein_g != null ? String(it.protein_g) : "",
      f: it.fat_g != null ? String(it.fat_g) : "",
      c: it.carb_g != null ? String(it.carb_g) : "",
      open: false,
    }))
  );
  const [draftName, setDraftName] = useState("");
  const [keepPhotos, setKeepPhotos] = useState<ExistingPhoto[]>(
    (editLog?.photos ?? []).map((p, i) => ({ path: p, url: editLog?.photoUrls[i] ?? "" })).filter((x) => x.url)
  );
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty =
    memo.trim() !== (editLog?.memo ?? "").trim() ||
    items.length !== (editLog?.items.length ?? 0) ||
    newFiles.length > 0 ||
    draftName.trim().length > 0;

  function tryClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function addItem() {
    const v = draftName.trim();
    if (!v) return;
    setItems((prev) => [...prev, { name: v, kcal: "", p: "", f: "", c: "", open: false }]);
    setDraftName("");
  }
  function patchItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    setNewFiles((prev) => [
      ...prev,
      ...Array.from(files).slice(0, 4).map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const uploaded: string[] = [];
    try {
      for (const nf of newFiles) {
        const path = `${userId}/${date}-${mealType}-${Date.now()}-${uploaded.length}.jpg`;
        const blob = await compressImage(nf.file, 1080, 0.82);
        const up = await supabase.storage
          .from("meal-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw new Error(up.error.message);
        uploaded.push(path);
      }
      const photos = [...keepPhotos.map((p) => p.path), ...uploaded];
      const payloadItems: MealItemInput[] = items
        .filter((it) => it.name.trim())
        .map((it) => {
          const num = (s: string) => (s.trim() === "" ? null : Number(s));
          const kcal = num(it.kcal);
          const p = num(it.p);
          const f = num(it.f);
          const c = num(it.c);
          const hasNum = kcal != null || p != null || f != null || c != null;
          return {
            name: it.name.trim(),
            source: hasNum ? "manual" : "none",
            kcal,
            protein_g: p,
            fat_g: f,
            carb_g: c,
          };
        });

      if (isEdit && editLog) {
        const r = await updateMealLog(editLog.id, { memo, photos, items: payloadItems });
        if (!r.ok) throw new Error(r.message);
      } else {
        const r = await createMealLog({ date, meal_type: mealType, memo, photos, items: payloadItems });
        if (!r.ok) throw new Error(r.message);
      }
      onSaved(`${MEAL_LABEL[mealType]}を記録しました`);
    } catch (e) {
      if (uploaded.length) {
        try {
          await supabase.storage.from("meal-photos").remove(uploaded);
        } catch {}
      }
      setError(
        e instanceof Error ? `${e.message}（もう一度お試しください）` : "保存に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* 見出し(タイプ固定) */}
      <div>
        <div className="text-[15px] font-extrabold text-[#2b2620]">
          {MEAL_LABEL[mealType]}を記録
        </div>
        <div className="text-[10px] text-[#a59b8c]">
          タイプはこの枠に固定です（変えたい時は枠を選び直してください）
        </div>
      </div>

      {/* 写真 */}
      <div className="flex flex-wrap gap-2">
        {keepPhotos.map((p, i) => (
          <div key={p.path} className="relative h-20 w-20 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setKeepPhotos((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
            >
              ×
            </button>
          </div>
        ))}
        {newFiles.map((nf, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={nf.preview} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(nf.preview);
                setNewFiles((prev) => prev.filter((_, idx) => idx !== i));
              }}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
            >
              ×
            </button>
          </div>
        ))}
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8cdba] text-[#a59b8c]">
          <span className="text-[20px] leading-none">＋</span>
          <span className="text-[9px]">写真</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
        </label>
      </div>
      <p className="text-[10px] text-[#a59b8c]">写真だけでも記録できます（品目・数値は任意）</p>

      {/* 品目 */}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => {
            const hasNum = [it.kcal, it.p, it.f, it.c].some((s) => s.trim() !== "");
            const label = hasNum
              ? { t: "手入力", cls: "bg-[#f6ecc8] text-[#8a6d10]" }
              : { t: "数値なし", cls: "bg-[#eee] text-[#8a8577]" };
            return (
              <li key={i} className="rounded-lg border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] text-[#2b2620]">
                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${label.cls}`}>
                      {label.t}
                    </span>
                    {it.name}
                    {it.kcal.trim() && (
                      <span className="text-[11px] text-[#6a6256]">{it.kcal}kcal〜</span>
                    )}
                  </span>
                  <span className="flex gap-2 text-[11px]">
                    <button type="button" onClick={() => patchItem(i, { open: !it.open })} className="text-[#4a875b]">
                      {it.open ? "閉じる" : "数値"}
                    </button>
                    <button type="button" onClick={() => removeItem(i)} className="text-[#a59b8c]">
                      削除
                    </button>
                  </span>
                </div>
                {it.open && (
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {(["kcal", "p", "f", "c"] as const).map((k) => (
                      <label key={k} className="text-center">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={it[k]}
                          onChange={(e) => patchItem(i, { [k]: e.target.value } as Partial<DraftItem>)}
                          placeholder="—"
                          className="w-full rounded border border-[#e7dcc9] bg-white px-1 py-1 text-center text-[12px] focus:border-[#4a875b] focus:outline-none"
                        />
                        <span className="text-[8px] text-[#a59b8c]">
                          {k === "kcal" ? "kcal" : `${k.toUpperCase()} g`}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="＋ 品目を追加（例: もち麦ごはん）"
          className="flex-1 rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
        <button type="button" onClick={addItem} className="rounded-lg bg-[#f0ece2] px-4 text-[12px] font-bold text-[#5b5344]">
          追加
        </button>
      </div>
      <p className="text-[10px] text-[#a59b8c]">
        いまは食材リスト準備中のため、名前だけ・または数値を自分で入れる形です（のり監修リストが入ると自動計算になります）。
      </p>

      {/* メモ */}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={2}
        placeholder="メモ（任意）"
        className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
      />

      {error && <p className="text-[12px] font-bold text-red-700">❌ {error}</p>}

      {confirmClose ? (
        <div className="rounded-lg border border-[#f0e2b8] bg-[#fffbeb] p-3">
          <p className="text-[12px] text-[#8a6d1a]">入力中の内容があります。破棄して閉じますか？</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-[#8a6d1a] py-2 text-[12px] font-bold text-white">
              破棄して閉じる
            </button>
            <button type="button" onClick={() => setConfirmClose(false)} className="flex-1 rounded-lg border border-[#e7dcc9] py-2 text-[12px] font-bold text-[#6a6256]">
              続ける
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={tryClose} className="rounded-xl border border-[#e7dcc9] px-4 py-3 text-[13px] font-bold text-[#6a6256]">
            閉じる
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="flex-1 rounded-xl bg-[#4a875b] py-3 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "保存中…" : isEdit ? "変更を保存する" : "これで記録する"}
          </button>
        </div>
      )}
    </div>
  );
}
