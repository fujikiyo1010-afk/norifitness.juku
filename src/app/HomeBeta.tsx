import Link from "next/link";
import type { BodyCard } from "@/lib/member/body-card";
import type { BoardItem } from "@/lib/member/board";
import type { LastWatchedLesson } from "@/lib/member/last-watched";
import type { TodayActivity } from "@/lib/member/today-activity";

/**
 * 受講生ホーム 確定7/7版(P3・v1・ベータ限定)。
 * モック: ~/Desktop/筋肉塾_ホーム確定_7-7.html「確定版 7/7」タブ。
 *
 * v1の割り切り(4問④・未実装の先を隠す):
 *   - 今日やること = 学習＋体組成の2つ(食事P4/トレP5は追加しない)
 *   - 大タイル = 実装済み5枚(コース/学びの記録/ツール/月次/目標)。フォーム/プロテインは未実装で出さない
 *   - 継続◯日目(streak)は指標未計算のため出さない(嘘の数字禁止)
 * 色統一: ティール #4a875b / #34603f。
 */

const TEAL = "#4a875b";
const TEAL_DARK = "#34603f";

export function HomeBeta({
  displayName,
  daysSinceJoined,
  bodyCard,
  completedLessons,
  totalLessons,
  lastWatched,
  monthlyBadge,
  boardItems,
  unreadReply,
  today,
}: {
  displayName: string;
  daysSinceJoined: number;
  bodyCard: BodyCard;
  completedLessons: number;
  totalLessons: number;
  lastWatched: LastWatchedLesson | null;
  monthlyBadge: boolean;
  boardItems: BoardItem[];
  unreadReply: boolean;
  today: TodayActivity;
}) {
  const learnPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const doneCount =
    (today.recordedBody ? 1 : 0) +
    (today.learned ? 1 : 0) +
    (today.recordedMeal ? 1 : 0) +
    (today.recordedWorkout ? 1 : 0);
  // M7 案1: 残枠テキスト(「朝を記録／残り 昼・夕・間食」)
  const MEAL_ORDER = ["朝", "昼", "夕", "間"];
  const MEAL_REMAIN_LABEL: Record<string, string> = {
    朝: "朝",
    昼: "昼",
    夕: "夕",
    間: "間食",
  };
  const doneMeals = MEAL_ORDER.filter((t) => today.mealTypes.includes(t));
  const remainMeals = MEAL_ORDER.filter((t) => !today.mealTypes.includes(t));
  const mealTitle = today.recordedMeal
    ? `${doneMeals.join("・")}を記録${remainMeals.length > 0 ? `／残り ${remainMeals.map((t) => MEAL_REMAIN_LABEL[t]).join("・")}` : "（そろいました）"}`
    : "今日の食事を記録しよう";

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        {/* ヘッダー */}
        <header className="flex items-center justify-between px-[18px] py-[14px] border-b border-[#e7dcc9] bg-[#fffdf8] sticky top-0 z-10">
          <div className="text-[17px] font-bold tracking-[0.04em] text-[#004d40]">
            筋肉塾
          </div>
          <Link
            href="/account"
            aria-label="設定"
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#6a6256] hover:text-[#2b2620]"
          >
            <GearIcon />
          </Link>
        </header>

        {/* 挨拶ヒーロー */}
        <section className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-5 py-[20px]">
          <h1 className="text-[18px] font-bold text-[#2b2620]">
            こんにちは、{displayName} さん
          </h1>
          <div className="mt-1 text-[11px] text-[#6a6256] font-mono">
            入会 {daysSinceJoined + 1} 日目
          </div>
        </section>

        <div className="px-4 py-3.5 flex flex-col gap-3">
          {/* 掲示板「のりfitnessから」 */}
          {boardItems.length > 0 && (
            <BoardCard items={boardItems} unreadReply={unreadReply} />
          )}

          {/* 今のからだ(リング) */}
          <BodyRingCard bodyCard={bodyCard} />

          {/* 今日やること */}
          <section>
            <div className="mb-2 flex items-center gap-2.5 rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-2.5">
              <span className="font-mono text-[15px] font-extrabold text-[#4a875b]">
                {doneCount}/4
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#e7dcc9]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(doneCount / 4) * 100}%`, background: TEAL }}
                />
              </div>
              <span className="text-[10px] font-bold text-[#6a6256]">
                今日の達成
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {/* 体組成 */}
              <TodayCard
                cap="今のからだ"
                capColor={TEAL_DARK}
                title={
                  today.recordedBody
                    ? "今日の記録OK"
                    : "今日の体組成を記録しよう"
                }
                cta="タップして記録 →"
                href="/record"
                done={today.recordedBody}
              />
              {/* 学習 */}
              <TodayCard
                cap="続きから学ぶ"
                capColor={TEAL_DARK}
                title={
                  lastWatched
                    ? lastWatched.lessonTitle
                    : "最初のレッスンを見てみよう"
                }
                cta={lastWatched ? "▶ 続きを見る →" : "▶ レッスンへ →"}
                href={lastWatched?.href ?? "/courses"}
                done={today.learned}
              />
              {/* 食事(M7 案1・1食で✓) */}
              <TodayCard
                cap="今日の食事"
                capColor={TEAL_DARK}
                title={mealTitle}
                cta={today.recordedMeal ? "タップして見る →" : "＋写真で記録 →"}
                href={today.recordedMeal ? "/meals" : "/meals/new"}
                done={today.recordedMeal}
              />
              {/* トレーニング(P5・1日1タップ) */}
              <TodayCard
                cap="今日のトレ"
                capColor={TEAL_DARK}
                title={
                  today.recordedWorkout
                    ? "今日のトレ完了"
                    : today.hasWorkoutMenu
                      ? "今日のトレを記録しよう"
                      : "メニューを開始しよう"
                }
                cta={today.recordedWorkout ? "タップして見る →" : "▶ 実施を記録 →"}
                href="/workout/today"
                done={today.recordedWorkout}
              />
            </div>
          </section>

          {/* 学習の進捗(ドーナツ) */}
          <LearnProgressCard
            percent={learnPct}
            completed={completedLessons}
            total={totalLessons}
            daysSinceJoined={daysSinceJoined}
          />

          {/* 大タイル(実装済み5枚) */}
          <div className="grid grid-cols-2 gap-2">
            <BigTile href="/courses" name="コース一覧" desc="動画レッスン" icon={<BookIcon />} />
            <BigTile href="/my-log" name="学びの記録" desc="振り返り・進捗" icon={<PencilIcon />} />
            <BigTile href="/tools" name="ツール" desc="カロリー/PFC計算" icon={<ToolIcon />} />
            <BigTile
              href="/monthly-review"
              name="月次添削"
              desc="動画返信・履歴"
              icon={<VideoIcon />}
              badge={monthlyBadge ? "NEW" : undefined}
            />
            <BigTile href="/goal-sheet" name="目標シート" desc="今月の目標" icon={<TargetIcon />} />
          </div>

          <div className="h-4" />
        </div>
      </div>
    </main>
  );
}

