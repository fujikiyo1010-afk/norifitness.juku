"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/app/record/BottomSheet";
import { deleteMealLog } from "@/lib/meals/actions";
import { sumMeals, MEAL_TYPES, MEAL_LABEL, type MealLog, type MealType, type FoodItem } from "@/lib/meals/types";
import { MealSheet } from "./MealSheet";
import { LifeConditionForm } from "./LifeConditionForm";
import {
  hasAnyCondition,
  CONDITION_LABEL,
  BOWEL_LABEL,
  ALCOHOL_LABEL,
  type DailyConditionData,
} from "@/lib/conditions/types";

type MealWithUrls = MealLog & { photoUrls: string[] };
export type TargetPFC = { kcal: number | null; p: number | null; f: number | null; c: number | null };

const DAY = 86_400_000;

function shiftDate(date: string, d: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + d * DAY).toISOString().slice(0, 10);
}
function labelDate(date: string): string {
  const dt = new Date(`${date}T00:00:00Z`);
  const w = ["日", "月", "火", "水", "木", "金", "土"][dt.getUTCDay()];
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}（${w}）`;
}
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}
function nowPastNoonJST(): boolean {
  return new Date(Date.now() + 9 * 3600 * 1000).getUTCHours() >= 12;
}

export function DayDetail({
  date,
  meals,
  today,
  feedback = null,
  target = null,
  userId,
  condition = null,
  askYesterday = null,
  foods = [],
}: {
  date: string;
  meals: MealWithUrls[];
  today: string;
  feedback?: string | null;
  target?: TargetPFC | null;
  userId: string;
  condition?: DailyConditionData | null; // その日の生活記録(記録済みなら値)
  askYesterday?: string | null; // 翌日補完: 昨日の日付(聞くべきなら) or null
  foods?: FoodItem[]; // food_table(P4-b・自動計算)
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<{ mealType: MealType; editLog: MealWithUrls | null } | null>(null);
  const [lifeSheet, setLifeSheet] = useState<{ date: string; initial: DailyConditionData | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const conditionRecorded = hasAnyCondition(condition);

  const isToday = date === today;
  // FBが届いた日は編集ロック(当日は M6 に従い編集可)
  const locked = !isToday && !!feedback;
  const editable = isToday && !locked;

  const total = sumMeals(meals);
  const hasNumbers = total.numberedCount > 0;

  const byType = new Map<MealType, MealWithUrls[]>();
  for (const m of meals) {
    const arr = byType.get(m.meal_type) ?? [];
    arr.push(m);
    byType.set(m.meal_type, arr);
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
    // 夕食フォールバック(M13): 夕食保存後にその日の生活が未記録なら4問へ接ぎ木
    if (savedType === "夕" && isToday && !conditionRecorded) {
      setTimeout(() => setLifeSheet({ date, initial: null }), 350);
    }
  }
  function onLifeDone(msg: string) {
    setLifeSheet(null);
    showToast(msg);
    router.refresh();
  }
  function onDelete(id: string) {
    startDelete(async () => {
      const r = await deleteMealLog(id);
      if (r.ok) {
        showToast("削除しました");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 pb-6">
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 rounded-full bg-[#34603f] px-4 py-2 text-[12px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
          {toast}
        </div>
      )}

      {/* 日付ナビ */}
      <div className="flex items-center justify-between">
        <Link href={`/meals?date=${shiftDate(date, -1)}`} className="px-2 py-1 text-[13px] text-[#6a6256]">
          ◀ {labelDate(shiftDate(date, -1))}
        </Link>
        <span className="text-[14px] font-bold text-[#2b2620]">{isToday ? "今日" : labelDate(date)}</span>
        {date < today ? (
          <Link href={`/meals?date=${shiftDate(date, 1)}`} className="px-2 py-1 text-[13px] text-[#6a6256]">
            {labelDate(shiftDate(date, 1))} ▶
          </Link>
        ) : (
          <span className="w-16" />
        )}
      </div>

      {/* のりコメント */}
      {feedback && (
        <div className="rounded-2xl border border-[#d7e6db] bg-[#eef5f0] px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-[#4a875b] px-2 py-0.5 text-[9px] font-bold text-white">のりから</span>
            <span className="text-[10px] text-[#6a6256]">この日の記録へのコメント</span>
          </div>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#2b2620]">{feedback}</p>
        </div>
      )}

      {/* 合計ゲージ */}
      <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3">
        {hasNumbers ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-extrabold text-[#34603f]">{total.kcal}</span>
              <span className="text-[11px] text-[#a59b8c]">kcal</span>
              {target?.kcal != null && (
                <span className="text-[11px] text-[#6a6256]">／ 目標 {target.kcal.toLocaleString()}（のり監修）</span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <Bar label="P" value={total.p} tgt={target?.p ?? null} />
              <Bar label="F" value={total.f} tgt={target?.f ?? null} />
              <Bar label="C" value={total.c} tgt={target?.c ?? null} />
            </div>
            {total.noValueCount > 0 && (
              <p className="mt-1 text-[10px] text-[#a59b8c]">
                数値を入れた食事だけで計算（ほか {total.noValueCount} 品は写真・名前のみ）
              </p>
            )}
          </>
        ) : (
          <div className="text-[12px] text-[#6a6256]">
            {meals.length > 0
              ? "写真とメモで記録中（数値を入れた食事だけ合計します）"
              : "まだ記録がありません。下の枠から記録できます"}
          </div>
        )}
      </div>

      {/* 4スロット(縦) */}
      <div className="space-y-2">
        {MEAL_TYPES.map((t) => {
          const logs = byType.get(t) ?? [];
          const isSnack = t === "間";
          return (
            <div key={t}>
              {/* 記録済み(複数=間食) */}
              {logs.map((m) => (
                <Slot
                  key={m.id}
                  meal={m}
                  editable={editable}
                  locked={locked}
                  onEdit={() => setSheet({ mealType: t, editLog: m })}
                  onDelete={() => onDelete(m.id)}
                />
              ))}
              {/* 空き枠 or 間食の追加枠 */}
              {(logs.length === 0 || isSnack) && (
                <EmptySlot
                  type={t}
                  editable={editable}
                  isSnack={isSnack}
                  hasRecords={logs.length > 0}
                  onAdd={() => setSheet({ mealType: t, editLog: null })}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 翌日補完(M13): 昨日の生活が未入力なら1度だけ聞く */}
      {editable && askYesterday && (
        <button
          type="button"
          onClick={() => setLifeSheet({ date: askYesterday, initial: null })}
          className="flex w-full items-center justify-between rounded-2xl border border-[#f0e2b8] bg-[#fffbeb] px-4 py-3 text-left"
        >
          <span className="text-[12px] font-bold text-[#8a6d1a]">
            昨日の調子だけ教えてください
          </span>
          <span className="text-[12px] font-bold text-[#8a6d1a]">記録する →</span>
        </button>
      )}

      {/* 今日の生活(独立入力口・M13) */}
      <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3">
        <div className="mb-1.5 text-[12px] font-bold text-[#5b5344]">
          {isToday ? "今日の生活" : "この日の生活"}
        </div>
        {conditionRecorded && condition ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#2b2620]">
            {condition.sleepHours != null && (
              <span>
                <b className="font-mono">{condition.sleepHours}h</b>
                <span className="ml-1 text-[10px] text-[#a59b8c]">睡眠</span>
              </span>
            )}
            {condition.condition && (
              <span>
                {CONDITION_LABEL[condition.condition]}
                <span className="ml-1 text-[10px] text-[#a59b8c]">体調</span>
              </span>
            )}
            {condition.bowel && (
              <span>
                {BOWEL_LABEL[condition.bowel]}
                <span className="ml-1 text-[10px] text-[#a59b8c]">お通じ</span>
              </span>
            )}
            {condition.alcohol && (
              <span>
                {ALCOHOL_LABEL[condition.alcohol]}
                <span className="ml-1 text-[10px] text-[#a59b8c]">お酒</span>
              </span>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => setLifeSheet({ date, initial: condition })}
                className="text-[11px] font-bold text-[#4a875b]"
              >
                編集する →
              </button>
            )}
          </div>
        ) : editable ? (
          <button
            type="button"
            onClick={() => setLifeSheet({ date, initial: null })}
            className="text-[12px] font-bold text-[#4a875b]"
          >
            ＋ 今日の調子を記録（4問・約10秒）
          </button>
        ) : (
          <div className="text-[11px] text-[#a59b8c]">記録なし</div>
        )}
      </div>

      {!editable && (
        <p className="text-center text-[11px] text-[#a59b8c]">
          {locked
            ? "のりのコメントが届いた日の記録は編集できません。"
            : "過去の記録は閲覧のみです。"}
        </p>
      )}

      {/* 医療ただし書き */}
      <p className="mt-2 border-t border-[#efe7d6] pt-3 text-[10px] leading-relaxed text-[#a59b8c]">
        持病・服薬がある方の食事調整は必ず医師の判断に従ってください。本サービスは医療行為・診断を行うものではありません。
      </p>

      {/* 投稿/編集シート */}
      <BottomSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet ? `${MEAL_LABEL[sheet.mealType]}を記録` : undefined}
      >
        {sheet && (
          <MealSheet
            userId={userId}
            date={date}
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
            title={
              lifeSheet.date === today ? "今日の調子は？" : "昨日の調子は？"
            }
            onDone={onLifeDone}
            onSkip={() => setLifeSheet(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}

function Bar({ label, value, tgt }: { label: string; value: number; tgt: number | null }) {
  const pct = tgt && tgt > 0 ? Math.min(120, Math.round((value / tgt) * 100)) : 0;
  const over = tgt != null && value > tgt;
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[10px] font-bold text-[#6a6256]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#ece3d3]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: over ? "#c2693f" : "#4a875b" }}
        />
      </div>
      <span className="w-16 text-right text-[10px] text-[#6a6256]">
        {value}
        {tgt != null ? ` / ${tgt}g` : "g"}
      </span>
    </div>
  );
}

function Slot({
  meal,
  editable,
  locked,
  onEdit,
  onDelete,
}: {
  meal: MealWithUrls;
  editable: boolean;
  locked: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const s = sumMeals([meal]);
  return (
    <div className="mb-2 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3">
      <div className="flex items-start gap-3">
        {meal.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meal.photoUrls[0]} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[#f0ece2] text-[10px] text-[#a59b8c]">
            写真なし
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-bold text-[#2b2620]">{MEAL_LABEL[meal.meal_type]}</span>
            <span className="text-[10px] text-[#a59b8c]">{timeLabel(meal.posted_at)}</span>
            {s.numberedCount > 0 && <span className="text-[11px] text-[#6a6256]">{s.kcal}kcal</span>}
          </div>
          {meal.items.length > 0 && (
            <div className="mt-0.5 text-[11px] leading-relaxed text-[#6a6256]">
              {meal.items.map((i) => i.name).join("、")}
            </div>
          )}
          {s.numberedCount > 0 && (
            <div className="text-[10px] text-[#a59b8c]">
              P{s.p} ・ F{s.f} ・ C{s.c}
            </div>
          )}
          {meal.memo && <div className="mt-0.5 text-[11px] italic text-[#a59b8c]">{meal.memo}</div>}
          <div className="mt-1.5 flex gap-3">
            {editable ? (
              <>
                <button type="button" onClick={onEdit} className="text-[11px] font-bold text-[#4a875b]">
                  編集する →
                </button>
                <button type="button" onClick={onDelete} className="text-[11px] text-[#a59b8c]">
                  削除
                </button>
              </>
            ) : locked ? (
              <span className="text-[10px] text-[#a59b8c]">🔒 編集ロック中</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptySlot({
  type,
  editable,
  isSnack,
  hasRecords,
  onAdd,
}: {
  type: MealType;
  editable: boolean;
  isSnack: boolean;
  hasRecords: boolean;
  onAdd: () => void;
}) {
  const noonHint = type === "昼" && !hasRecords && nowPastNoonJST() && editable;
  if (!editable) {
    // 過去日/ロック日の空き枠は薄く「記録なし」
    if (hasRecords) return null;
    return (
      <div className="mb-2 flex items-center justify-between rounded-2xl border border-[#efe7d6] px-4 py-3">
        <span className="text-[12px] font-bold text-[#c9bfa9]">{MEAL_LABEL[type]}</span>
        <span className="text-[11px] text-[#d8cdba]">記録なし</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      className="mb-2 flex w-full items-center justify-between rounded-2xl border border-dashed border-[#d8cdba] px-4 py-3 text-left hover:bg-[#fffdf8]"
    >
      <span className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-[#6a6256]">{MEAL_LABEL[type]}</span>
        {noonHint && <span className="text-[10px] text-[#a59b8c]">12:00をすぎています</span>}
        {isSnack && <span className="text-[10px] text-[#a59b8c]">複数OK</span>}
      </span>
      <span className="text-[12px] font-bold text-[#4a875b]">＋ 追加する</span>
    </button>
  );
}
