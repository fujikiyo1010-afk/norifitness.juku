"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/app/record/BottomSheet";
import { createMealLog, updateMealLog, deleteMealLog, type MealItemInput } from "@/lib/meals/actions";
import { uploadMealPhoto, UploadError } from "@/lib/meals/photo-upload";
import {
  sumMeals,
  MEAL_TYPES,
  MEAL_LABEL,
  type MealItem,
  type MealLog,
  type MealType,
  type FoodItem,
} from "@/lib/meals/types";
import { MealSheetV2 } from "./MealSheetV2";
import { LifeConditionForm } from "./LifeConditionForm";
import {
  hasAnyCondition,
  CONDITION_LABEL,
  BOWEL_LABEL,
  ALCOHOL_LABEL,
  type DailyConditionData,
} from "@/lib/conditions/types";

/**
 * 食事 1日の画面 V2(完全新装・2026-08-19)。見た目の正 = public/mock/meal-v2-shinso.html。
 *  - 週チップ(下線型)+日付ナビ・未来日ブロック
 *  - サマリー: リング+PFCバー(薄ティール)・目標超過は「超過分だけ琥珀」
 *  - 生活記録は上部コンパクト1行(b2固定)
 *  - 食事カード: 品ごとPFC右2段+写真サムネ横並び+「＋追加」/未記録は記録ボタン横のカメラ(写真だけ記録)
 *  - 週7日分を先読みしてクライアント切替(週外はページ遷移)
 */

type MealWithUrls = MealLog & { photoUrls: string[] };
export type TargetPFC = { kcal: number | null; p: number | null; f: number | null; c: number | null };
export type DayData = {
  date: string;
  meals: MealWithUrls[];
  condition: DailyConditionData | null;
  feedback: string | null;
};

const DAY = 86_400_000;
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const MEAL_TYPE_CODE: Record<MealType, string> = { 朝: "breakfast", 昼: "lunch", 夕: "dinner", 間: "snack" };

