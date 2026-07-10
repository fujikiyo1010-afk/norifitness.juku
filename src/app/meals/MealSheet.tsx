"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { createMealLog, updateMealLog, type MealItemInput } from "@/lib/meals/actions";
import {
  MEAL_LABEL,
  calcNutrition,
  searchFoods,
  type FoodItem,
  type MealLog,
  type MealType,
} from "@/lib/meals/types";

/**
 * 食事 投稿/編集シート(M16改 第2部・P4-b=food_table自動計算対応)。
 *  - 品目=食材検索(かな/別名)→default量→10g刻み/個数±1ステッパー+テンキー→自動計算(出所=表/緑)。
 *  - 表にない食材=そのまま追加+任意手入力4セル(手入力/金茶・数値なし/グレー)。
 */

type DraftItem = {
  name: string;
  source: "table" | "manual" | "none";
  food: FoodItem | null;
  quantity: number; // table用
  // manual用手入力(文字)
  kcal: string;
  p: string;
  f: string;
  c: string;
  open: boolean;
};

type ExistingPhoto = { path: string; url: string };

// 細1: ストレージキー用の英語コード(日本語はキーに使えない)
const MEAL_TYPE_CODE: Record<MealType, string> = {
  朝: "breakfast",
  昼: "lunch",
  夕: "dinner",
  間: "snack",
};

