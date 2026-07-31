"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarBodyMetric, CalendarWorkout } from "@/lib/calendar/queries";
import type { CalendarLearnedLesson, CalendarReview, CalendarBodyPhotoView } from "@/lib/calendar/queries";
import type { LastWatchedLesson } from "@/lib/member/last-watched";
import { CalendarBodyChart } from "./CalendarBodyChart";
import { BottomSheet } from "@/app/record/BottomSheet";
import { PhotoAddForm } from "@/app/record/photos/PhotoGallery";
import { sumMeals, MEAL_ORDER, type MealLog } from "@/lib/meals/types";
import {
  CONDITION_LABEL,
  BOWEL_LABEL,
  ALCOHOL_LABEL,
  hasAnyCondition,
  type DailyConditionData,
} from "@/lib/conditions/types";

/**
 * カレンダー(1日ビュー)の表示本体。
 * 週ストリップ + 体組成 + 食事 + トレ + 添削 + 生活 + 学習(振り返り束ね)。
 * ボディ写真カード・カルテ未提出カードは後続で追加。
 * 日付切替はサーバ再取得(Link)。体組成グラフの選択日ハイライトのみクライアント。
 */
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const PART_CLASS: Record<string, string> = {
  胸: "pc-chest",
  脚: "pc-leg",
  背中: "pc-back",
  肩: "pc-shoulder",
  腕: "pc-arm",
  腹筋: "pc-abs",
  お尻: "pc-hip",
  全身: "pc-full",
};

export type CalendarViewProps = {
  date: string;
  today: string;
  userId: string;
  body: CalendarBodyMetric;
  workout: CalendarWorkout;
  meals: (MealLog & { photoUrls: string[] })[];
  target: { kcal: number | null; p: number | null; f: number | null; c: number | null } | null;
  feedback: string | null;
  condition: DailyConditionData | null;
  learned: CalendarLearnedLesson[];
  reviews: CalendarReview[];
  learnStats: { completed: number; total: number };
  lastWatched: LastWatchedLesson | null;
  hasCarte: boolean;
  photoView: CalendarBodyPhotoView;
  recordedDates: string[];
  canBackdate: boolean; // 週間プール利用者=過去日記録(バックデート)可
};