function shiftDate(date: string, d: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + d * DAY).toISOString().slice(0, 10);
}
function labelDate(date: string): string {
  const dt = new Date(`${date}T00:00:00Z`);
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}(${DOW[dt.getUTCDay()]})`;
}
function timeLabel(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
const r1 = (x: number) => Math.round(x * 10) / 10;

/** MealItem(読み取り) → MealItemInput(書き込み)。スナップショットをそのまま写す */
function itemsToInput(items: MealItem[]): MealItemInput[] {
  return items.map((it) => ({
    name: it.name,
    source: it.source,
    food_table_id: it.food_table_id,
    quantity: it.quantity,
    unit: it.unit,
    kcal: it.kcal,
    protein_g: it.protein_g,
    fat_g: it.fat_g,
    carb_g: it.carb_g,
    grams: it.grams ?? null,
    recipe_snapshot: it.recipe_snapshot ?? null,
  }));
}

export function DayDetailV2({
  initialDate,
  today,
  week,
  target = null,
  userId,
  canEditPast = false,
  askYesterday = null,
  foods = [],
  autoOpenLife = false,
}: {
  initialDate: string;
  today: string;
  week: DayData[]; // 日〜土の7日分(選択日を含む週)
  target?: TargetPFC | null;
  userId: string;
  canEditPast?: boolean;
  askYesterday?: string | null;
  foods?: FoodItem[];
  autoOpenLife?: boolean;
}) {
  const router = useRouter();
  const [selDate, setSelDate] = useState(initialDate);
  const [sheet, setSheet] = useState<{ mealType: MealType; editLog: MealWithUrls | null } | null>(null);
  const [lifeSheet, setLifeSheet] = useState<{ date: string; initial: DailyConditionData | null } | null>(
    autoOpenLife ? { date: initialDate, initial: week.find((d) => d.date === initialDate)?.condition ?? null } : null
  );
  const [toast, setToast] = useState<string | null>(null);
  const [photoView, setPhotoView] = useState<{ url: string; path: string; logId: string } | null>(null);
  const [uploading, setUploading] = useState<MealType | null>(null);
  const pendingType = useRef<MealType | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startDelete] = useTransition();

  const byDate = new Map(week.map((d) => [d.date, d]));
  const day: DayData = byDate.get(selDate) ?? { date: selDate, meals: [], condition: null, feedback: null };
  const isToday = selDate === today;
  const editable = isToday || (canEditPast && !isToday);
  const conditionRecorded = hasAnyCondition(day.condition);

  const total = sumMeals(day.meals);
  const byType = new Map<MealType, MealWithUrls[]>();
  for (const m of day.meals) {
    const arr = byType.get(m.meal_type) ?? [];
    arr.push(m);
    byType.set(m.meal_type, arr);
  }

  // ─── 週内はクライアント切替(URLだけ書き換え)・週外はページ遷移 ───
  function selectDate(ds: string) {
    if (ds > today) return;
    if (byDate.has(ds)) {
      setSelDate(ds);
      window.history.replaceState(null, "", `/meals?date=${ds}`);
    } else {
      router.push(`/meals?date=${ds}`);
    }
  }

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  }
  function onSaved(msg: string) {
    const savedType = sheet?.mealType;
    setSheet(null);
    showToast(msg);
    router.refresh();
    if (savedType === "夕" && isToday && !conditionRecorded) {
      setTimeout(() => setLifeSheet({ date: selDate, initial: null }), 350);
    }
  }
  function onLifeDone(msg: string) {
    setLifeSheet(null);
    showToast(msg);
    router.refresh();
  }
  function onDeleteLog(id: string) {
    startDelete(async () => {
      const r = await deleteMealLog(id);
      if (r.ok) {
        showToast("削除しました");
        router.refresh();
      }
    });
  }

  // ─── 写真(カード一本化) ───
  function pickPhoto(t: MealType) {
    pendingType.current = t;
    fileRef.current?.click();
  }
  async function onPhotoPicked(file: File | null) {
    const t = pendingType.current;
    pendingType.current = null;
    if (!t || !file) return;
    setUploading(t);
    try {
      const path = await uploadMealPhoto(userId, selDate, MEAL_TYPE_CODE[t], file);
      const logs = byType.get(t) ?? [];
      if (logs.length > 0) {
        const tgt = logs[0];
        const res = await updateMealLog(tgt.id, {
          memo: tgt.memo,
          photos: [...tgt.photos, path],
          items: itemsToInput(tgt.items),
        });
        if (!res.ok) throw new UploadError("save", res.message ?? "保存に失敗しました");
      } else {
        const res = await createMealLog({ date: selDate, meal_type: t, photos: [path], items: [] });
        if (!res.ok) throw new UploadError("save", res.message ?? "保存に失敗しました");
      }
      showToast("写真を追加しました");
      router.refresh();
      if (t === "夕" && isToday && !conditionRecorded && (byType.get("夕") ?? []).length === 0) {
        setTimeout(() => setLifeSheet({ date: selDate, initial: null }), 350);
      }
    } catch (e) {
      showToast(e instanceof UploadError ? e.userMessage : "写真の保存に失敗しました");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function removePhoto() {
    if (!photoView) return;
    const log = day.meals.find((m) => m.id === photoView.logId);
    setPhotoView(null);
    if (!log) return;
    const rest = log.photos.filter((p) => p !== photoView.path);
    if (rest.length === 0 && log.items.length === 0 && !log.memo) {
      await deleteMealLog(log.id);
    } else {
      await updateMealLog(log.id, { memo: log.memo, photos: rest, items: itemsToInput(log.items) });
    }
    showToast("写真を外しました");
    router.refresh();
  }

  // ─── 週チップ(下線型) ───
  const baseMs = Date.parse(`${selDate}T00:00:00Z`);
  const sundayMs = baseMs - new Date(baseMs).getUTCDay() * DAY;
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const ds = new Date(sundayMs + i * DAY).toISOString().slice(0, 10);
    const d = byDate.get(ds);
    return { ds, dow: i, num: new Date(sundayMs + i * DAY).getUTCDate(), hasRec: (d?.meals.length ?? 0) > 0 };
  });

  const goalK = target?.kcal ?? null;
  const kr = goalK ? total.kcal / goalK : 0;

  return (
    <div className="space-y-3 pb-6">
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full bg-teal-800 px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
          {toast}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPhotoPicked(e.target.files?.[0] ?? null)}
      />

      {/* 日付ナビ(モック カレンダー案2) */}
      <div className="flex items-center justify-end gap-1.5">
        {!isToday && (
          <button
            type="button"
            onClick={() => selectDate(today)}
            className="mr-auto rounded-full border border-teal-500 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-700"
          >
            今日へ
          </button>
        )}
        <button
          type="button"
          onClick={() => selectDate(shiftDate(selDate, -1))}
          className="h-7 w-7 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-500"
        >
          &lt;
        </button>
        <span className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[13.5px] font-bold">
          {labelDate(selDate)}
        </span>
        <button
          type="button"
          onClick={() => selectDate(shiftDate(selDate, 1))}
          disabled={selDate >= today}
          className="h-7 w-7 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-500 disabled:opacity-35"
        >
          &gt;
        </button>
      </div>

      {/* 週チップ(下線型・記録ドット・未来薄く) */}
      <div className="flex">
        {weekDays.map((d) => {
          const selected = d.ds === selDate;
          const future = d.ds > today;
          return (
            <button
              key={d.ds}
              type="button"
              disabled={future}
              onClick={() => selectDate(d.ds)}
              className={`relative flex-1 border-b-[2.5px] pb-1.5 pt-1 text-center ${
                selected ? "border-teal-700" : "border-transparent"
              } ${future ? "opacity-40" : ""}`}
            >
              <span className="block text-[9.5px] text-gray-500">{DOW[d.dow]}</span>
              <span className={`block text-[15px] font-bold ${selected ? "font-extrabold text-teal-700" : "text-gray-700"}`}>
                {d.num}
              </span>
              {d.hasRec && !selected && (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-teal-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* サマリー(リング+バー・超過は超過分だけ琥珀) */}
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4">
        <div className="relative h-[118px] w-[118px] flex-none">
          <svg width="118" height="118" viewBox="0 0 118 118" className="-rotate-90">
            <circle cx="59" cy="59" r="52" fill="none" stroke="#eef1f1" strokeWidth="10" />
            {total.kcal > 0 && goalK != null && (
              <circle
                cx="59"
                cy="59"
                r="52"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${327 * Math.min(1, kr)} 327`}
                style={{ transition: "stroke-dasharray .5s" }}
              />
            )}
            {goalK != null && kr > 1 && (
              <circle
                cx="59"
                cy="59"
                r="52"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${327 * Math.min(1, kr - 1)} 327`}
                style={{ transition: "stroke-dasharray .5s" }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-[23px] font-extrabold leading-none">{total.kcal.toLocaleString()}</b>
            <span className="mt-1 text-[10px] text-gray-500">
              {goalK != null ? `/ ${goalK.toLocaleString()} kcal` : "kcal"}
            </span>
            {goalK != null && kr > 1 && (
              <span className="mt-0.5 text-[10px] font-extrabold text-[#b45309]">+{total.kcal - goalK}</span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <GaugeBar label="たんぱく質" value={total.p} tgt={target?.p ?? null} />
          <GaugeBar label="脂質" value={total.f} tgt={target?.f ?? null} />
          <GaugeBar label="炭水化物" value={total.c} tgt={target?.c ?? null} />
          {total.noValueCount > 0 && (
            <p className="text-[9.5px] text-gray-400">数値ありの品だけ集計(ほか{total.noValueCount}品は写真・名前のみ)</p>
          )}
        </div>
      </div>

      {/* 生活記録(b2固定・上部コンパクト1行) */}
      <button
        type="button"
        disabled={!editable}
        onClick={() => setLifeSheet({ date: selDate, initial: day.condition })}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 text-left disabled:opacity-70"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-x-3.5 gap-y-0.5 text-[11.5px] text-gray-700">
          <span>
            睡眠 <b>{day.condition?.sleepHours != null ? `${day.condition.sleepHours}h` : "−"}</b>
          </span>
          <span>
            体調 <b>{day.condition?.condition ? CONDITION_LABEL[day.condition.condition] : "−"}</b>
          </span>
          <span>
            お通じ <b>{day.condition?.bowel ? BOWEL_LABEL[day.condition.bowel] : "−"}</b>
          </span>
          <span>
            お酒 <b>{day.condition?.alcohol ? ALCOHOL_LABEL[day.condition.alcohol] : "−"}</b>
          </span>
        </span>
        {editable && (
          <span className="flex-none text-[11.5px] font-extrabold text-teal-700">
            {conditionRecorded ? "編集 >" : "記録する >"}
          </span>
        )}
      </button>

      {/* のりコメント */}
      {day.feedback && (
        <div className="rounded-2xl bg-teal-50 px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[9px] font-bold text-white">のりから</span>
            <span className="text-[10px] text-gray-500">この日の記録へのコメント</span>
          </div>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{day.feedback}</p>
        </div>
      )}

      {/* 翌日補完 */}
      {editable && isToday && askYesterday && (
        <button
          type="button"
          onClick={() => setLifeSheet({ date: askYesterday, initial: null })}
          className="flex w-full items-center justify-between rounded-2xl border border-[#f0e2b8] bg-[#fffbeb] px-4 py-3 text-left"
        >
          <span className="text-[12px] font-bold text-[#8a6d1a]">昨日の調子だけ教えてください</span>
          <span className="text-[12px] font-bold text-[#8a6d1a]">記録する →</span>
        </button>
      )}

      {/* 食事カード(タイプ単位) */}
      {MEAL_TYPES.map((t) => (
        <TypeCard
          key={t}
          type={t}
          logs={byType.get(t) ?? []}
          editable={editable}
          uploading={uploading === t}
          onAdd={() => setSheet({ mealType: t, editLog: null })}
          onEdit={(m) => setSheet({ mealType: t, editLog: m })}
          onDelete={onDeleteLog}
          onCamera={() => pickPhoto(t)}
          onOpenPhoto={(url, path, logId) => setPhotoView({ url, path, logId })}
          dinnerHint={t === "夕" && isToday}
        />
      ))}

      {!editable && <p className="text-center text-[11px] text-gray-400">過去の記録は閲覧のみです。</p>}

      <p className="mt-2 border-t border-gray-200 pt-3 text-[10px] leading-relaxed text-gray-400">
        数値は目安です。日本食品標準成分表(八訂)ほかを元にした平均値で、実際の食事とは差があります。
        持病・服薬がある方の食事調整は必ず医師の判断に従ってください。本サービスは医療行為・診断を行うものではありません。
      </p>

      {/* 投稿/編集シート */}
      <BottomSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet ? `${MEAL_LABEL[sheet.mealType]}を記録` : undefined}
      >
        {sheet && (
          <MealSheetV2
            userId={userId}
            date={selDate}
            mealType={sheet.mealType}
            editLog={sheet.editLog}
            foods={foods}
            onClose={() => setSheet(null)}
            onSaved={onSaved}
          />
        )}
      </BottomSheet>

      {/* 生活記録シート(4問) */}
      <BottomSheet open={!!lifeSheet} onClose={() => setLifeSheet(null)} title="今日の調子">
        {lifeSheet && (
          <LifeConditionForm
            date={lifeSheet.date}
            initial={lifeSheet.initial}
            title={lifeSheet.date === today ? "今日の調子は？" : "昨日の調子は？"}
            onDone={onLifeDone}
            onSkip={() => setLifeSheet(null)}
          />
        )}
      </BottomSheet>

      {/* 写真拡大 */}
      {photoView && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5"
          onClick={() => setPhotoView(null)}
        >
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoView.url} alt="" className="max-h-[60vh] w-full rounded-xl object-contain" />
            <p className="mt-2 text-[10.5px] text-gray-500">のりも同じ写真を見て添削します。</p>
            {editable && (
              <button
                type="button"
                onClick={() => void removePhoto()}
                className="mt-2.5 w-full rounded-xl border-[1.5px] border-red-300 bg-white py-2.5 text-[12.5px] font-bold text-red-700"
              >
                この写真を外す
              </button>
            )}
            <button
              type="button"
              onClick={() => setPhotoView(null)}
              className="mt-2 w-full py-1.5 text-center text-[12px] text-gray-500"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ゲージバー(超過は超過分だけ琥珀) ───
function GaugeBar({ label, value, tgt }: { label: string; value: number; tgt: number | null }) {
  const over = tgt != null && value > tgt;
  const pct = tgt && tgt > 0 ? Math.min(100, (value / tgt) * 100) : value > 0 ? 100 : 0;
  const overPct = over && value > 0 ? (1 - (tgt as number) / value) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11.5px]">
        <b className="font-bold">{label}</b>
        <span className="text-gray-500">
          {over ? (
            <>
              <b className="font-extrabold text-[#b45309]">{Math.round(value)}</b> / {tgt}g{" "}
              <b className="font-extrabold text-[#b45309]">(+{Math.round(value - (tgt as number))})</b>
            </>
          ) : (
            <>
              {Math.round(value)}
              {tgt != null ? ` / ${tgt}g` : "g"}
            </>
          )}
        </span>
      </div>
      <div className="relative h-[7px] overflow-hidden rounded bg-[#eef1f1]">
        <div
          className="h-full rounded bg-[#5eead4]"
          style={{ width: `${pct}%`, transition: "width .4s" }}
        />
        {over && (
          <span
            className="absolute bottom-0 right-0 top-0 rounded-r bg-[#f59e0b]"
            style={{ width: `${overPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ─── 食事カード(タイプ単位・写真一本化) ───
function TypeCard({
  type,
  logs,
  editable,
  uploading,
  onAdd,
  onEdit,
  onDelete,
  onCamera,
  onOpenPhoto,
  dinnerHint,
}: {
  type: MealType;
  logs: MealWithUrls[];
  editable: boolean;
  uploading: boolean;
  onAdd: () => void;
  onEdit: (m: MealWithUrls) => void;
  onDelete: (id: string) => void;
  onCamera: () => void;
  onOpenPhoto: (url: string, path: string, logId: string) => void;
  dinnerHint: boolean;
}) {
  const isSnack = type === "間";
  const allPhotos = logs.flatMap((m) => m.photoUrls.map((url, i) => ({ url, path: m.photos[i], logId: m.id })));
  const allItems = logs.flatMap((m) => m.items);
  const sum = sumMeals(logs);
  const hasItems = allItems.length > 0;
  const photosOnly = !hasItems && allPhotos.length > 0;

  const camBtn = (
    <button
      type="button"
      onClick={onCamera}
      disabled={uploading}
      title="写真だけ記録"
      className="flex w-[46px] flex-none items-center justify-center rounded-xl border-[1.5px] border-gray-200 bg-white disabled:opacity-50"
    >
      {uploading ? (
        <span className="text-[10px] text-gray-400">…</span>
      ) : (
        <CamIcon className="h-[19px] w-[19px]" stroke="#0f766e" />
      )}
    </button>
  );

  const photoRow = (allPhotos.length > 0 || editable) && (logs.length > 0 || allPhotos.length > 0) && (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {allPhotos.map((p) => (
        <button
          key={p.path}
          type="button"
          onClick={() => onOpenPhoto(p.url, p.path, p.logId)}
          className="h-[58px] w-[58px] flex-none overflow-hidden rounded-[10px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
      {editable && (
        <button
          type="button"
          onClick={onCamera}
          disabled={uploading}
          className="flex h-[58px] w-[58px] flex-none flex-col items-center justify-center gap-0.5 rounded-[10px] border-[1.5px] border-dashed border-gray-300 bg-white text-[9px] font-bold text-gray-500 disabled:opacity-50"
        >
          <CamIcon className="h-[15px] w-[15px]" stroke="#6b7280" />
          {uploading ? "…" : "追加"}
        </button>
      )}
    </div>
  );

  // 完全未記録
  if (logs.length === 0) {
    if (!editable) {
      return (
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 opacity-70">
          <span className="text-[14px] font-bold">{MEAL_LABEL[type]}</span>
          <span className="text-[11px] text-gray-400">記録なし</span>
        </div>
      );
    }
    return (
      <div className="rounded-2xl bg-white p-3.5">
        <div className="mb-2 text-[14px] font-bold">{MEAL_LABEL[type]}</div>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="flex-1 rounded-xl bg-[#faf3dc] py-2.5 text-[13.5px] font-bold text-[#8a6d10]"
          >
            ＋ 記録する
          </button>
          {camBtn}
        </div>
        {dinnerHint && (
          <p className="mt-2 text-[11px] text-gray-500">
            カメラ=写真だけの記録(品選びなし)。夕食を保存すると、続けて今日の生活記録(4つの質問)に進みます。
          </p>
        )}
      </div>
    );
  }

  // 記録あり(写真のみ or 品あり)
  return (
    <div className="rounded-2xl bg-white p-3.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[14px] font-bold">
          {MEAL_LABEL[type]}
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-teal-700">記録済み</span>
        </span>
        {hasItems && sum.numberedCount > 0 && (
          <span className="text-[13px] font-bold text-teal-700">{sum.kcal} kcal</span>
        )}
      </div>

      {logs.map((m, li) => {
        const showTime = logs.length > 1;
        return (
          <div key={m.id} className={li > 0 ? "mt-1 border-t border-dashed border-gray-200 pt-1" : ""}>
            {showTime && <div className="mt-1 text-[10px] text-gray-400">{timeLabel(m.posted_at)}</div>}
            {m.items.length > 0 && (
              <ul>
                {m.items.map((x) => {
                  const noVal = x.kcal == null && x.protein_g == null && x.fat_g == null && x.carb_g == null;
                  return (
                    <li
                      key={x.id}
                      className="flex items-center justify-between gap-2.5 border-t border-dashed border-gray-100 py-1.5 text-[13px] first:border-t-0"
                    >
                      <span className="min-w-0 flex-1 truncate">{x.name}</span>
                      <span className="flex-none text-right">
                        <b className="block text-[13px] font-bold text-gray-700">
                          {noVal ? "--" : Math.round(x.kcal ?? 0)}
                        </b>
                        <small className="block text-[9.5px] text-gray-500">
                          {noVal ? "P-- F-- C--" : `P${r1(x.protein_g ?? 0)} F${r1(x.fat_g ?? 0)} C${r1(x.carb_g ?? 0)}`}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {m.memo && <div className="mt-0.5 text-[11px] italic text-gray-400">{m.memo}</div>}
            {editable && (
              <div className="mt-1 flex gap-3">
                <button type="button" onClick={() => onEdit(m)} className="text-[11px] font-bold text-teal-700">
                  {m.items.length > 0 ? "タップして記録し直す(量・内訳の再編集) →" : "＋ 品も記録する(数値が出ます)"}
                </button>
                <button type="button" onClick={() => onDelete(m.id)} className="text-[11px] text-gray-400">
                  削除
                </button>
              </div>
            )}
          </div>
        );
      })}

      {photoRow}

      {photosOnly && (
        <p className="mt-2 text-[11px] text-gray-500">写真のみの記録です(写真とメモをのりが見ます)。</p>
      )}
      {hasItems && sum.noValueCount > 0 && (
        <p className="mt-2 text-[10px] text-gray-500">「--」は数値なしの記録(写真・名前でのりが確認します)</p>
      )}
      {editable && isSnack && (
        <button type="button" onClick={onAdd} className="mt-2 text-[11.5px] font-bold text-teal-700">
          ＋ 間食を追加する(複数OK)
        </button>
      )}
    </div>
  );
}

function CamIcon({ className, stroke }: { className?: string; stroke: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}