export function MealSheet({
  userId,
  date,
  mealType,
  editLog,
  foods,
  onClose,
  onSaved,
}: {
  userId: string;
  date: string;
  mealType: MealType;
  editLog: (MealLog & { photoUrls: string[] }) | null;
  foods: FoodItem[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!editLog;
  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const popular = foods.slice(0, 6);

  const [memo, setMemo] = useState(editLog?.memo ?? "");
  const [items, setItems] = useState<DraftItem[]>(() =>
    (editLog?.items ?? []).map((it) => {
      const food = it.food_table_id ? foodById.get(it.food_table_id) ?? null : null;
      return {
        name: it.name,
        source: (it.source as DraftItem["source"]) ?? "none",
        food: it.source === "table" ? food : null,
        quantity: it.quantity ?? food?.defaultQty ?? 0,
        kcal: it.kcal != null ? String(it.kcal) : "",
        p: it.protein_g != null ? String(it.protein_g) : "",
        f: it.fat_g != null ? String(it.fat_g) : "",
        c: it.carb_g != null ? String(it.carb_g) : "",
        open: false,
      };
    })
  );
  const [q, setQ] = useState("");
  const [keepPhotos, setKeepPhotos] = useState<ExistingPhoto[]>(
    (editLog?.photos ?? [])
      .map((p, i) => ({ path: p, url: editLog?.photoUrls[i] ?? "" }))
      .filter((x) => x.url)
  );
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const results = searchFoods(foods, q);
  const dirty =
    memo.trim() !== (editLog?.memo ?? "").trim() ||
    items.length !== (editLog?.items.length ?? 0) ||
    newFiles.length > 0 ||
    q.trim().length > 0;

  function tryClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function addFood(food: FoodItem) {
    setItems((prev) => [
      ...prev,
      { name: food.name, source: "table", food, quantity: food.defaultQty, kcal: "", p: "", f: "", c: "", open: false },
    ]);
    setQ("");
  }
  function addManual(name: string) {
    const v = name.trim();
    if (!v) return;
    setItems((prev) => [
      ...prev,
      { name: v, source: "none", food: null, quantity: 0, kcal: "", p: "", f: "", c: "", open: false },
    ]);
    setQ("");
  }
  function patch(i: number, p: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  }
  function remove(i: number) {
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
        // 細1: ストレージキーに日本語(mealType)を入れるとSupabaseが Invalid key で拒否する。英語コードで生成。
        const path = `${userId}/${date}-${MEAL_TYPE_CODE[mealType]}-${Date.now()}-${uploaded.length}.jpg`;
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
          if (it.source === "table" && it.food) {
            const n = calcNutrition(it.food, it.quantity);
            return {
              name: it.name,
              source: "table",
              food_table_id: it.food.id,
              quantity: it.quantity,
              unit: it.food.unitLabel,
              kcal: n.kcal,
              protein_g: n.p,
              fat_g: n.f,
              carb_g: n.c,
            };
          }
          const num = (s: string) => (s.trim() === "" ? null : Number(s));
          const kcal = num(it.kcal), p = num(it.p), f = num(it.f), c = num(it.c);
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
      // 細7: 生エラー(英語/内部ID)は見せない。人の言葉に変換(入力は保持)。
      console.warn("[meal] save failed", e);
      setError(
        newFiles.length > 0
          ? "写真の保存に失敗しました。もう一度お試しください。"
          : "保存に失敗しました。もう一度お試しください。"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* 細3: シート見出しはBottomSheet側(◯食を記録)が担う。ここは固定の注記のみ */}
      <div className="text-[10px] text-[#a59b8c]">
        タイプはこの枠に固定です（変えたい時は枠を選び直してください）
      </div>

      {/* 写真 */}
      <div className="flex flex-wrap gap-2">
        {keepPhotos.map((p, i) => (
          <PhotoThumb key={p.path} url={p.url} onRemove={() => setKeepPhotos((prev) => prev.filter((_, idx) => idx !== i))} />
        ))}
        {newFiles.map((nf, i) => (
          <PhotoThumb
            key={i}
            url={nf.preview}
            onRemove={() => {
              URL.revokeObjectURL(nf.preview);
              setNewFiles((prev) => prev.filter((_, idx) => idx !== i));
            }}
          />
        ))}
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8cdba] text-[#a59b8c]">
          <span className="text-[20px] leading-none">＋</span>
          <span className="text-[9px]">写真</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
        </label>
      </div>
      <p className="text-[10px] text-[#a59b8c]">写真だけでも記録できます（品目・数値は任意）</p>

      {/* 品目リスト */}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <ItemRow key={i} item={it} onPatch={(p) => patch(i, p)} onRemove={() => remove(i)} />
          ))}
        </ul>
      )}

      {/* 食材検索/追加 */}
      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="＋ 品目を追加（かな・別名で検索 例: とりむね）"
          className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
        />
        {q.trim() === "" ? (
          <div className="mt-2">
            <div className="mb-1 text-[10px] font-bold text-[#a59b8c]">よく使う食材（のり監修）</div>
            <div className="flex flex-wrap gap-1.5">
              {popular.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => addFood(f)}
                  className="rounded-full border border-[#cfe0d4] bg-[#eef5f0] px-3 py-1 text-[11px] font-bold text-[#34603f]"
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {results.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => addFood(f)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2 text-left"
              >
                <span className="text-[13px] font-bold text-[#2b2620]">
                  <span className="mr-1.5 rounded bg-[#eaf3ec] px-1 py-0.5 text-[9px] font-bold text-[#34603f]">表</span>
                  {f.name}
                </span>
                <span className="text-[10px] text-[#a59b8c]">
                  {f.defaultQty}
                  {f.unitLabel}〜
                </span>
              </button>
            ))}
            {/* 細6: 候補外は常時「＋追加する」緑ボタン(1文字目から表示) */}
            <button
              type="button"
              onClick={() => addManual(q)}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#4a875b] px-3 py-2 text-[13px] font-bold text-white"
            >
              ＋「{q.trim()}」を追加する
            </button>
            <p className="text-[10px] text-[#a59b8c]">
              表にない食べ物もそのまま追加できます。数値は任意で手入力できます。
            </p>
          </div>
        )}
      </div>

      {/* メモ */}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={2}
        placeholder="メモ（任意）"
        className="w-full rounded-lg border border-[#e7dcc9] bg-white px-3 py-2 text-[13px] focus:border-[#4a875b] focus:outline-none"
      />

      {/* 細7: エラーは SVG + 人の言葉 + もう一度試す(入力保持) */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#f0c9c0] bg-[#fdeee9] px-3 py-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2693f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1 text-[12px] text-[#8a4b32]">{error}</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="flex-shrink-0 rounded-lg bg-[#4a875b] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            もう一度試す
          </button>
        </div>
      )}

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