// =====================================================================
// 掲示板
// =====================================================================

function BoardCard({
  items,
  unreadReply,
}: {
  items: BoardItem[];
  unreadReply: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: TEAL }}
          >
            の
          </span>
          <span className="text-[13px] font-bold text-[#2b2620]">
            のりfitnessから
          </span>
          {unreadReply && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: TEAL }}
            >
              返信あり
            </span>
          )}
        </div>
        <Link
          href="/notices"
          className="text-[11px] font-bold text-[#4a875b] hover:underline"
        >
          すべて見る →
        </Link>
      </div>
      <ul className="divide-y divide-[#efe6d4]">
        {items.map((it) => {
          const href = it.kind === "announcement" ? it.href ?? "/notices" : "/notices";
          return (
            <li key={it.key} className="py-2 first:pt-0 last:pb-0">
              <Link href={href} className="flex items-center gap-2 hover:opacity-90">
                <span className="w-8 flex-shrink-0 font-mono text-[10px] text-[#a59b8c]">
                  {it.dateLabel}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {it.kind === "announcement" ? (
                    <>
                      <span className="flex-shrink-0 rounded bg-[#fbf2dd] px-1.5 py-px text-[9px] font-bold text-[#a5631f]">
                        お知らせ
                      </span>
                      <span className="truncate text-[12.5px] font-bold text-[#2b2620]">
                        {it.title}
                      </span>
                    </>
                  ) : (
                    <span className="truncate text-[12.5px] text-[#2b2620]">
                      のりから返信が届きました
                    </span>
                  )}
                </div>
                <span className="flex-shrink-0 text-[#a59b8c]">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =====================================================================
// 今のからだ(リング)
// =====================================================================

function BodyRingCard({ bodyCard }: { bodyCard: BodyCard }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const pct = bodyCard.ringPct ?? 0;

  return (
    <Link
      href="/record"
      className="block rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3.5 hover:border-[#4a875b] transition-colors"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#6a6256]">今のからだ</span>
        <span className="text-[10px] font-bold text-[#4a875b]">
          詳細・グラフ →
        </span>
      </div>
      {bodyCard.hasData ? (
        <div className="flex items-center gap-4">
          <div className="relative h-[84px] w-[84px] flex-shrink-0">
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r={R} fill="none" stroke="#eadfce" strokeWidth="8" />
              <circle
                cx="42"
                cy="42"
                r={R}
                fill="none"
                stroke={TEAL}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct / 100)}
                transform="rotate(-90 42 42)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-[20px] font-extrabold leading-none text-[#2b2620]">
                {bodyCard.currentWeight?.toFixed(1) ?? "—"}
              </span>
              <span className="text-[9px] font-bold text-[#6a6256]">kg</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            {bodyCard.targetWeightKg != null ? (
              bodyCard.reached ? (
                <div className="text-[13px] font-bold text-[#004d40]">
                  目標達成
                </div>
              ) : (
                <div className="text-[12px] text-[#6a6256]">
                  目標まで{" "}
                  <b className="font-mono text-[15px] text-[#c2693f]">
                    あと {bodyCard.remainingKg?.toFixed(1)}kg
                  </b>
                </div>
              )
            ) : (
              <div className="text-[12px] text-[#6a6256]">目標体重が未設定です</div>
            )}
            {bodyCard.paceKgPerWeek != null && (
              <div className="mt-1 text-[10.5px] text-[#a59b8c]">
                現状ペース{" "}
                {bodyCard.paceKgPerWeek > 0 ? "+" : ""}
                {bodyCard.paceKgPerWeek.toFixed(1)}kg/週
              </div>
            )}
            <span className="mt-2 inline-block text-[10px] font-bold text-[#4a875b]">
              タップして記録 →
            </span>
          </div>
        </div>
      ) : (
        <div className="py-2 text-center">
          <div className="text-[13px] font-bold text-[#5b5344]">
            体組成をはじめて記録しよう
          </div>
          <div className="mt-1 text-[11px] text-[#a59b8c]">
            体重を記録すると、変化がグラフで見えます →
          </div>
        </div>
      )}
    </Link>
  );
}

// =====================================================================
// 今日やること カード
// =====================================================================

function TodayCard({
  cap,
  capColor,
  title,
  cta,
  href,
  done,
}: {
  cap: string;
  capColor: string;
  title: string;
  cta: string;
  href: string;
  done: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl bg-[#fffdf8] px-[15px] py-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] font-extrabold ${
            done
              ? "bg-[#2f9e5a] text-white"
              : "border-2 border-[#c9bfa9] text-transparent"
          }`}
        >
          ✓
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-extrabold" style={{ color: capColor }}>
            {cap}
          </div>
          <div className="mt-0.5 truncate text-[15px] font-extrabold text-[#1c1a16]">
            {title}
          </div>
          {!done && (
            <div className="mt-1 text-[12px] font-extrabold" style={{ color: capColor }}>
              {cta}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// =====================================================================
// 学習の進捗(ドーナツ)
// =====================================================================

function LearnProgressCard({
  percent,
  completed,
  total,
  daysSinceJoined,
}: {
  percent: number;
  completed: number;
  total: number;
  daysSinceJoined: number;
}) {
  const R = 24;
  const C = 2 * Math.PI * R;
  return (
    <Link
      href="/my-log"
      className="flex items-center gap-3.5 rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3 hover:border-[#4a875b] transition-colors"
    >
      <div className="relative h-[56px] w-[56px] flex-shrink-0">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={R} fill="none" stroke="#eadfce" strokeWidth="6" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke={TEAL}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - percent / 100)}
            transform="rotate(-90 28 28)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-[#34603f]">
          {percent}%
        </div>
      </div>
      <div>
        <span className="text-[11px] font-bold text-[#6a6256]">学びの記録</span>
        <div className="mt-0.5 text-[12px] font-bold text-[#2b2620]">
          完了 {completed} / {total} レッスン
        </div>
        <div className="text-[10px] text-[#6a6256]">入会 {daysSinceJoined + 1} 日目</div>
      </div>
    </Link>
  );
}

// =====================================================================
// 大タイル
// =====================================================================

function BigTile({
  href,
  name,
  desc,
  icon,
  badge,
}: {
  href: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex min-h-[92px] flex-col justify-between gap-2 rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3 hover:border-[#4a875b] transition-colors"
    >
      {badge && (
        <span className="absolute right-2 top-2 rounded-full bg-[#c2693f] px-1.5 py-px text-[8px] font-bold text-white">
          {badge}
        </span>
      )}
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4a875b1a] text-[#4a875b]">
        {icon}
      </span>
      <div>
        <div className="text-[13px] font-bold text-[#2b2620]">{name}</div>
        <div className="text-[9.5px] text-[#6a6256]">{desc}</div>
      </div>
    </Link>
  );
}

// =====================================================================
// アイコン(SVG線画)
// =====================================================================

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 18,
  height: 18,
};

function GearIcon() {
  return (
    <svg {...iconProps} width={20} height={20}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function ToolIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}
