"use client";

import { useState } from "react";

/**
 * 管理: 食事の品目リスト(数値つき・管理画面A/2026-08-19)。
 * 品ごとに kcal/PFC+出どころバッジ。内訳(recipe_snapshot)がある品は行タップで材料明細を展開。
 * デイリー添削ページとユーザーハブ食事タブの両方から使う共通部品。
 */

export type AdminRecipeItem = {
  name: string;
  grams: number;
  kcal: number | null;
};

export type AdminMealItemData = {
  name: string;
  kcal: number | null;
  p: number | null;
  f: number | null;
  c: number | null;
  source: string | null; // table/built/manual/none
  grams: number | null;
  recipe: AdminRecipeItem[] | null;
};

const SOURCE_BADGE: Record<string, { label: string; cls: string; title: string }> = {
  table: { label: "表", cls: "bg-teal-50 text-teal-700", title: "表から自動計算" },
  built: { label: "組", cls: "bg-teal-50 text-teal-700", title: "材料から組み立て(自動計算)" },
  manual: { label: "手", cls: "bg-[#f6ecc8] text-[#8a6d10]", title: "本人の手入力(参考値)" },
  none: { label: "--", cls: "bg-zinc-100 text-zinc-400", title: "数値なし(写真・名前のみ)" },
};

const r1 = (x: number) => Math.round(x * 10) / 10;
// 未入力セルは「-」(0と区別。手入力がセル単位になった 2026-08-19 以降のデータで出る)
const cell = (x: number | null) => (x == null ? "-" : String(r1(x)));

/** 数値のある品だけの小計。無ければ null */
export function sumAdminItems(items: AdminMealItemData[]): { kcal: number; p: number; f: number; c: number } | null {
  const withVal = items.filter((i) => i.kcal != null || i.p != null || i.f != null || i.c != null);
  if (withVal.length === 0) return null;
  return {
    kcal: Math.round(withVal.reduce((s, i) => s + (i.kcal ?? 0), 0)),
    p: r1(withVal.reduce((s, i) => s + (i.p ?? 0), 0)),
    f: r1(withVal.reduce((s, i) => s + (i.f ?? 0), 0)),
    c: r1(withVal.reduce((s, i) => s + (i.c ?? 0), 0)),
  };
}

export function AdminMealItems({ items }: { items: AdminMealItemData[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sum = sumAdminItems(items);
  if (items.length === 0) return null;
  return (
    <div className="mt-1">
      {sum && items.length > 1 && (
        <div className="flex justify-end gap-2 pb-0.5 text-[10px] text-zinc-400">
          小計 <b className="font-bold text-zinc-600">{sum.kcal}kcal</b>
          <span>P{sum.p} F{sum.f} C{sum.c}</span>
        </div>
      )}
      {items.map((it, i) => {
        const noVal = it.kcal == null && it.p == null && it.f == null && it.c == null;
        const badge = SOURCE_BADGE[it.source ?? "none"] ?? SOURCE_BADGE.none;
        const expandable = (it.recipe?.length ?? 0) > 0;
        const isOpen = openIdx === i;
        return (
          <div key={i} className="border-t border-dashed border-zinc-100 first:border-t-0">
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="flex w-full items-center gap-2 py-1 text-left"
              title={badge.title}
            >
              <span
                className={`flex-none rounded px-1 py-0.5 text-[9px] font-bold leading-none ${badge.cls}`}
              >
                {badge.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-700">
                {it.name}
                {it.grams != null && <span className="ml-1 text-[10px] text-zinc-400">約{Math.round(it.grams)}g</span>}
                {expandable && (
                  <span className="ml-1 text-[9px] font-bold text-teal-700">{isOpen ? "内訳▲" : "内訳▼"}</span>
                )}
              </span>
              <span className="flex-none text-right">
                <b className="text-[11.5px] font-bold text-zinc-800">{it.kcal == null ? "--" : Math.round(it.kcal)}</b>
                <span className="ml-1 text-[9px] text-zinc-400">
                  {noVal ? "" : `P${cell(it.p)} F${cell(it.f)} C${cell(it.c)}`}
                </span>
              </span>
            </button>
            {isOpen && it.recipe && (
              <div className="mb-1 ml-6 rounded-md bg-zinc-50 px-2 py-1">
                {it.recipe.map((r, j) => (
                  <div key={j} className="flex justify-between gap-2 py-0.5 text-[10.5px] text-zinc-500">
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="flex-none">
                      {r1(r.grams)}g{r.kcal != null && <span className="ml-1.5">{Math.round(r.kcal)}kcal</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** その日の全食事の合計バー(数値あり品のみ集計)。品が全部数値なしなら出さない */
export function AdminDayMealTotal({ meals }: { meals: { items: AdminMealItemData[] }[] }) {
  const all = meals.flatMap((m) => m.items);
  const sum = sumAdminItems(all);
  if (!sum) return null;
  const noVal = all.filter((i) => i.kcal == null && i.p == null && i.f == null && i.c == null).length;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg bg-teal-50 px-3 py-1.5">
      <span className="text-[10px] font-bold text-teal-800">この日の合計</span>
      <b className="text-[13px] font-extrabold text-teal-800">{sum.kcal.toLocaleString()} kcal</b>
      <span className="text-[10.5px] text-teal-800">P{sum.p} ・ F{sum.f} ・ C{sum.c}</span>
      {noVal > 0 && <span className="text-[9.5px] text-zinc-500">(数値あり品のみ・ほか{noVal}品は写真/名前のみ)</span>}
    </div>
  );
}