function PhotoThumb({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white"
      >
        ×
      </button>
    </div>
  );
}

function ItemRow({
  item,
  onPatch,
  onRemove,
}: {
  item: DraftItem;
  onPatch: (p: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  if (item.source === "table" && item.food) {
    const n = calcNutrition(item.food, item.quantity);
    const isWeight = item.food.unitType === "weight";
    return (
      <li className="rounded-lg border border-[#cfe0d4] bg-[#eef5f0] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#2b2620]">
            <span className="rounded bg-[#eaf3ec] px-1 py-0.5 text-[9px] text-[#34603f]">表</span>
            {item.food.name}
          </span>
          <DeleteBtn onClick={onRemove} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          {/* 細4: 44px ステッパー */}
          <button
            type="button"
            aria-label="減らす"
            onClick={() => onPatch({ quantity: Math.max(0, Math.round((item.quantity - item.food!.stepQty) * 10) / 10) })}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-[#cfe0d4] bg-white text-[20px] text-[#34603f]"
          >
            −
          </button>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={item.quantity}
              onChange={(e) => onPatch({ quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
              className="h-11 w-20 rounded-lg border border-[#cfe0d4] bg-white px-1 text-center text-[16px] font-bold focus:outline-none"
            />
            <span className="text-[12px] text-[#6a6256]">{item.food.unitLabel}</span>
          </div>
          <button
            type="button"
            aria-label="増やす"
            onClick={() => onPatch({ quantity: Math.round((item.quantity + item.food!.stepQty) * 10) / 10 })}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-[#cfe0d4] bg-white text-[20px] text-[#34603f]"
          >
            ＋
          </button>
          <span className="ml-auto text-[12px] font-bold text-[#34603f]">{n.kcal}kcal</span>
        </div>
        <div className="mt-1 text-[10px] text-[#6a6256]">
          P{n.p} ・ F{n.f} ・ C{n.c}
          <span className="ml-1 text-[9px] text-[#a59b8c]">
            （{isWeight ? `${item.food.stepQty}gずつ・数字タップで直接入力` : "±1"}）
          </span>
        </div>
      </li>
    );
  }

  // 手入力/数値なし
  const hasNum = [item.kcal, item.p, item.f, item.c].some((s) => s.trim() !== "");
  const label = hasNum
    ? { t: "手入力", cls: "bg-[#f6ecc8] text-[#8a6d10]" }
    : { t: "数値なし", cls: "bg-[#eee] text-[#8a8577]" };
  return (
    <li className="rounded-lg border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] text-[#2b2620]">
          <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${label.cls}`}>{label.t}</span>
          {item.name}
          {item.kcal.trim() && <span className="text-[11px] text-[#6a6256]">{item.kcal}kcal〜</span>}
        </span>
        {/* 細5: 裸テキスト→ボタン形状。数値=緑枠pill / 削除=グレー枠pill(右) */}
        <span className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPatch({ open: !item.open })}
            className="flex h-9 items-center rounded-full border border-[#4a875b] px-3 text-[11px] font-bold text-[#4a875b]"
          >
            {item.open ? "閉じる" : "数値を入れる"}
          </button>
          <DeleteBtn onClick={onRemove} />
        </span>
      </div>
      {item.open && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(["kcal", "p", "f", "c"] as const).map((k) => (
            <label key={k} className="text-center">
              <input
                type="number"
                inputMode="decimal"
                value={item[k]}
                onChange={(e) => onPatch({ [k]: e.target.value } as Partial<DraftItem>)}
                placeholder="—"
                className="h-11 w-full rounded border border-[#e7dcc9] bg-white px-1 text-center text-[15px] focus:border-[#4a875b] focus:outline-none"
              />
              <span className="text-[8px] text-[#a59b8c]">{k === "kcal" ? "kcal" : `${k.toUpperCase()} g`}</span>
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

// 細5: 削除ボタン(グレー枠pill・右端)
function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center rounded-full border border-[#d8cdba] px-3 text-[11px] font-bold text-[#a59b8c]"
    >
      削除
    </button>
  );
}