const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const labelDate = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 (${WEEKDAYS[d.getUTCDay()]})`;
};

const photoMD = (ymd: string) => {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
};

const deltaText = (d: number | null) =>
  d == null ? "" : d <= 0 ? `▼ ${Math.abs(d)}` : `▲ ${d}`;

const setLabel = (sets: { kg: number | null; reps: number | null }[]) => {
  const reps = sets.map((s) => s.reps).filter((r): r is number => r != null);
  if (reps.length === 0) return "";
  const same = reps.every((r) => r === reps[0]);
  return same ? `${reps[0]}回×${reps.length}` : `${reps.join("·")}回`;
};

const pct = (v: number, t: number | null | undefined) =>
  t && t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;

export function CalendarDayView({
  date,
  today,
  userId,
  body,
  workout,
  meals,
  target,
  feedback,
  condition,
  learned,
  reviews,
  learnStats,
  lastWatched,
  hasCarte,
  photoView,
  recordedDates,
  canBackdate,
}: CalendarViewProps) {
  // 過去日(バックデート): その日 < 今日。当日は大ボタンを出さない(既存フロー)。
  const isPast = date < today;
  // 記録ありの過去日は「編集」でその記録を直接開く(log id 直参照)。
  const workoutLogId =
    workout.state === "done" || workout.state === "rest" ? workout.logId : null;
  const trainHeaderHref =
    canBackdate && isPast && workoutLogId
      ? `/workout/week/edit?edit=${workoutLogId}&date=${date}&from=list`
      : "/workout/week";
  const trainHeaderLabel = canBackdate && isPast && workoutLogId ? "編集 ›" : "記録 ›";
  const week = useMemo(() => {
    const base = new Date(`${date}T00:00:00Z`);
    const sundayMs = base.getTime() - base.getUTCDay() * 86_400_000;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sundayMs + i * 86_400_000);
      return { ds: d.toISOString().slice(0, 10), dnum: d.getUTCDate(), dow: i };
    });
  }, [date]);

  const router = useRouter();

  // 体型写真「その場で追加」: ＋タイル → ネイティブの撮る/ライブラリ → 追加シート(既存 PhotoAddForm 流用)
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pickedPhoto, setPickedPhoto] = useState<File | null>(null);
  const [photoAddOpen, setPhotoAddOpen] = useState(false);

  // 日付タップ → ドロップダウン月カレンダー(案A)。開閉と表示中の月をクライアント管理。
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => date.slice(0, 7)); // "YYYY-MM"
  const monthGrid = useMemo(() => {
    const [y, m] = pickerMonth.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = first.getUTCDay(); // 月初の曜日ぶん空セル
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: ({ ds: string; dnum: number; dow: number } | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${pickerMonth}-${String(d).padStart(2, "0")}`;
      cells.push({ ds, dnum: d, dow: (lead + d - 1) % 7 });
    }
    return { y, m, cells };
  }, [pickerMonth]);
  const shiftMonth = (delta: number) => {
    const [y, m] = pickerMonth.split("-").map(Number);
    const nd = new Date(Date.UTC(y, m - 1 + delta, 1));
    setPickerMonth(`${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const openPicker = () => {
    setPickerMonth(date.slice(0, 7));
    setPickerOpen((v) => !v);
  };

  const meal = useMemo(() => {
    const sorted = [...meals].sort((a, b) => MEAL_ORDER[a.meal_type] - MEAL_ORDER[b.meal_type]);
    const sum = sumMeals(meals);
    const photos = meals.flatMap((m) => m.photoUrls).slice(0, 6);
    const rows = sorted.map((log) => ({
      type: log.meal_type,
      names: log.items.map((it) => it.name).join("・"),
      kcal: Math.round(log.items.reduce((s, it) => s + (it.kcal ?? 0), 0)),
    }));
    return { sum, photos, rows, has: meals.length > 0 };
  }, [meals]);

  const kcalOffset = 207.3 * (1 - pct(meal.sum.kcal, target?.kcal) / 100);

  return (
    <div className="cal-root">
      <style>{CSS}</style>

      <div className="cal-hd">
        <Link className="navbtn" href={`/calendar?date=${shiftDate(date, -1)}`} aria-label="前日">‹</Link>
        <button type="button" className={`hdt ${pickerOpen ? "open" : ""}`} onClick={openPicker}>
          {labelDate(date)}
          <svg className="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {today > date ? (
          <Link className="navbtn" href={`/calendar?date=${shiftDate(date, 1)}`} aria-label="翌日">›</Link>
        ) : (
          <span className="navbtn dis">›</span>
        )}
      </div>

      {pickerOpen && (
        <>
          <button type="button" className="cal-pop-mask" aria-label="閉じる" onClick={() => setPickerOpen(false)} />
          <div className="cal-pop">
        <div className="dropdown">
          <div className="mgrid-head">
            <button type="button" className="mnav" onClick={() => shiftMonth(-1)} aria-label="前の月">‹</button>
            <span className="mtitle">{monthGrid.y}年 {monthGrid.m}月</span>
            <button type="button" className="mnav" onClick={() => shiftMonth(1)} aria-label="次の月">›</button>
          </div>
          <div className="mgrid">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`wl ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>{w}</div>
            ))}
            {monthGrid.cells.map((c, i) => {
              if (!c) return <div className="c" key={`e${i}`} />;
              const future = c.ds > today;
              const cls = ["c", c.dow === 0 ? "sun" : "", c.dow === 6 ? "sat" : "", c.ds === date ? "sel" : "", c.ds === today ? "today" : "", future ? "fut" : ""].filter(Boolean).join(" ");
              const dot = recordedDates.includes(c.ds) && !future ? <span className="rec" /> : null;
              return future ? (
                <div className={cls} key={c.ds}><span className="dd">{c.dnum}</span></div>
              ) : (
                <Link className={cls} key={c.ds} href={`/calendar?date=${c.ds}`}><span className="dd">{c.dnum}</span>{dot}</Link>
              );
            })}
          </div>
        </div>
          </div>
        </>
      )}

      <div className="week">
        {week.map((d) => {
          const isSel = d.ds === date;
          const future = d.ds > today;
          const cls = ["day", isSel ? "on" : "", d.dow === 0 ? "sun" : "", d.dow === 6 ? "sat" : "", future ? "future" : ""].filter(Boolean).join(" ");
          const inner = (
            <>
              <span className="w">{WEEKDAYS[d.dow]}</span>
              <span className="d">{d.dnum}</span>
              {recordedDates.includes(d.ds) && <span className="rec" />}
            </>
          );
          return future ? (
            <span key={d.ds} className={cls}>{inner}</span>
          ) : (
            <Link key={d.ds} className={cls} href={`/calendar?date=${d.ds}`}>{inner}</Link>
          );
        })}
      </div>

      <div className="cal-body">
        {/* 体組成 */}
        <div className="card">
          <div className="ch">
            <div className="l">
              <span className="hic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
              </span>
              体組成
            </div>
            <Link className="edit" href="/record">記録 ›</Link>
          </div>
          <div className="bm-legend">
            <span className="lg wt"><i className="dot" />体重</span>
            <span className="lg ws"><i className="dot" />ウエスト</span>
          </div>
          <CalendarBodyChart series={body.series} selectedDate={date} />
          <div className="bm3">
            <div className="n"><div className="k">体重</div><div className="v">{body.weight_kg ?? "—"}<small>kg</small></div><div className="df">{deltaText(body.weightDelta)}</div></div>
            <div className="n"><div className="k">体脂肪率</div><div className="v">{body.body_fat_percent ?? "—"}<small>%</small></div><div className="df">{deltaText(body.bodyFatDelta)}</div></div>
            <div className="n"><div className="k">ウエスト</div><div className="v">{body.waist_cm ?? "—"}<small>cm</small></div><div className="df">{deltaText(body.waistDelta)}</div></div>
          </div>
        </div>

        {/* 食事 */}
        <div className="card">
          <div className="ch">
            <div className="l">
              <span className="hic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v6M7.5 2v6M9 2v6M6 8a1.5 1.5 0 0 0 3 0M7.5 9.5V22" /><path d="M17 2c-1.4 0-2.3 2.3-2.3 5s.9 5 2.3 5 2.3-2.3 2.3-5S18.4 2 17 2zM17 12v10" /></svg>
              </span>
              食事
            </div>
            <Link className="edit" href={`/meals?date=${date}`}>編集 ›</Link>
          </div>
          {meal.has ? (
            <>
              <div className="kcal-row">
                <div className="kcal-ring">
                  <svg width="78" height="78" viewBox="0 0 78 78">
                    <circle cx="39" cy="39" r="33" fill="none" stroke="#f0e9db" strokeWidth="9" />
                    <circle cx="39" cy="39" r="33" fill="none" stroke="#4a875b" strokeWidth="9" strokeLinecap="round" strokeDasharray="207.3" strokeDashoffset={kcalOffset} transform="rotate(-90 39 39)" />
                  </svg>
                  <div className="ct"><b>{meal.sum.kcal}</b><span>{target?.kcal ? `/ ${target.kcal} kcal` : "kcal"}</span></div>
                </div>
                <div className="pfc">
                  <div className="p P"><span className="tag">P</span><div className="bar"><i style={{ width: `${pct(meal.sum.p, target?.p)}%` }} /></div><span className="val">{meal.sum.p}{target?.p ? ` / ${target.p}g` : "g"}</span></div>
                  <div className="p F"><span className="tag">F</span><div className="bar"><i style={{ width: `${pct(meal.sum.f, target?.f)}%` }} /></div><span className="val">{meal.sum.f}{target?.f ? ` / ${target.f}g` : "g"}</span></div>
                  <div className="p C"><span className="tag">C</span><div className="bar"><i style={{ width: `${pct(meal.sum.c, target?.c)}%` }} /></div><span className="val">{meal.sum.c}{target?.c ? ` / ${target.c}g` : "g"}</span></div>
                </div>
              </div>
              {meal.photos.length > 0 && (
                <div className="mphotos">
                  {meal.photos.map((u, i) => (
                    <div className="ph" key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={u} alt="食事" /></div>
                  ))}
                </div>
              )}
              <div className="mlist">
                {meal.rows.map((r, i) => (
                  <div className="mrow" key={i}><span className="ml">{r.type}</span><span className="nm">{r.names}</span><span className="kc">{r.kcal ? `${r.kcal}kcal` : ""}</span></div>
                ))}
              </div>
            </>
          ) : (
            <div className="none">
              <span className="emptic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v6M7.5 2v6M9 2v6M6 8a1.5 1.5 0 0 0 3 0M7.5 9.5V22" /><path d="M17 2c-1.4 0-2.3 2.3-2.3 5s.9 5 2.3 5 2.3-2.3 2.3-5S18.4 2 17 2zM17 12v10" /></svg></span>
              <div className="t">この日の食事記録なし</div>
            </div>
          )}
        </div>

        {/* トレーニング / カルテ未提出はカルテ提出カード */}
        {!hasCarte ? (
          <div className="card">
            <div className="ch"><div className="l"><span className="dumbbell" />トレーニング</div></div>
            <div className="carte-msg">あなた専用のトレメニューを作るために、まず<b>カルテ</b>に答えてください。提出後、のりfitnessがメニューを配布します。</div>
            <Link className="btn3d" href="/workout/carte/new">カルテを提出する</Link>
          </div>
        ) : (
        <div className="card">
          <div className="ch">
            <div className="l"><span className="dumbbell" />トレーニング</div>
            <div className="chr">
              {workout.state === "done" && workout.isCustom && <span className="star">★ じぶんメニュー</span>}
              <Link className="edit" href={trainHeaderHref}>{trainHeaderLabel}</Link>
            </div>
          </div>
          {workout.state === "rest" && (
            <div className="rest">
              <div className="cir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg></div>
              <div className="tx"><b>休養日</b><span>しっかり回復もトレーニングのうち</span></div>
            </div>
          )}
          {workout.state === "none" && (
            <div className="none"><span className="dumbbell-lg" /><div className="t">トレ記録なし</div></div>
          )}
          {/* 過去日 × 記録なし → その日を記録する大ボタン(当日は出さない=既存フロー) */}
          {canBackdate && isPast && workout.state === "none" && (
            <Link className="btn3d rec-btn" href={`/workout/week/select?date=${date}`}>この日のトレーニングを記録する</Link>
          )}
          {workout.state === "done" && (
            <>
              <div className="tiles">
                <div className="t"><div className="k">種目数</div><div className="v">{workout.exCount}<small>種目</small></div></div>
                <div className="t"><div className="k">実施部位</div><div className="chips">{workout.parts.length > 0 ? workout.parts.map((p, i) => (<span key={i} className={`pchip ${PART_CLASS[p] ?? ""}`}>{p}</span>)) : <span className="pchip">—</span>}</div></div>
              </div>
              {workout.exercises.map((e, i) => (
                <div className="exrow" key={i}>{e.part && <span className={`epart ${PART_CLASS[e.part] ?? ""}`}>{e.part}</span>}<span className="nm">{e.name}</span><span className="set">{setLabel(e.sets)}</span></div>
              ))}
              <Link className="menu-link" href="/workout">配布メニューを見る</Link>
            </>
          )}
          {/* 案あ-2: 記録の一覧・過去日を追加(カレンダーはカレンダーのまま、一覧は別画面) */}
          {canBackdate && (
            <Link className="menu-link sub" href="/workout/week/history">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
              記録の一覧・過去日を追加 ›
            </Link>
          )}
        </div>
        )}

        {/* 体型写真(入会時↔直近・常設。日付では変わらない) */}
        <div className="card">
          <div className="ch">
            <div className="l">
              <span className="hic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              </span>
              体型写真
            </div>
            {photoView.count > 0 && (
              <Link className="edit" href="/record/photos">一覧を見る（{photoView.count}枚）→</Link>
            )}
          </div>
          <div className="bp-sub">入会時と直近を並べて、見た目の変化を記録しましょう</div>
          <div className="bp-grid">
            {/* 入会時(最古・固定) */}
            <div className="bp-cell">
              <div className="bp-photo">
                <span className="bp-badge start">{photoView.count > 0 ? "入会時" : "記録"}</span>
                {photoView.first?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={photoView.first.url} alt="入会時" />
                ) : (
                  <span className="bp-silh"><svg viewBox="0 0 24 32" fill="currentColor"><ellipse cx="12" cy="5" rx="3.2" ry="3.6" /><path d="M12 9c-3.4 0-5.4 2.2-5.8 5.6-.3 2.4-.5 5.4-.5 8.4 0 3.2.3 6 .6 8H11l.3-8h1.4l.3 8h4.7c.3-2 .6-4.8.6-8 0-3-.2-6-.5-8.4C17.4 11.2 15.4 9 12 9z" /></svg></span>
                )}
              </div>
              <div className="bp-date">{photoView.first ? photoMD(photoView.first.recorded_at) : "—"}</div>
            </div>
            {/* その日時点(その日ちょうど or その日以前で最新) */}
            <div className="bp-cell">
              <div className="bp-photo">
                <span className="bp-badge now">直近</span>
                {photoView.asOf?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={photoView.asOf.url} alt="直近" />
                ) : (
                  <span className="bp-silh"><svg viewBox="0 0 24 32" fill="currentColor"><ellipse cx="12" cy="5" rx="3.2" ry="3.6" /><path d="M12 9c-3 0-4.9 1.8-5.4 4.8-.4 2.2-.6 5.2-.6 8.2 0 3.2.3 6 .6 8H11l.3-8h1.4l.3 8h4.7c.3-2 .6-4.8.6-8 0-3-.2-6-.6-8.2C16.9 10.8 15 9 12 9z" /></svg></span>
                )}
              </div>
              <div className="bp-date">{photoView.asOf ? photoMD(photoView.asOf.recorded_at) : "—"}</div>
            </div>
            {/* 追加 */}
            <div className="bp-cell">
              <button type="button" className="bp-add" onClick={() => photoInputRef.current?.click()}>
                <span className="plus">＋</span>
                <span className="lb">写真を追加して<br />変化を記録しよう</span>
              </button>
              <div className="bp-date">&nbsp;</div>
            </div>
          </div>
          {!photoView.asOfIsSameDay && (
            <div className="bp-note">この日の写真はありません。</div>
          )}

          {/* 「その場で追加」: 隠しファイル入力(ネイティブの撮る/ライブラリ) → 追加シート */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="bp-fileinput"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f) {
                setPickedPhoto(f);
                setPhotoAddOpen(true);
              }
            }}
          />
          <BottomSheet
            open={photoAddOpen}
            onClose={() => {
              setPhotoAddOpen(false);
              setPickedPhoto(null);
            }}
            title="写真を追加"
          >
            <PhotoAddForm
              userId={userId}
              initialFile={pickedPhoto}
              onSaved={() => {
                setPhotoAddOpen(false);
                setPickedPhoto(null);
                router.refresh();
              }}
            />
          </BottomSheet>
        </div>

        {/* 添削(のりコメント・その日ある時だけ) */}
        {feedback && (
          <div className="card nori">
            <div className="nh"><div className="av">の</div><div className="nt"><b>のりfitness</b><span>トレーナーからのコメント</span></div></div>
            <div className="tx">{feedback}</div>
          </div>
        )}

        {/* 生活記録 */}
        <div className="card">
          <div className="ch">
            <div className="l">
              <span className="hic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg>
              </span>
              生活記録
            </div>
            <Link className="edit" href={`/meals?date=${date}`}>編集 ›</Link>
          </div>
          {hasAnyCondition(condition) ? (
            <div className="life">
              <div className="lc"><span className="k">気分</span><span className="v">{condition?.condition ? CONDITION_LABEL[condition.condition] : "—"}</span></div>
              <div className="lc"><span className="k">睡眠</span><span className="v">{condition?.sleepHours != null ? `${condition.sleepHours}h` : "—"}</span></div>
              <div className="lc"><span className="k">お通じ</span><span className="v">{condition?.bowel ? BOWEL_LABEL[condition.bowel] : "—"}</span></div>
              <div className="lc"><span className="k">飲酒</span><span className="v">{condition?.alcohol ? ALCOHOL_LABEL[condition.alcohol] : "—"}</span></div>
            </div>
          ) : (
            <div className="none">
              <span className="emptic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" /></svg></span>
              <div className="t">この日の生活記録なし</div>
            </div>
          )}
        </div>

        {/* 学習 + 振り返り束ね */}
        <div className="card">
          <div className="ch">
            <div className="l">
              <span className="hic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              </span>
              学習
            </div>
          </div>
          {learned.length > 0 ? (
            learned.map((l) => (
              <div className="learn-row" key={l.lessonId}>
                <div className={`chk ${l.completed ? "" : "watch"}`}>
                  {l.completed ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                  )}
                </div>
                <div className="info"><div className="cc">{l.chapterTitle}</div><div className="ls">{l.title}</div></div>
                <span className={`tg ${l.completed ? "done" : "watch"}`}>{l.completed ? "完了" : "視聴中"}</span>
              </div>
            ))
          ) : (
            <div className="none">
              <span className="emptic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></span>
              <div className="t">この日の学習記録なし</div>
            </div>
          )}
          <div className="learn-foot">
            <span className="cum">累計 <b>{learnStats.completed}</b> / {learnStats.total} レッスン完了</span>
            {lastWatched ? (
              <Link className="cont" href={lastWatched.href}>続きから ›</Link>
            ) : (
              <Link className="cont" href="/courses">学習をはじめる ›</Link>
            )}
          </div>
          {reviews.length > 0 && (
            <div className="review-note">
              {reviews[0].learned && (<><div className="q">学んだこと</div><div className="a">{reviews[0].learned}</div></>)}
              {reviews[0].next_action && (<><div className="q">次にやること</div><div className="a">{reviews[0].next_action}</div></>)}
              {!reviews[0].learned && !reviews[0].next_action && reviews[0].impressed && (<><div className="q">感じたこと</div><div className="a">{reviews[0].impressed}</div></>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.cal-root{--bg:#f9f5ed;--card:#fffdf8;--line:#e7dcc9;--ink:#2b2620;--ink2:#6a6256;--ink3:#a59b8c;--grn:#4a875b;--grn-d:#34603f;--grn-l:#eaf3ec;--blue:#3f6fd8;--amber:#e0a63f;--rose:#d8607a;max-width:460px;margin:0 auto;color:var(--ink);position:relative;}
.cal-root a{text-decoration:none;color:inherit;}
.cal-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;}
.cal-hd .hdt{font-size:16px;font-weight:800;color:var(--ink);display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:9px;background:none;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.cal-hd .hdt.open{background:#efe7d5;}
.cal-hd .hdt .caret{width:13px;height:13px;color:var(--ink3);transition:transform .2s;}
.cal-hd .hdt.open .caret{transform:rotate(180deg);}
.cal-hd .navbtn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:9px;font-size:20px;color:var(--ink2);}
.cal-hd .navbtn.dis{opacity:.3;}
/* 日付ピッカー: 上にふわっと浮くオーバーレイ(下の内容は動かない)。案1=白基調ミニマル(Googleカレンダー風)・選択丸だけ深緑 */
.cal-pop-mask{position:absolute;inset:0;z-index:20;background:none;border:none;padding:0;cursor:default;}
.cal-pop{position:absolute;left:14px;right:14px;top:50px;z-index:21;}
.dropdown{background:#fff;border:1px solid #ececef;border-radius:16px;padding:14px 13px 10px;box-shadow:0 14px 34px rgba(30,30,40,.20);}
.dropdown .mgrid-head{display:flex;align-items:center;justify-content:space-between;padding:0 2px 10px;}
.dropdown .mgrid-head .mnav{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:#5f6368;font-size:18px;background:none;border:none;cursor:pointer;}
.dropdown .mgrid-head .mtitle{font-size:13.5px;font-weight:800;color:#202124;}
.dropdown .mgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px 0;}
.dropdown .mgrid .wl{text-align:center;font-size:10px;font-weight:700;color:#70757a;padding-bottom:6px;}
.dropdown .mgrid .wl.sun{color:#d93025;}.dropdown .mgrid .wl.sat{color:#1a73e8;}
.dropdown .mgrid .c{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;}
.dropdown .mgrid .c .dd{width:33px;height:33px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13.5px;font-weight:600;color:#3c4043;}
.dropdown .mgrid .c.sun .dd{color:#d93025;}.dropdown .mgrid .c.sat .dd{color:#1a73e8;}
.dropdown .mgrid .c.sel .dd{background:var(--grn-d);color:#fff;font-weight:800;}
.dropdown .mgrid .c.today .dd{box-shadow:inset 0 0 0 1.5px var(--grn-d);color:var(--grn-d);}
.dropdown .mgrid .c.sel.today .dd{color:#fff;}
.dropdown .mgrid .c.fut .dd{color:#dadce0;}
.dropdown .mgrid .c .rec{width:4px;height:4px;border-radius:50%;background:var(--grn-d);position:absolute;bottom:2px;}
.dropdown .mgrid .c.sel .rec{background:#fff;}
.week{display:flex;gap:3px;padding:2px 8px 12px;}
.week .day{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0 8px;border-radius:13px;position:relative;}
.week .day .w{font-size:10px;color:var(--ink3);font-weight:700;}
.week .day .d{font-size:15px;font-weight:800;color:var(--ink);width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;}
.week .day.sat .w,.week .day.sat .d{color:var(--blue);}
.week .day.sun .w,.week .day.sun .d{color:#c2693f;}
.week .day.on .d{background:var(--grn);color:#fff;}
.week .day .rec{width:5px;height:5px;border-radius:50%;background:var(--grn);position:absolute;bottom:1px;}
.week .day.future{opacity:.4;}
.cal-body{padding:0 14px 28px;display:flex;flex-direction:column;gap:12px;}
.cal-root .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;}
.cal-root .ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
.cal-root .ch .l{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;}
.cal-root .ch .edit{font-size:11.5px;font-weight:700;color:var(--grn-d);}
.cal-root .ch .chr{display:flex;align-items:center;gap:8px;}
.cal-root .hic{width:19px;height:19px;color:var(--grn);display:inline-flex;}
.cal-root .hic svg{width:19px;height:19px;}
.cal-root .star{font-size:10px;font-weight:800;color:var(--grn-d);background:var(--grn-l);border-radius:99px;padding:3px 10px;}
.dumbbell{display:inline-block;width:19px;height:19px;background:var(--grn);-webkit-mask:url(/icons/nav/workout.svg) center/contain no-repeat;mask:url(/icons/nav/workout.svg) center/contain no-repeat;flex-shrink:0;}
.dumbbell-lg{display:inline-block;width:30px;height:30px;background:#cdc4b2;-webkit-mask:url(/icons/nav/workout.svg) center/contain no-repeat;mask:url(/icons/nav/workout.svg) center/contain no-repeat;margin:0 auto 6px;}
.bm-legend{display:flex;gap:14px;margin:2px 0 4px;}
.bm-legend .lg{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--ink2);}
.bm-legend .lg .dot{width:14px;height:3px;border-radius:2px;display:inline-block;}
.bm-legend .lg.wt .dot{background:#4a875b;}
.bm-legend .lg.ws .dot{background:#3f6fd8;}
.cal-root .empty{text-align:center;font-size:11.5px;color:var(--ink3);padding:14px 0;}
.bm3{display:flex;margin-top:12px;border-top:1px solid #f0e9db;padding-top:11px;}
.bm3 .n{flex:1;text-align:center;position:relative;}
.bm3 .n+.n::before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:1px;background:#efe7d5;}
.bm3 .k{font-size:10px;color:var(--ink2);font-weight:700;}
.bm3 .v{font-size:19px;font-weight:800;margin-top:2px;}
.bm3 .v small{font-size:10px;color:var(--ink3);font-weight:700;}
.bm3 .df{font-size:9.5px;font-weight:700;margin-top:1px;color:var(--grn);min-height:12px;}
.kcal-row{display:flex;align-items:center;gap:14px;}
.kcal-ring{width:78px;height:78px;flex-shrink:0;position:relative;}
.kcal-ring .ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.kcal-ring .ct b{font-size:18px;font-weight:800;line-height:1;}
.kcal-ring .ct span{font-size:8.5px;color:var(--ink3);font-weight:700;margin-top:2px;}
.pfc{flex:1;display:flex;flex-direction:column;gap:9px;}
.pfc .p{display:flex;align-items:center;gap:8px;font-size:11.5px;}
.pfc .p .tag{width:15px;font-weight:800;}
.pfc .p.P .tag{color:var(--blue);}.pfc .p.F .tag{color:var(--amber);}.pfc .p.C .tag{color:var(--rose);}
.pfc .bar{flex:1;height:6px;background:#f0e9db;border-radius:99px;overflow:hidden;}
.pfc .bar i{display:block;height:100%;border-radius:99px;}
.pfc .p.P .bar i{background:var(--blue);}.pfc .p.F .bar i{background:var(--amber);}.pfc .p.C .bar i{background:var(--rose);}
.pfc .val{font-size:11px;font-weight:800;width:62px;text-align:right;color:var(--ink2);}
.mphotos{display:flex;gap:7px;margin-top:12px;flex-wrap:wrap;}
.mphotos .ph{width:56px;height:56px;border-radius:11px;overflow:hidden;background:#ece5d6;}
.mphotos .ph img{width:100%;height:100%;object-fit:cover;display:block;}
.mlist{margin-top:11px;border-top:1px solid #f0e9db;padding-top:9px;display:flex;flex-direction:column;gap:7px;}
.mrow{display:flex;align-items:center;gap:8px;font-size:12px;}
.mrow .ml{font-size:9.5px;font-weight:800;color:var(--ink2);width:22px;flex-shrink:0;}
.mrow .nm{flex:1;color:var(--ink);}
.mrow .kc{font-weight:800;font-size:11.5px;}
.cal-root .nori{background:linear-gradient(180deg,#f4faf6,var(--card));border:1.5px solid #cfe3d6;}
.nori .nh{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.nori .av{width:30px;height:30px;border-radius:50%;background:var(--grn-d);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;}
.nori .nt b{font-size:12.5px;font-weight:800;color:var(--grn-d);display:block;}
.nori .nt span{font-size:9.5px;color:var(--ink3);}
.nori .tx{font-size:13.5px;line-height:1.9;}
.life{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.life .lc{background:#faf6ee;border:1px solid #f0e9db;border-radius:11px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;}
.life .lc .k{font-size:11.5px;color:var(--ink2);font-weight:700;}
.life .lc .v{font-size:13px;font-weight:800;}
.learn-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #f0e9db;}
.learn-row:first-of-type{border-top:none;padding-top:0;}
.learn-row .chk{width:20px;height:20px;border-radius:50%;background:var(--grn);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;}
.learn-row .chk svg{width:11px;height:11px;}
.learn-row .chk.watch{background:none;border:2px solid var(--amber);color:var(--amber);}
.learn-row .info{flex:1;min-width:0;}
.learn-row .info .cc{font-size:9.5px;color:var(--ink3);font-weight:700;}
.learn-row .info .ls{font-size:12.5px;font-weight:700;}
.learn-row .tg{font-size:9px;font-weight:800;border-radius:99px;padding:2px 8px;flex-shrink:0;}
.learn-row .tg.done{background:var(--grn-l);color:var(--grn-d);}
.learn-row .tg.watch{background:#fbf1dc;color:#a1741d;}
.learn-foot{margin-top:11px;border-top:1px solid #f0e9db;padding-top:10px;display:flex;align-items:center;justify-content:space-between;}
.learn-foot .cum{font-size:11px;color:var(--ink2);font-weight:700;}
.learn-foot .cum b{color:var(--grn-d);}
.learn-foot .cont{font-size:11.5px;font-weight:800;color:var(--grn-d);}
.review-note{background:#fbf1dc;border:1px solid #f0e3c4;border-radius:12px;padding:11px 13px;margin-top:11px;}
.review-note::before{content:"この日の振り返り";display:block;font-size:10.5px;font-weight:800;color:#a1741d;margin-bottom:6px;}
.review-note .q{font-size:10px;font-weight:800;color:#b58a3c;}
.review-note .q:nth-of-type(2){margin-top:8px;}
.review-note .a{font-size:12.5px;line-height:1.7;margin-top:2px;color:var(--ink);}
.tiles{display:flex;gap:8px;margin-bottom:11px;}
.tiles .t{flex:1;background:#faf6ee;border:1px solid #f0e9db;border-radius:12px;padding:11px 8px;text-align:center;display:flex;flex-direction:column;justify-content:center;}
.tiles .t .k{font-size:9.5px;color:var(--ink2);font-weight:700;}
.tiles .t .v{font-size:20px;font-weight:800;margin-top:3px;}
.tiles .t .v small{font-size:9px;color:var(--ink3);}
.tiles .t .chips{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:6px;}
.pchip{font-size:11px;font-weight:800;border-radius:99px;padding:4px 11px;color:#fff;background:var(--ink3);}
.pc-chest{background:#c88a4a;}.pc-leg{background:#5b7a9d;}.pc-back{background:#7a9d5b;}.pc-shoulder{background:#c86a6a;}.pc-arm{background:#8a6ac8;}.pc-abs{background:#4a9d9d;}.pc-hip{background:#6a6256;}.pc-full{background:#6a8a9d;}
.exrow{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #f0e9db;}
.exrow .epart{font-size:9.5px;font-weight:800;border-radius:6px;padding:2px 7px;color:#fff;background:var(--ink3);flex-shrink:0;}
.exrow .nm{flex:1;font-size:13px;font-weight:700;}
.exrow .set{font-size:11px;font-weight:800;color:var(--ink2);}
.menu-link{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:11px;padding:10px;background:#f4f9f5;border:1px solid #dbe8df;border-radius:11px;font-size:12px;font-weight:800;color:var(--grn-d);}
.menu-link.sub{background:#faf7f0;border-color:#e8e0d0;color:var(--ink2);}
.menu-link svg{width:14px;height:14px;}
.cal-root .btn3d.rec-btn{margin-top:6px;}
.rest{display:flex;align-items:center;gap:12px;background:#eef1f5;border:1px solid #dbe2ea;border-radius:12px;padding:14px;}
.rest .cir{width:42px;height:42px;border-radius:50%;background:#fff;border:1px solid #cdd6e0;display:flex;align-items:center;justify-content:center;color:#6b7a8f;flex-shrink:0;}
.rest .cir svg{width:22px;height:22px;}
.rest .tx b{font-size:14px;font-weight:800;color:#4a5a6d;display:block;}
.rest .tx span{font-size:11px;color:#7a8a9c;}
.none{text-align:center;padding:12px 0 6px;color:var(--ink3);}
.none .t{font-size:12px;font-weight:700;}
.none .emptic{display:block;width:30px;height:30px;margin:0 auto 6px;color:#cdc4b2;}
.none .emptic svg{width:30px;height:30px;display:block;}
.cal-root .btn3d{display:block;width:100%;text-align:center;padding:14px;border-radius:13px;font-size:14px;font-weight:800;color:#fff;}
.carte-msg{font-size:12.5px;line-height:1.7;color:var(--ink);margin-bottom:12px;}
.carte-msg b{color:var(--grn-d);}
.bp-sub{font-size:10.5px;color:var(--ink3);font-weight:600;margin:-3px 0 11px;}
.bp-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;}
.bp-cell{display:flex;flex-direction:column;gap:5px;}
.bp-photo{aspect-ratio:3/4;border-radius:13px;overflow:hidden;position:relative;background:linear-gradient(160deg,#d9d2c4,#c4bcac);}
.bp-photo img{width:100%;height:100%;object-fit:cover;display:block;}
.bp-photo.empty2{display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;font-weight:700;color:var(--ink3);background:#fffdf8;border:1px dashed #d8cdba;padding:6px;width:100%;cursor:pointer;font-family:inherit;line-height:1.4;}
.bp-fileinput{display:none;}
.bp-silh{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;}
.bp-silh svg{width:64%;height:78%;color:#9a9081;opacity:.55;}
.bp-badge{position:absolute;top:7px;left:7px;font-size:9.5px;font-weight:800;color:#fff;border-radius:7px;padding:2px 8px;box-shadow:0 1px 2px rgba(0,0,0,.15);}
.bp-badge.start{background:rgba(43,38,32,.82);}
.bp-badge.now{background:var(--grn);}
.bp-date{text-align:center;font-size:11px;font-weight:800;color:var(--ink2);}
.bp-add{aspect-ratio:3/4;width:100%;border-radius:13px;border:2px dashed #cdbfa6;background:#fffdf8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px;text-align:center;cursor:pointer;font-family:inherit;}
.bp-add .plus{width:34px;height:34px;border-radius:50%;background:#efe9dc;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:300;color:var(--ink2);}
.bp-add .lb{font-size:9.5px;font-weight:800;line-height:1.4;color:#8a8172;}
.bp-note{margin-top:10px;text-align:center;font-size:11.5px;font-weight:700;color:var(--ink3);}
`;
