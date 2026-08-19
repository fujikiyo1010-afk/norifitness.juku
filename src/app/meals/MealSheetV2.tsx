"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createMealLog, updateMealLog, type MealItemInput } from "@/lib/meals/actions";
import {
  MEAL_LABEL,
  kanaNorm,
  type FoodItem,
  type MealLog,
  type MealType,
  type RecipeSnapshotItem,
} from "@/lib/meals/types";

/**
 * 食事 投稿/編集シート V2(完全新装・2026-08-19)。
 * 見た目の正 = public/mock/meal-v2-shinso.html(実装後スクショ突合)。
 *  - 777品かな検索+カテゴリチップ/量パネル(単位⇔g・「真実は内訳」)
 *  - 内訳編集(±1g・タップ直接入力・×・材料追加・kcal/P/F/C列切替)
 *  - 表にない食べ物=名前だけOK+組み立てB(材料検索→自動計算)+手入力4セル(最優先)
 *  - 写真UIは持たない(写真は1日の画面の食事カードから)。編集時は既存写真を維持
 */

// ─── 内部型 ───
type Mat = {
  n: string;
  g: number;
  kcalPerG: number;
  pPerG: number;
  fPerG: number;
  cPerG: number;
  ref: string | null; // 成分表番号など
};

type Draft = {
  key: number;
  customFree: boolean;
  foodId: string | null;
  name: string;
  unitLabel: string; // 「杯」「個」…(customFreeは空)
  unitGrams: number; // 1単位の目安g(不明は0)
  grams: number; // 現在の実グラム(recipe/matsがある時は材料合計に追従)
  mode: "unit" | "g";
  recipe: Mat[] | null; // 表の内訳(deep copy・調整可)
  recipeTouched: boolean;
  mats: Mat[]; // カスタム組み立て
  manual: { kcal: number; p: number; f: number; c: number } | null;
  method: string | null;
  // 表品のベース値(1単位あたり) — recipeが無い品のスケール計算用
  base: { kcal: number; p: number; f: number; c: number } | null;
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const sumG = (ms: Mat[]) => ms.reduce((s, m) => s + m.g, 0);

function calcMats(ms: Mat[]) {
  return {
    kcal: ms.reduce((s, m) => s + m.g * m.kcalPerG, 0),
    p: ms.reduce((s, m) => s + m.g * m.pPerG, 0),
    f: ms.reduce((s, m) => s + m.g * m.fPerG, 0),
    c: ms.reduce((s, m) => s + m.g * m.cPerG, 0),
  };
}

/** 数値の決定則: 手入力 > 内訳/組み立て > 表の値×倍率 > なし */
function calcDraft(d: Draft): { kcal: number; p: number; f: number; c: number } | null {
  if (d.manual) return d.manual;
  if (d.recipe && d.recipe.length) return calcMats(d.recipe);
  if (d.customFree) return d.mats.length ? calcMats(d.mats) : null;
  if (d.base && d.unitGrams > 0) {
    const r = d.grams / d.unitGrams;
    return { kcal: d.base.kcal * r, p: d.base.p * r, f: d.base.f * r, c: d.base.c * r };
  }
  return null;
}

function draftGrams(d: Draft): number {
  if (d.recipe && d.recipe.length) return sumG(d.recipe);
  if (d.customFree && d.mats.length) return sumG(d.mats);
  return d.grams;
}

function matsToSnapshot(ms: Mat[]): RecipeSnapshotItem[] {
  return ms.map((m) => ({
    name: m.n,
    grams: r1(m.g),
    kcal: r1(m.g * m.kcalPerG),
    protein_g: r1(m.g * m.pPerG),
    fat_g: r1(m.g * m.fPerG),
    carb_g: r1(m.g * m.cPerG),
  }));
}

function foodToMat(f: FoodItem): Mat {
  const g = f.unitGrams && f.unitGrams > 0 ? f.unitGrams : f.baseQty === 100 ? 100 : 1;
  return {
    n: f.name.replace(/\s+\S+$/, "") || f.name,
    g,
    kcalPerG: (f.kcal ?? 0) / g,
    pPerG: (f.proteinG ?? 0) / g,
    fPerG: (f.fatG ?? 0) / g,
    cPerG: (f.carbG ?? 0) / g,
    ref: null,
  };
}

// カテゴリチップの並び(完全版の並び準拠)
const CATS = [
  "すべて",
  "基本食材(のり監修)",
  "ダイエット定番",
  "筋トレ・増量",
  "かんたん・ズボラ飯",
  "のりレシピ",
  "主食",
  "丼・ワンプレート",
  "麺類",
  "肉料理",
  "魚料理",
  "卵・大豆・乳",
  "鍋・汁物",
  "副菜・野菜",
  "洋食おかず",
  "コンビニ・市販",
  "間食・デザート",
  "飲料・酒",
  "素材(追加)",
  "調味・トッピング",
];

type ColKey = "kcal" | "P" | "F" | "C";

// カート行の識別子(描画キー用の連番。モジュール内で一意なら十分)
let keySeq = 1;
const nextKey = () => keySeq++;

export function MealSheetV2({
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
  void userId;
  const isEdit = !!editLog;
  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const [view, setView] = useState<"search" | "qty" | "cart">("search");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("すべて");
  const [memo, setMemo] = useState(editLog?.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // カート(たまり場)。編集時は既存品を復元
  const [cart, setCart] = useState<Draft[]>(() =>
    (editLog?.items ?? []).map((it) => {
      const food = it.food_table_id ? foodById.get(it.food_table_id) ?? null : null;
      const snap = (it.recipe_snapshot ?? null) as RecipeSnapshotItem[] | null;
      const snapMats: Mat[] = (snap ?? []).map((s) => ({
        n: s.name,
        g: s.grams,
        kcalPerG: s.grams > 0 ? (s.kcal ?? 0) / s.grams : 0,
        pPerG: s.grams > 0 ? (s.protein_g ?? 0) / s.grams : 0,
        fPerG: s.grams > 0 ? (s.fat_g ?? 0) / s.grams : 0,
        cPerG: s.grams > 0 ? (s.carb_g ?? 0) / s.grams : 0,
        ref: null,
      }));
      const isCustom = !it.food_table_id;
      const manual =
        it.source === "manual"
          ? { kcal: it.kcal ?? 0, p: it.protein_g ?? 0, f: it.fat_g ?? 0, c: it.carb_g ?? 0 }
          : null;
      return {
        key: nextKey(),
        customFree: isCustom,
        foodId: it.food_table_id,
        name: it.name,
        unitLabel: food?.unitLabel ?? it.unit ?? "",
        unitGrams: food?.unitGrams ?? 0,
        grams: it.grams ?? (snapMats.length ? sumG(snapMats) : food?.unitGrams ?? 0),
        mode: "unit" as const,
        recipe: !isCustom && snapMats.length ? snapMats : null,
        recipeTouched: !isCustom && snapMats.length > 0,
        mats: isCustom ? snapMats : [],
        manual,
        method: food?.method ?? null,
        base:
          food != null
            ? { kcal: food.kcal ?? 0, p: food.proteinG ?? 0, f: food.fatG ?? 0, c: food.carbG ?? 0 }
            : null,
      };
    })
  );
  const [cur, setCur] = useState<Draft | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [col, setCol] = useState<ColKey>("kcal");
  const [uwOpen, setUwOpen] = useState(false);
  const [addQ, setAddQ] = useState("");
  const [gEditIdx, setGEditIdx] = useState<number | null>(null);
  const [gEditVal, setGEditVal] = useState("");
  const [recipeLoading, setRecipeLoading] = useState(false);

  // ─── 検索 ───
  const results = useMemo(() => {
    const s = kanaNorm(q);
    let list = foods;
    if (cat !== "すべて") list = list.filter((f) => f.category === cat);
    if (s)
      list = list.filter(
        (f) => kanaNorm(f.name).includes(s) || f.aliases.some((a) => kanaNorm(a).includes(s))
      );
    return { hits: list.slice(0, 20), total: list.length, filtered: !!s || cat !== "すべて" };
  }, [foods, q, cat]);

  const popular = useMemo(
    () => foods.filter((f) => f.isPriority).slice(0, 5),
    [foods]
  );

  // ─── 量パネルを開く(表の品) ───
  async function openQty(f: FoodItem, fromIdx: number | null = null) {
    setErr(null);
    setEditIdx(fromIdx);
    setCol("kcal");
    setUwOpen(false);
    setAddQ("");
    if (fromIdx != null) {
      setCur({ ...cart[fromIdx], recipe: cart[fromIdx].recipe ? cart[fromIdx].recipe!.map((m) => ({ ...m })) : null, mats: cart[fromIdx].mats.map((m) => ({ ...m })) });
      setView("qty");
      return;
    }
    const base: Draft = {
      key: nextKey(),
      customFree: false,
      foodId: f.id,
      name: f.name,
      unitLabel: f.unitLabel,
      unitGrams: f.unitGrams ?? (f.baseQty === 100 ? 100 : 0),
      grams: f.unitGrams ?? (f.baseQty === 100 ? 100 : 0),
      mode: "unit",
      recipe: null,
      recipeTouched: false,
      mats: [],
      manual: null,
      method: f.method,
      base: { kcal: f.kcal ?? 0, p: f.proteinG ?? 0, f: f.fatG ?? 0, c: f.carbG ?? 0 },
    };
    setCur(base);
    setView("qty");
    // 内訳(積算品)を取得して差し込む
    if (f.method?.startsWith("積算")) {
      setRecipeLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("food_recipe_items")
        .select("seq, material_name, material_ref, grams, kcal, protein_g, fat_g, carb_g")
        .eq("food_id", f.id)
        .order("seq", { ascending: true });
      const rows = (data ?? []) as Record<string, unknown>[];
      if (rows.length) {
        const mats: Mat[] = rows.map((r) => {
          const g = Number(r.grams) || 0;
          return {
            n: String(r.material_name),
            g,
            kcalPerG: g > 0 ? Number(r.kcal ?? 0) / g : 0,
            pPerG: g > 0 ? Number(r.protein_g ?? 0) / g : 0,
            fPerG: g > 0 ? Number(r.fat_g ?? 0) / g : 0,
            cPerG: g > 0 ? Number(r.carb_g ?? 0) / g : 0,
            ref: (r.material_ref as string | null) ?? null,
          };
        });
        setCur((d) => (d && d.foodId === f.id ? { ...d, recipe: mats } : d));
      }
      setRecipeLoading(false);
    }
  }

  // ─── カスタム(表にない食べ物) ───
  function openCustom(name: string, fromIdx: number | null = null) {
    setErr(null);
    setEditIdx(fromIdx);
    setCol("kcal");
    setAddQ("");
    if (fromIdx != null) {
      setCur({ ...cart[fromIdx], mats: cart[fromIdx].mats.map((m) => ({ ...m })) });
    } else {
      setCur({
        key: nextKey(),
        customFree: true,
        foodId: null,
        name,
        unitLabel: "",
        unitGrams: 0,
        grams: 0,
        mode: "g",
        recipe: null,
        recipeTouched: false,
        mats: [],
        manual: null,
        method: null,
        base: null,
      });
    }
    setView("qty");
  }

  // ─── 量・内訳の操作(真実は内訳) ───
  function scaleTo(d: Draft, newGrams: number): Draft {
    const now = draftGrams(d);
    if (d.recipe && d.recipe.length && now > 0) {
      const k = newGrams / now;
      return { ...d, recipe: d.recipe.map((m) => ({ ...m, g: r1(m.g * k) })), grams: newGrams };
    }
    return { ...d, grams: newGrams };
  }
  function stepQty(dir: 1 | -1) {
    if (!cur || cur.unitGrams <= 0) return;
    const step = 0.5;
    const qty = Math.max(step, r1(draftGrams(cur) / cur.unitGrams + dir * step));
    setCur(scaleTo(cur, r1(cur.unitGrams * qty)));
  }
  function setMats(fn: (ms: Mat[]) => Mat[], isRecipe: boolean) {
    setCur((d) => {
      if (!d) return d;
      if (isRecipe && d.recipe)
        return { ...d, recipe: fn(d.recipe), recipeTouched: true, grams: 0 };
      return { ...d, mats: fn(d.mats) };
    });
  }

  const addHits = useMemo(() => {
    const s = kanaNorm(addQ);
    if (!s) return [];
    return foods
      .filter((f) => kanaNorm(f.name).includes(s) || f.aliases.some((a) => kanaNorm(a).includes(s)))
      .slice(0, 4);
  }, [foods, addQ]);

  // ─── カートへ確定 ───
  function commitQty() {
    if (!cur) return;
    if (cur.customFree && !cur.name.trim()) {
      setErr("名前を入れてください(ここだけ必須です)");
      return;
    }
    const item = { ...cur, name: cur.name.trim() };
    setCart((c) => {
      const next = [...c];
      if (editIdx != null) next[editIdx] = item;
      else next.push(item);
      return next;
    });
    setCur(null);
    setEditIdx(null);
    setQ("");
    setErr(null);
    setView(editIdx != null ? "cart" : "search");
  }

  // ─── 保存 ───
  async function save() {
    if (!cart.length) return;
    setSaving(true);
    setErr(null);
    const items: MealItemInput[] = cart.map((d) => {
      const v = calcDraft(d);
      const grams = draftGrams(d) || null;
      const source: MealItemInput["source"] = d.manual
        ? "manual"
        : d.customFree
          ? d.mats.length
            ? "built"
            : "none"
          : "table";
      const snapshot =
        d.customFree && d.mats.length
          ? matsToSnapshot(d.mats)
          : d.recipe && d.recipeTouched
            ? matsToSnapshot(d.recipe)
            : null;
      return {
        name: d.name,
        source,
        food_table_id: d.foodId,
        quantity:
          !d.customFree && d.unitGrams > 0 ? r1((grams ?? d.unitGrams) / d.unitGrams) : null,
        unit: d.customFree ? null : d.unitLabel || null,
        kcal: v ? Math.round(v.kcal) : null,
        protein_g: v ? r1(v.p) : null,
        fat_g: v ? r1(v.f) : null,
        carb_g: v ? r1(v.c) : null,
        grams: grams != null ? Math.round(grams) : null,
        recipe_snapshot: snapshot,
      };
    });
    const res = isEdit
      ? await updateMealLog(editLog!.id, { memo, photos: editLog!.photos, items })
      : await createMealLog({ date, meal_type: mealType, memo, photos: [], items });
    setSaving(false);
    if (!res.ok) {
      setErr(res.message ?? "保存に失敗しました");
      return;
    }
    onSaved(`${MEAL_LABEL[mealType]}を${isEdit ? "更新" : "記録"}しました`);
    onClose();
  }

  // ─── 表示部品 ───
  const cartSum = useMemo(() => {
    let kcal = 0;
    let noVal = 0;
    for (const d of cart) {
      const v = calcDraft(d);
      if (v) kcal += v.kcal;
      else noVal++;
    }
    return { kcal: Math.round(kcal), noVal };
  }, [cart]);

  const colVal = (m: Mat): string => {
    if (col === "P") return `${r1(m.g * m.pPerG)}g`;
    if (col === "F") return `${r1(m.g * m.fPerG)}g`;
    if (col === "C") return `${r1(m.g * m.cPerG)}g`;
    return `${Math.round(m.g * m.kcalPerG)}kcal`;
  };

  const badge = (d: Draft) => {
    if (d.manual) return { cls: "bg-[#f6ecc8] text-[#8a6d10]", label: "手入力(金茶)" };
    if (d.customFree)
      return d.mats.length
        ? { cls: "bg-teal-50 text-teal-700", label: "表から自動計算(緑)" }
        : { cls: "bg-gray-100 text-gray-500", label: "数値なし" };
    if (d.method === "市販平均") return { cls: "bg-teal-50 text-teal-700", label: "市販品の平均値" };
    return { cls: "bg-teal-50 text-teal-700", label: "表から自動計算(緑)" };
  };

  // 材料行(内訳/組み立て共用)
  const renderMatRows = (ms: Mat[], isRecipe: boolean) => (
      <div>
        {ms.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 border-t border-dashed border-teal-200 py-1.5 text-[12.5px] first:border-t-0"
          >
            <span className="min-w-0 flex-1 truncate">{m.n}</span>
            <span className="flex flex-none items-center gap-1">
              <button
                type="button"
                onClick={() => setMats((a) => a.map((x, j) => (j === i ? { ...x, g: Math.max(0, r1(x.g - 1)) } : x)), isRecipe)}
                className="h-6 w-6 rounded-md border border-teal-400 bg-white font-bold text-teal-700"
              >
                −
              </button>
              {gEditIdx === i ? (
                <input
                  autoFocus
                  inputMode="decimal"
                  value={gEditVal}
                  onChange={(e) => setGEditVal(e.target.value)}
                  onBlur={() => {
                    const g = parseFloat(gEditVal);
                    if (!isNaN(g) && g >= 0)
                      setMats((a) => a.map((x, j) => (j === i ? { ...x, g: r1(g) } : x)), isRecipe);
                    setGEditIdx(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="w-14 rounded-md border-[1.5px] border-teal-500 px-0.5 py-0.5 text-center text-[12.5px] font-bold outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setGEditIdx(i);
                    setGEditVal(String(r1(m.g)));
                  }}
                  className="min-w-11 text-center font-bold"
                  title="タップで直接入力"
                >
                  {r1(m.g)}g
                </button>
              )}
              <button
                type="button"
                onClick={() => setMats((a) => a.map((x, j) => (j === i ? { ...x, g: r1(x.g + 1) } : x)), isRecipe)}
                className="h-6 w-6 rounded-md border border-teal-400 bg-white font-bold text-teal-700"
              >
                ＋
              </button>
            </span>
            <span className="min-w-13 flex-none text-right text-[11px] text-gray-500">{colVal(m)}</span>
            <button
              type="button"
              onClick={() => setMats((a) => a.filter((_, j) => j !== i), isRecipe)}
              className="h-5.5 w-5.5 flex-none rounded-md bg-red-100 text-[11px] font-bold text-red-700"
            >
              ×
            </button>
          </div>
        ))}
      </div>
  );

  const renderColTabs = () => (
      <div className="mb-1.5 flex gap-1">
        {(["kcal", "P", "F", "C"] as ColKey[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setCol(t)}
            className={`rounded-full border px-3 py-1 text-[10.5px] font-bold ${
              col === t ? "border-teal-700 bg-teal-700 text-white" : "border-gray-200 bg-white text-gray-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
  );

  const renderMatAdd = (isRecipe: boolean) => (
      <div className="mt-2">
        <input
          value={addQ}
          onChange={(e) => setAddQ(e.target.value)}
          placeholder="材料・料理を検索して足す(例: ごはん、からあげ)"
          className="mb-1.5 w-full rounded-[10px] border-[1.5px] border-teal-500 px-3 py-2 text-[13px] outline-none"
        />
        {addHits.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setMats((a) => [...a, foodToMat(f)], isRecipe);
              setAddQ("");
            }}
            className="mb-1 flex w-full items-center justify-between rounded-[10px] border border-gray-200 bg-white px-2.5 py-2 text-left text-[12.5px]"
          >
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="flex-none text-[12px] font-bold text-teal-700">
              {f.kcal ?? "--"}kcal/{f.unitGrams ? Math.round(f.unitGrams) : "--"}g
            </span>
          </button>
        ))}
      </div>
  );

  // 手入力4セル
  const renderManual4 = () => {
    if (!cur) return null;
    const setM = (idx: number, val: string) => {
      setCur((d) => {
        if (!d) return d;
        const nums = [
          idx === 0 ? val : d.manual ? String(d.manual.kcal) : "",
          idx === 1 ? val : d.manual ? String(d.manual.p) : "",
          idx === 2 ? val : d.manual ? String(d.manual.f) : "",
          idx === 3 ? val : d.manual ? String(d.manual.c) : "",
        ].map((s) => parseFloat(s));
        const any = nums.some((x) => !isNaN(x));
        return {
          ...d,
          manual: any
            ? { kcal: nums[0] || 0, p: nums[1] || 0, f: nums[2] || 0, c: nums[3] || 0 }
            : null,
        };
      });
    };
    const v = cur.manual;
    return (
      <div className="mb-3 rounded-xl bg-[#f6ecc8] p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11.5px] font-bold text-[#8a6d10]">
          <span className="flex-1">数値が合わない時は直接手入力もできます(手入力/金茶)</span>
          <button type="button" onClick={() => setCur((d) => (d ? { ...d, manual: null } : d))} title="手入力を消して自動計算に戻す">
            ↺
          </button>
        </div>
        <div className="flex gap-1.5">
          {(["kcal", "P g", "F g", "C g"] as const).map((ph, i) => (
            <input
              key={ph}
              placeholder={ph}
              inputMode="decimal"
              defaultValue={v ? [Math.round(v.kcal), r1(v.p), r1(v.f), r1(v.c)][i] : ""}
              onChange={(e) => setM(i, e.target.value)}
              className="w-1/4 flex-1 rounded-lg border border-[#e3cf8f] bg-white px-1 py-2 text-center text-[13px] outline-none"
            />
          ))}
        </div>
      </div>
    );
  };

  // ─── ビュー: 検索 ───
  if (view === "search") {
    return (
      <div className="flex max-h-[78vh] flex-col">
        <div className="relative mb-2 flex-none">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="料理名・食材で検索"
            className="w-full rounded-[14px] border-2 border-teal-500 bg-white py-3 pl-4 pr-4 text-[15px] outline-none"
          />
        </div>
        <div className="mb-2 flex flex-none gap-1.5 overflow-x-auto pb-1">
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`flex-none rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
                cat === c ? "border-teal-700 bg-teal-700 text-white" : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {!results.filtered && (
            <div className="mb-1.5 text-[11px] text-gray-500">よく使うもの</div>
          )}
          {results.filtered && (
            <div className="mb-1.5 text-[11px] text-gray-500">
              {results.total ? `${results.total}件ヒット${results.total > 20 ? "(上位20件を表示)" : ""}` : "見つかりませんでした"}
            </div>
          )}
          {(results.filtered ? results.hits : popular).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => void openQty(f)}
              className="mb-1.5 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left active:bg-teal-50"
            >
              <span className="min-w-0 flex-1 pr-2">
                <span className="block truncate text-[13.5px] font-bold">{f.name}</span>
                <span className="block text-[11px] text-gray-500">
                  {f.unitGrams ? `${Math.round(f.unitGrams)}g` : ""} {f.category ? `・ ${f.category}` : ""}
                </span>
              </span>
              <span className="flex-none text-right">
                <span className="block text-[13.5px] font-bold text-teal-700">{f.kcal ?? "--"} kcal</span>
                <span className="block text-[10px] text-gray-500">
                  P{f.proteinG ?? "-"} F{f.fatG ?? "-"} C{f.carbG ?? "-"}
                </span>
              </span>
            </button>
          ))}
          {!results.filtered && (
            <div className="mb-1.5 mt-2 text-[11px] text-gray-500">検索すると全{foods.length}品から探せます</div>
          )}
          <button
            type="button"
            onClick={() => openCustom(q.trim())}
            className="mb-2 w-full rounded-xl border-[1.5px] border-dashed border-gray-300 py-2.5 text-center text-[12.5px] text-gray-500"
          >
            {q.trim()
              ? `「${q.trim()}」を表にない食べ物としてそのまま記録(数値は任意)`
              : "＋ 表にない食べ物を自分で記録(名前だけでもOK)"}
          </button>
        </div>
        {/* カートバー */}
        <div className="flex-none border-t border-gray-200 bg-white pt-2.5">
          <button type="button" onClick={() => cart.length && setView("cart")} className="w-full text-left">
            <div className="flex items-center justify-between">
              <div className="text-[13.5px] font-extrabold">
                {cart.length ? (
                  `${MEAL_LABEL[mealType]}に ${cart.length}品`
                ) : (
                  <>
                    まだ何も入っていません
                    <span className="ml-1.5 text-[11px] font-semibold text-gray-500">品を選ぶとここに溜まります</span>
                  </>
                )}
              </div>
              {cart.length > 0 && (
                <div className="text-[15px] font-extrabold text-teal-700">{cartSum.kcal} kcal</div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="mt-0.5 text-[10.5px] text-gray-500">タップして確認・保存 ▲</div>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── ビュー: 量パネル ───
  if (view === "qty" && cur) {
    const v = calcDraft(cur);
    const grams = draftGrams(cur);
    const qty = cur.unitGrams > 0 ? r1(grams / cur.unitGrams) : null;
    const bd = badge(cur);
    const isSekisan = cur.method?.startsWith("積算");
    return (
      <div className="max-h-[78vh] overflow-y-auto pb-2">
        {cur.customFree ? (
          <h3 className="mb-0.5 text-[15.5px] font-extrabold">表にない食べ物を記録</h3>
        ) : (
          <h3 className="mb-0.5 text-[15.5px] font-extrabold">{cur.name.replace(/\s+\S+$/, "")}</h3>
        )}
        <span className={`mb-2.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${bd.cls}`}>
          {bd.label}
        </span>

        {cur.customFree ? (
          <>
            <p className="mb-2 text-[10.5px] leading-relaxed text-gray-500">
              名前だけで記録できます。<b>中身がだいたい分かる時は「組み立てる」と数値が自動で出ます</b>。数値4セルは最終上書き。どちらも空なら「数値なし」で、写真とメモをのりが見ます。
            </p>
            <input
              value={cur.name}
              onChange={(e) => setCur((d) => (d ? { ...d, name: e.target.value } : d))}
              placeholder="名前(例: 会社の弁当、居酒屋の唐揚げ)"
              className="mb-2.5 w-full rounded-[10px] border-[1.5px] border-gray-200 px-3 py-2.5 text-[14px] font-bold outline-none focus:border-teal-500"
            />
            {cur.mats.length > 0 ? (
              <div className="mb-1.5 text-[12px] font-bold text-gray-500">
                量: 材料合計 約{Math.round(sumG(cur.mats))}g(自動)
              </div>
            ) : (
              <div className="mb-1.5 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  defaultValue={cur.grams || ""}
                  onChange={(e) =>
                    setCur((d) => (d ? { ...d, grams: parseFloat(e.target.value) || 0 } : d))
                  }
                  placeholder="量"
                  className="w-28 rounded-[10px] border-[1.5px] border-gray-200 px-2 py-2 text-center text-[15px] font-bold outline-none focus:border-teal-500"
                />
                <span className="text-[12px] font-bold text-gray-500">g ・ わかれば(任意)</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 単位⇔g切替 */}
            <div className="mb-3 flex rounded-[10px] bg-gray-100 p-0.5">
              {(["unit", "g"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCur((d) => (d ? { ...d, mode: m } : d))}
                  className={`flex-1 rounded-lg py-1.5 text-center text-[12.5px] font-bold ${
                    cur.mode === m ? "bg-white text-teal-700 shadow-sm" : "text-gray-500"
                  }`}
                >
                  {m === "unit" ? `${cur.unitLabel || "単位"}で入力` : "gで入力"}
                </button>
              ))}
            </div>
            <div className="mb-1 flex h-[76px] items-center justify-center">
              {cur.mode === "unit" && cur.unitGrams > 0 ? (
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => stepQty(-1)}
                    className="h-[52px] w-[52px] rounded-full bg-teal-50 text-2xl font-bold text-teal-700 shadow-[0_2px_0_#b5e0da]"
                  >
                    −
                  </button>
                  <div className="min-w-[120px] text-center">
                    <b className="text-[28px] font-extrabold">{qty}</b>
                    <span className="block text-[11.5px] text-gray-500">
                      {cur.unitLabel} ・ 約{Math.round(grams)}g
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => stepQty(1)}
                    className="h-[52px] w-[52px] rounded-full bg-teal-50 text-2xl font-bold text-teal-700 shadow-[0_2px_0_#b5e0da]"
                  >
                    ＋
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <input
                    inputMode="numeric"
                    value={Math.round(grams) || ""}
                    onChange={(e) => {
                      const g = parseFloat(e.target.value) || 0;
                      if (g > 0) setCur((d) => (d ? scaleTo(d, g) : d));
                    }}
                    className="w-[120px] rounded-xl border-2 border-teal-500 p-3 text-center text-[22px] font-extrabold outline-none"
                  />
                  <span className="text-[14px] font-bold text-gray-500">g</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* 計算値 */}
        <div className="text-center text-[13px] text-gray-500">
          <b className="text-2xl font-extrabold text-teal-700">{v ? Math.round(v.kcal) : "--"}</b> kcal
        </div>
        <div className="mb-2.5 flex justify-center gap-4 text-[12px] text-gray-500">
          <span>P <b className="text-gray-900">{v ? r1(v.p) : "--"}</b>g</span>
          <span>F <b className="text-gray-900">{v ? r1(v.f) : "--"}</b>g</span>
          <span>C <b className="text-gray-900">{v ? r1(v.c) : "--"}</b>g</span>
        </div>

        {/* 内訳(表の積算品) */}
        {!cur.customFree && cur.recipe && cur.recipe.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setUwOpen((o) => !o)}
              className="mb-2 w-full rounded-[10px] border border-teal-600 bg-white py-2 text-[12.5px] font-bold text-teal-700"
            >
              内訳を見る・整える
            </button>
            {uwOpen && (
              <div className="mb-3 rounded-[14px] bg-teal-50 p-3">
                <div className="mb-1 text-[11.5px] font-bold text-teal-700">
                  この数値の想定(量の変更も、この内訳と連動しています)
                </div>
                {renderColTabs()}
                {renderMatRows(cur.recipe, true)}
                {renderMatAdd(true)}
                <div className="mt-1.5 text-[10.5px] leading-relaxed text-gray-500">
                  −＋は1g刻み・数字をタップすると直接入力。×で材料を外せます。{cur.unitLabel}・gの変更もこの内訳が伸び縮みして計算されます。
                </div>
              </div>
            )}
          </>
        )}
        {!cur.customFree && isSekisan && !cur.recipe && (
          <div className="mb-2.5 text-[10.5px] text-gray-500">{recipeLoading ? "内訳を読み込み中…" : ""}</div>
        )}
        {!cur.customFree && cur.method === "市販平均" && (
          <div className="mb-2.5 text-[10.5px] text-gray-500">
            市販品の平均値です(お手元の商品の表示があればそちらが正確)。
          </div>
        )}

        {/* カスタムの組み立てB */}
        {cur.customFree && (
          <div className="mb-3 rounded-[14px] bg-teal-50 p-3">
            <div className="mb-1 text-[11.5px] font-bold text-teal-700">
              中身を表から組み立てる(足した分だけ自動計算・緑)
            </div>
            {cur.mats.length > 0 && renderColTabs()}
            {renderMatRows(cur.mats, false)}
            {renderMatAdd(false)}
            {cur.mats.length > 0 && (
              <div className="mt-1.5 text-[10.5px] text-gray-500">−＋は1g刻み・数字をタップで直接入力・×で外す。</div>
            )}
          </div>
        )}

        {renderManual4()}
        {err && <div className="mb-2 text-[12px] font-bold text-red-600">{err}</div>}
        <button
          type="button"
          onClick={commitQty}
          className="w-full rounded-[13px] bg-teal-500 py-3 text-[14.5px] font-extrabold text-white shadow-[0_3px_0_#0f766e]"
        >
          {editIdx != null ? "変更を保存" : "この内容で追加"}
        </button>
        <button
          type="button"
          onClick={() => {
            setCur(null);
            setEditIdx(null);
            setView(editIdx != null ? "cart" : "search");
          }}
          className="mt-2 w-full py-1.5 text-center text-[12px] text-gray-500"
        >
          もどる
        </button>
      </div>
    );
  }

  // ─── ビュー: カート(たまり場) ───
  return (
    <div className="max-h-[78vh] overflow-y-auto pb-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-extrabold">
          {isEdit ? "" : "今日の"}
          {MEAL_LABEL[mealType]} ({cart.length}品)
        </h3>
        <div className="text-[13px] font-extrabold text-teal-700">{cartSum.kcal} kcal</div>
      </div>
      {cartSum.noVal > 0 && (
        <div className="mb-2 text-[10.5px] leading-relaxed text-gray-500">
          「--」は数値なしの記録です(合計には入りません。写真とメモでのりが見ます)。
        </div>
      )}
      {cart.map((d, i) => {
        const v = calcDraft(d);
        const grams = draftGrams(d);
        return (
          <div key={d.key} className="flex items-center gap-2 border-t border-dashed border-gray-200 py-2 first:border-t-0">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                if (d.customFree) openCustom("", i);
                else {
                  const f = d.foodId ? foodById.get(d.foodId) : null;
                  if (f) void openQty(f, i);
                }
              }}
            >
              <div className="truncate text-[13.5px] font-bold">
                {d.customFree ? d.name : d.name.replace(/\s+\S+$/, "")}
              </div>
              <div className="text-[11px] text-gray-500">
                {grams ? `約${Math.round(grams)}g` : "量は未記入"} ・ タップで
                {d.customFree ? "名前・中身・数値を編集" : "量・内訳を編集"}
              </div>
            </button>
            <div className="flex-none text-[14px] font-extrabold text-gray-700">
              {v ? Math.round(v.kcal) : "--"}
            </div>
            <button
              type="button"
              onClick={() => setCart((c) => c.filter((_, j) => j !== i))}
              className="h-6 w-6 flex-none rounded-md bg-red-100 text-[12px] font-bold text-red-700"
            >
              ×
            </button>
          </div>
        );
      })}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={2}
        placeholder="メモ(内訳や気づいたことを自由に)"
        className="mb-2.5 mt-2 w-full rounded-xl border border-gray-200 p-2.5 text-[13px] outline-none focus:border-teal-500"
      />
      {err && <div className="mb-2 text-[12px] font-bold text-red-600">{err}</div>}
      <button
        type="button"
        disabled={saving || !cart.length}
        onClick={() => void save()}
        className="w-full rounded-[13px] bg-teal-500 py-3 text-[14.5px] font-extrabold text-white shadow-[0_3px_0_#0f766e] disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存する"}
      </button>
      <button
        type="button"
        onClick={() => setView("search")}
        className="mt-2 w-full py-1.5 text-center text-[12px] text-gray-500"
      >
        ＋ 品を追加しに戻る
      </button>
      {mealType === "夕" && !isEdit && (
        <div className="mt-1.5 text-center text-[10.5px] text-gray-500">
          夕食の保存後は、生活記録4問に進みます
        </div>
      )}
    </div>
  );
}
