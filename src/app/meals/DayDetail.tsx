"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteMealLog } from "@/lib/meals/actions";
import {
  sumMeals,
  MEAL_TYPES,
  MEAL_LABEL,
  type MealLog,
  type MealType,
} from "@/lib/meals/types";

type MealWithUrls = MealLog & { photoUrls: string[] };

const DAY = 86_400_000;

function shiftDate(date: string, deltaDays: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + deltaDays * DAY;
  return new Date(ms).toISOString().slice(0, 10);
}
function labelDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${w}）`;
}
function timeLabel(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

export function DayDetail({
  date,
  meals,
  today,
}: {
  date: string;
  meals: MealWithUrls[];
  today: string;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const editable = date === today;

  const total = sumMeals(meals);
  const hasNumbers = total.numberedCount > 0;

  // チップ: タイプごとの記録有無/件数
  const byType = new Map<MealType, MealWithUrls[]>();
  for (const m of meals) {
    const arr = byType.get(m.meal_type) ?? [];
    arr.push(m);
    byType.set(m.meal_type, arr);
  }

  function onDelete(id: string) {
    startDelete(async () => {
      const r = await deleteMealLog(id);
      setPendingDelete(null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3 pb-6">
      {/* 日付ナビ */}
      <div className="flex items-center justify-between">
        <Link
          href={`/meals?date=${shiftDate(date, -1)}`}
          className="rounded-lg px-2 py-1 text-[13px] text-[#6a6256]"
        >
          ◀ {labelDate(shiftDate(date, -1))}
        </Link>
        <span className="text-[14px] font-bold text-[#2b2620]">
          {date === today ? "今日" : labelDate(date)}
        </span>
        {date < today ? (
          <Link
            href={`/meals?date=${shiftDate(date, 1)}`}
            className="rounded-lg px-2 py-1 text-[13px] text-[#6a6256]"
          >
            {labelDate(shiftDate(date, 1))} ▶
          </Link>
        ) : (
          <span className="w-16" />
        )}
      </div>

      {/* 合計(数値があれば) */}
      <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3">
        {hasNumbers ? (
          <div className="flex items-baseline gap-3">
            <div className="text-[20px] font-extrabold text-[#34603f]">
              {total.kcal}
              <span className="ml-0.5 text-[11px] text-[#a59b8c]">kcal</span>
            </div>
            <div className="text-[12px] text-[#6a6256]">
              P{total.p} ・ F{total.f} ・ C{total.c}
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-[#6a6256]">
            {meals.length > 0
              ? "写真とメモで記録中（数値を入れた食事だけ合計します）"
              : "まだ記録がありません"}
          </div>
        )}
      </div>

      {/* チップナビ(朝昼夕間) */}
      <div className="flex gap-1.5">
        {MEAL_TYPES.map((t) => {
          const logs = byType.get(t) ?? [];
          const has = logs.length > 0;
          const extra = t === "間" && logs.length > 1 ? `+${logs.length - 1}` : "";
          return has ? (
            <a
              key={t}
              href={`#meal-${t}`}
              className="flex-1 rounded-xl bg-[#eef5f0] py-2 text-center"
            >
              <div className="text-[12px] font-bold text-[#34603f]">
                {t}
                {extra && <span className="ml-0.5 text-[10px]">{extra}</span>}
              </div>
              <div className="text-[10px] text-[#6a6256]">✓</div>
            </a>
          ) : editable ? (
            <Link
              key={t}
              href={`/meals/new?type=${t}&date=${date}`}
              className="flex-1 rounded-xl border border-dashed border-[#d8cdba] py-2 text-center"
            >
              <div className="text-[12px] font-bold text-[#a59b8c]">{t}</div>
              <div className="text-[13px] leading-none text-[#c9bfa9]">＋</div>
            </Link>
          ) : (
            <div
              key={t}
              className="flex-1 rounded-xl border border-[#efe7d6] py-2 text-center"
            >
              <div className="text-[12px] font-bold text-[#c9bfa9]">{t}</div>
              <div className="text-[11px] leading-none text-[#d8cdba]">—</div>
            </div>
          );
        })}
      </div>

      {/* 記録済みカード(記録済みのみ) */}
      {meals.map((m) => (
        <div
          key={m.id}
          id={`meal-${m.meal_type}`}
          className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3"
        >
          <div className="flex items-start gap-3">
            {m.photoUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.photoUrls[0]}
                alt=""
                className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[#f0ece2] text-[10px] text-[#a59b8c]">
                写真なし
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold text-[#2b2620]">
                  {MEAL_LABEL[m.meal_type]}
                </span>
                <span className="text-[10px] text-[#a59b8c]">
                  {timeLabel(m.posted_at)}
                </span>
              </div>
              {m.items.length > 0 && (
                <div className="mt-0.5 text-[11px] leading-relaxed text-[#6a6256]">
                  {m.items.map((i) => i.name).join("、")}
                </div>
              )}
              {m.memo && (
                <div className="mt-0.5 text-[11px] italic text-[#a59b8c]">
                  {m.memo}
                </div>
              )}
              {editable && (
                <div className="mt-1.5 flex gap-3">
                  <Link
                    href={`/meals/new?edit=${m.id}`}
                    className="text-[11px] font-bold text-[#4a875b]"
                  >
                    編集
                  </Link>
                  {pendingDelete === m.id ? (
                    <span className="flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onDelete(m.id)}
                        disabled={isDeleting}
                        className="font-bold text-red-700"
                      >
                        {isDeleting ? "削除中…" : "本当に削除"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="text-[#a59b8c]"
                      >
                        やめる
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(m.id)}
                      className="text-[11px] text-[#a59b8c]"
                    >
                      削除
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* 追加導線 */}
      {editable && (
        <Link
          href={`/meals/new?date=${date}`}
          className="block rounded-xl border-2 border-[#4a875b] bg-white py-2.5 text-center text-[13px] font-bold text-[#004d40]"
        >
          ＋ この日の食事を追加する
        </Link>
      )}
      {!editable && (
        <p className="text-center text-[11px] text-[#a59b8c]">
          のりのコメントが届いた日や過去の記録は編集できません。
        </p>
      )}

      {/* 医療ただし書き(常設) */}
      <p className="mt-2 border-t border-[#efe7d6] pt-3 text-[10px] leading-relaxed text-[#a59b8c]">
        持病・服薬がある方の食事調整は必ず医師の判断に従ってください。本サービスは医療行為・診断を行うものではありません。
      </p>
    </div>
  );
}
