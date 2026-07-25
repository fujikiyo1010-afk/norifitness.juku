"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CalendarBodyMetric, CalendarWorkout } from "@/lib/calendar/queries";
import type { CalendarLearnedLesson, CalendarReview, CalendarBodyPhoto } from "@/lib/calendar/queries";
import type { LastWatchedLesson } from "@/lib/member/last-watched";
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
};

export type CalendarViewProps = {
  date: string;
  today: string;
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
  bodyPhotos: CalendarBodyPhoto[];
  recordedDates: string[];
};

const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const labelDate = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 (${WEEKDAYS[d.getUTCDay()]})`;
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
  bodyPhotos,
  recordedDates,
}: CalendarViewProps) {
  const week = useMemo(() => {
    const base = new Date(`${date}T00:00:00Z`);
    const sundayMs = base.getTime() - base.getUTCDay() * 86_400_000;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sundayMs + i * 86_400_000);
      return { ds: d.toISOString().slice(0, 10), dnum: d.getUTCDate(), dow: i };
    });
  }, [date]);

  const graph = useMemo(() => {
    const s = body.series;
    if (s.length === 0) return null;
    const W = 248,
      H = 74,
      pad = 6;
    const ws = s.map((x) => x.weight);
    const min = Math.min(...ws) - 0.3;
    const max = Math.max(...ws) + 0.3;
    const span = max - min || 1;
    const xs = (i: number) => pad + i * ((W - pad * 2) / Math.max(1, s.length - 1));
    const ys = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
    const pts = s.map((x, i) => `${xs(i).toFixed(1)},${ys(x.weight).toFixed(1)}`).join(" ");
    const dots = s.map((x, i) => ({ cx: xs(i), cy: ys(x.weight) }));
    const selIdx = s.findIndex((x) => x.date === date);
    const hi = selIdx >= 0 ? { cx: xs(selIdx), cy: ys(s[selIdx].weight), v: s[selIdx].weight } : null;
    return { W, H, pts, dots, hi };
  }, [body.series, date]);

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
        <div className="hdt">{labelDate(date)}</div>
        {today > date ? (
          <Link className="navbtn" href={`/calendar?date=${shiftDate(date, 1)}`} aria-label="翌日">›</Link>
        ) : (
          <span className="navbtn dis">›</span>
        )}
      </div>

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
          </div>
          {graph ? (
            <svg className="bmgraph" viewBox={`0 0 ${graph.W} ${graph.H}`} preserveAspectRatio="none">
              <polyline points={graph.pts} fill="none" stroke="#cfe3d6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {graph.dots.map((p, i) => (<circle key={i} cx={p.cx} cy={p.cy} r={2} fill="#9dc3a9" />))}
              {graph.hi && (
                <>
                  <circle cx={graph.hi.cx} cy={graph.hi.cy} r={6.5} fill="#4a875b" stroke="#fff" strokeWidth={2.5} />
                  <text x={graph.hi.cx} y={graph.hi.cy - 11} textAnchor="middle" fontSize={10} fontWeight={800} fill="#34603f">{graph.hi.v}</text>
                </>
              )}
            </svg>
          ) : (
            <div className="empty">体組成の記録がまだありません</div>
          )}
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3c-1.5 1-2 3-2 6s.5 4 2 5v7" /></svg>
              </span>
              食事
            </div>
            <Link className="edit" href={`/meals?date=${date}`}>編集 ›</Link>
          </div>
          {meal.has ? (
            <>
              <div className="kcal-row">
                <div className="ring">
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
                  <div className="mrow" key={i}><span className="ml">{r.type}</span><span className="nm">{r.names}</span><span className="kc">{r.kcal || ""}</span></div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">まだ食事の記録がありません</div>
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
            {workout.state === "done" && workout.isCustom && <span className="star">★ じぶんメニュー</span>}
          </div>
          {workout.state === "rest" && (
            <div className="rest">
              <div className="cir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg></div>
              <div className="tx"><b>休養日</b><span>しっかり回復もトレーニングのうち</span></div>
            </div>
          )}
          {workout.state === "none" && (
            <>
              <div className="none"><span className="dumbbell-lg" /><div className="t">トレ記録なし</div></div>
              <Link className="btn3d" href="/workout/week">トレを記録する</Link>
            </>
          )}
          {workout.state === "done" && (
            <>
              <div className="tiles">
                <div className="t"><div className="k">種目数</div><div className="v">{workout.exCount}<small>種目</small></div></div>
                <div className="t"><div className="k">実施部位</div><div className="chips">{workout.parts.length > 0 ? workout.parts.map((p, i) => (<span key={i} className={`pchip ${PART_CLASS[p] ?? ""}`}>{p}</span>)) : <span className="pchip">—</span>}</div></div>
              </div>
              {workout.exercises.map((e, i) => (
                <div className="exrow" key={i}><span className="nm">{e.name}</span><span className="set">{setLabel(e.sets)}</span></div>
              ))}
              <Link className="menu-link" href="/workout">配布メニューを見る</Link>
            </>
          )}
        </div>
        )}

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
            <div className="empty">まだ生活記録がありません</div>
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
            <div className="empty">この日は学習の記録がありません</div>
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

        {/* ボディ写真(その日ある時だけ) */}
        {bodyPhotos.length > 0 && (
          <div className="card">
            <div className="ch">
              <div className="l">
                <span className="hic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                </span>
                ボディ写真
              </div>
            </div>
            <div className="gallery">
              {bodyPhotos.map((p) => (
                <div className="g" key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.thumbUrl && <img src={p.thumbUrl} alt="ボディ写真" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.cal-root{--bg:#f9f5ed;--card:#fffdf8;--line:#e7dcc9;--ink:#2b2620;--ink2:#6a6256;--ink3:#a59b8c;--grn:#4a875b;--grn-d:#34603f;--grn-l:#eaf3ec;--blue:#3f6fd8;--amber:#e0a63f;--rose:#d8607a;max-width:460px;margin:0 auto;color:var(--ink);}
.cal-root a{text-decoration:none;color:inherit;}
.cal-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;}
.cal-hd .hdt{font-size:16px;font-weight:800;color:var(--ink);}
.cal-hd .navbtn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:9px;font-size:20px;color:var(--ink2);}
.cal-hd .navbtn.dis{opacity:.3;}
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
.cal-root .hic{width:19px;height:19px;color:var(--grn);display:inline-flex;}
.cal-root .hic svg{width:19px;height:19px;}
.cal-root .star{font-size:10px;font-weight:800;color:var(--grn-d);background:var(--grn-l);border-radius:99px;padding:3px 10px;}
.dumbbell{display:inline-block;width:19px;height:19px;background:var(--grn);-webkit-mask:url(/icons/nav/workout.svg) center/contain no-repeat;mask:url(/icons/nav/workout.svg) center/contain no-repeat;flex-shrink:0;}
.dumbbell-lg{display:inline-block;width:30px;height:30px;background:#cdc4b2;-webkit-mask:url(/icons/nav/workout.svg) center/contain no-repeat;mask:url(/icons/nav/workout.svg) center/contain no-repeat;margin:0 auto 6px;}
.bmgraph{width:100%;height:74px;display:block;overflow:visible;}
.cal-root .empty{text-align:center;font-size:11.5px;color:var(--ink3);padding:14px 0;}
.bm3{display:flex;margin-top:12px;border-top:1px solid #f0e9db;padding-top:11px;}
.bm3 .n{flex:1;text-align:center;position:relative;}
.bm3 .n+.n::before{content:"";position:absolute;left:0;top:3px;bottom:3px;width:1px;background:#efe7d5;}
.bm3 .k{font-size:10px;color:var(--ink2);font-weight:700;}
.bm3 .v{font-size:19px;font-weight:800;margin-top:2px;}
.bm3 .v small{font-size:10px;color:var(--ink3);font-weight:700;}
.bm3 .df{font-size:9.5px;font-weight:700;margin-top:1px;color:var(--grn);min-height:12px;}
.kcal-row{display:flex;align-items:center;gap:14px;}
.ring{width:78px;height:78px;flex-shrink:0;position:relative;}
.ring .ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.ring .ct b{font-size:18px;font-weight:800;line-height:1;}
.ring .ct span{font-size:8.5px;color:var(--ink3);font-weight:700;margin-top:2px;}
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
.pc-chest{background:#c88a4a;}.pc-leg{background:#5b7a9d;}.pc-back{background:#7a9d5b;}.pc-shoulder{background:#c86a6a;}.pc-arm{background:#8a6ac8;}.pc-abs{background:#4a9d9d;}
.exrow{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #f0e9db;}
.exrow .nm{flex:1;font-size:13px;font-weight:700;}
.exrow .set{font-size:11px;font-weight:800;color:var(--ink2);}
.menu-link{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:11px;padding:10px;background:#f4f9f5;border:1px solid #dbe8df;border-radius:11px;font-size:12px;font-weight:800;color:var(--grn-d);}
.rest{display:flex;align-items:center;gap:12px;background:#eef1f5;border:1px solid #dbe2ea;border-radius:12px;padding:14px;}
.rest .cir{width:42px;height:42px;border-radius:50%;background:#fff;border:1px solid #cdd6e0;display:flex;align-items:center;justify-content:center;color:#6b7a8f;flex-shrink:0;}
.rest .cir svg{width:22px;height:22px;}
.rest .tx b{font-size:14px;font-weight:800;color:#4a5a6d;display:block;}
.rest .tx span{font-size:11px;color:#7a8a9c;}
.none{text-align:center;padding:12px 0 6px;color:var(--ink3);}
.none .t{font-size:12px;font-weight:700;}
.cal-root .btn3d{display:block;width:100%;text-align:center;padding:14px;border-radius:13px;font-size:14px;font-weight:800;color:#fff;}
.carte-msg{font-size:12.5px;line-height:1.7;color:var(--ink);margin-bottom:12px;}
.carte-msg b{color:var(--grn-d);}
.gallery{display:flex;gap:8px;overflow-x:auto;}
.gallery .g{width:82px;height:104px;border-radius:12px;overflow:hidden;background:#d6ddd8;flex-shrink:0;}
.gallery .g img{width:100%;height:100%;object-fit:cover;display:block;}
`;
