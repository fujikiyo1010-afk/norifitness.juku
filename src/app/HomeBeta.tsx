import type { ReactNode } from "react";
import Link from "next/link";
import type { BodyCard } from "@/lib/member/body-card";
import type { BoardItem } from "@/lib/member/board";
import type { LastWatchedLesson } from "@/lib/member/last-watched";
import type { TodayActivity } from "@/lib/member/today-activity";
import type { MemberAlert, MemberAlertKey } from "@/lib/member/alerts";
import type { WeeklyTraining } from "@/lib/workout/weekly";
import { WeeklyTrainingCard } from "@/components/WeeklyTrainingCard";
import { DocIcon, TargetIcon, BarIcon, BellIcon } from "@/components/icons";

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

// 今日やること3枚の色(点1・確定7/7): トレ/食事/学び
const CARD_COLOR = { workout: "#5b7a9d", meal: "#c88a4a", learn: "#6a9a6a" };

export function HomeBeta({
  displayName,
  daysSinceJoined,
  streakDays,
  bodyCard,
  completedLessons,
  totalLessons,
  lastWatched,
  monthlyBadge,
  boardItems,
  unreadReply,
  today,
  alerts,
  workoutDayNumber = null,
  workoutPartLabel = null,
  showTokuten = false,
  weeklyPool = null,
}: {
  displayName: string;
  daysSinceJoined: number;
  streakDays: number; // 継続日数(点20)
  bodyCard: BodyCard;
  completedLessons: number;
  totalLessons: number;
  lastWatched: LastWatchedLesson | null;
  monthlyBadge: boolean;
  boardItems: BoardItem[];
  unreadReply: boolean;
  today: TodayActivity;
  alerts: MemberAlert[]; // 件1: 未記入誘導の黄バナー(旧ホームから移植・該当解消で消える)
  workoutDayNumber?: number | null; // トレカード「◯日目」
  workoutPartLabel?: string | null; // トレカード タイトル=メニュー名(部位ラベル)
  /** 藤田さん限定 仮反映: true=コース一覧を隠し特典ライブラリを表示 / false=従来(コース一覧あり) */
  showTokuten?: boolean;
  /** 週間プール改修(藤田先行): あればトレカードを週間表示に差し替え */
  weeklyPool?: WeeklyTraining | null;
}) {
  const learnPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  // 今日やること=3枚(トレ・食事・学び)・分母3(点19)。体組成は上の大きい数字カードが担当。
  const doneCount =
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
    ? remainMeals.length > 0
      ? `${doneMeals.join("・")}を記録／残り ${remainMeals.map((t) => MEAL_REMAIN_LABEL[t]).join("・")}`
      : `${doneMeals.join("・")} 記録済` // 全4項目そろい時は短く「朝・昼・夕・間 記録済」(見切れ対策)
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

        {/* 挨拶ヒーロー (件I改・2026-07-13: グラデ帯の上下余白を14px均等にし文字を縦中央へ。
            掲示板との隙間はそこそこ近いまま=案A) */}
        <section className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-5 py-3.5">
          {/* 件E(2026-07-13): 挨拶+継続ピルは必ず横1行(改行禁止)。長い名前は挨拶側をtruncate。 */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="min-w-0 truncate text-[18px] font-bold text-[#2b2620]">
              こんにちは、{displayName} さん
            </h1>
            {/* 点20: 炎+継続◯日目(0日は出さない)。挨拶と同格に拡大(文字16px・炎18) */}
            {streakDays > 0 && (
              <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[#fff3e0] px-3 py-1.5">
                <FlameIcon size={18} />
                <span className="whitespace-nowrap text-[16px] font-extrabold text-[#c2693f]">
                  継続 {streakDays} 日目
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 件J: ホームのセクション間余白を約2/3(gap-3→gap-2)。ゾーン内部・カード内部は不変 */}
        <div className="px-4 pt-0.5 pb-4 flex flex-col gap-2">
          {/* 件1: 未記入誘導の黄バナー(旧ホームから移植)。挨拶の下・掲示板の上。該当解消で消える。 */}
          {alerts.map((alert) => (
            <NoticeBanner key={alert.key} alert={alert} />
          ))}

          {/* 掲示板「のりfitnessから」 */}
          {boardItems.length > 0 && (
            <BoardCard items={boardItems} unreadReply={unreadReply} />
          )}

          {/* 今のからだ(点18・見せ方3=大きい数字型。リングは/record体重タブのみ) */}
          <BodyBigCard bodyCard={bodyCard} />

          {/* 件2(2026-07-13): 初日ガイド。新規の初日だけ・今日の達成3/3で消える・2日目以降は出さない。
              純導出(daysSinceJoined===0 && doneCount<3)=表示済み管理の保存なし。責めないトーン・絵文字なし。 */}
          {daysSinceJoined === 0 && doneCount < 3 && (
            <div className="-mb-0.5 rounded-[12px] border border-[#cfe3d6] bg-[#eaf3ec] px-3.5 py-2 text-center text-[12.5px] font-bold text-[#34603f]">
              「今日やること」から始めよう
            </div>
          )}

          {/* 今日やること ゾーン(件H・案1): 薄緑の大枠で トレ/食事/学び+生活行+達成バー を包む */}
          <section className="rounded-[16px] border-[1.5px] border-[#cfe3d6] bg-[#f0f7f2] p-2.5">
            <h2 className="mb-1.5 ml-0.5 text-[11.5px] font-extrabold text-[#34603f]">
              今日やること
            </h2>
            <div className="flex flex-col gap-2">
              {/* トレーニング: 週間プール(藤田先行)ならカードを差し替え。それ以外は従来カード。 */}
              {weeklyPool ? (
                <WeeklyTrainingCard weekly={weeklyPool} />
              ) : (
                <TodayCard
                  cap={
                    workoutDayNumber
                      ? `今日のトレーニング ・ ${workoutDayNumber}日目`
                      : "今日のトレーニング"
                  }
                  capColor={CARD_COLOR.workout}
                  title={
                    today.hasWorkoutMenu
                      ? (workoutPartLabel ?? "今日のトレーニング")
                      : "メニューを開始しよう"
                  }
                  cta={today.recordedWorkout ? "タップして見る →" : "▶ 実施を記録 →"}
                  href="/workout/today"
                  done={today.recordedWorkout}
                />
              )}
              {/* 食事(M7 案1・1食で✓・ラベル文言=モック) */}
              <TodayCard
                cap="食事添削 ・ 今日"
                capColor={CARD_COLOR.meal}
                title={mealTitle}
                cta={today.recordedMeal ? "タップして見る →" : "＋写真で記録 →"}
                href="/meals"
                done={today.recordedMeal}
              />
              {/* 学び */}
              <TodayCard
                cap="続きから学ぶ"
                capColor={CARD_COLOR.learn}
                title={
                  lastWatched
                    ? lastWatched.lessonTitle
                    : "最初のレッスンを見てみよう"
                }
                cta={lastWatched ? "▶ 続きを見る →" : "▶ レッスンへ →"}
                href={lastWatched?.href ?? "/courses"}
                done={today.learned}
              />
            </div>
            {/* 達成バー: 件H で 3カードの上→ゾーン最下段へ移動 */}
            <div className="mt-2 flex items-center gap-2.5 rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-2.5">
              <span className="font-mono text-[15px] font-extrabold text-[#4a875b]">
                {doneCount}/3
              </span>
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#e7dcc9]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(doneCount / 3) * 100}%`, background: TEAL }}
                />
              </div>
              <span className="text-[10px] font-bold text-[#6a6256]">
                今日の達成
              </span>
            </div>
          </section>

          {/* 細21: 生活の独立入口(4問・10秒)。2026-07-13: 今日やることゾーンの外・真下へ移動。 */}
          <LifeRow done={today.recordedLife} />

          {/* 学習の進捗(ドーナツ) */}
          <LearnProgressCard
            percent={learnPct}
            completed={completedLessons}
            total={totalLessons}
            daysSinceJoined={daysSinceJoined}
          />

          {/* 大タイル(2026-07-13 並び替え・行優先で 左列=デイリー/学び/コース/フォーム, 右列=月次/目標/ツール)。
              アイコン色は7個すべて別色(学びの記録の緑重複を金へ変更)。 */}
          <div className="grid grid-cols-2 gap-2">
            {/* 1行目: デイリー添削(左) / 月次添削(右) */}
            <BigTile
              href="/history/feedbacks"
              name="デイリー添削"
              desc="のりからの言葉"
              icon={<TileIcon paths={[TILE_ICON.comment]} />}
              iconColor="#4a875b"
              iconBg="#eaf3ec"
              badge={unreadReply ? "NEW" : undefined}
            />
            <BigTile
              href="/monthly-review"
              name="月次添削"
              desc="動画返信・履歴"
              icon={<MonthlyTileIcon />}
              iconColor="#d6536a"
              iconBg="#fbe9ee"
              badge={monthlyBadge ? "NEW" : undefined}
            />
            {/* 2行目: 学びの記録(左・金) / 目標シート(右) */}
            <BigTile
              href="/my-log"
              name="学びの記録"
              desc="振り返り・実践"
              icon={<TileIcon paths={TILE_ICON.learn.split(" M").map((s, i) => (i === 0 ? s : "M" + s))} />}
              iconColor="#b8860b"
              iconBg="#f7efd4"
            />
            <BigTile
              href="/goal-sheet"
              name="目標シート"
              desc="今月の目標"
              icon={<GoalTileIcon />}
              iconColor="#2f7d6b"
              iconBg="#e3f1ee"
            />
            {/* コース一覧: 通常は表示。藤田さん限定 仮反映(showTokuten)では非表示にし、
                代わりに末尾へ「特典ライブラリ」を出す。どちらも8枚=4行×2列で揃う(2026-07-17)。 */}
            {!showTokuten && (
              <BigTile
                href="/courses"
                name="コース一覧"
                desc="動画レッスン"
                icon={<TileIcon paths={TILE_ICON.course.split(" M").map((s, i) => (i === 0 ? s : "M" + s))} />}
                iconColor="#3a6ea5"
                iconBg="#e8f0fa"
              />
            )}
            <BigTile
              href="/tools"
              name="ツール"
              desc="カロリー/PFC計算"
              icon={<ToolsTileIcon />}
              iconColor="#7a5af0"
              iconBg="#efeafd"
            />
            <BigTile
              href="/form-review"
              name="フォーム添削"
              desc="オンラインで直接"
              icon={<FormReviewTileIcon />}
              iconColor="#c2693f"
              iconBg="#f7ece2"
            />
            <BigTile
              href="/protein"
              name="プロテイン"
              desc="専用クーポンで購入"
              icon={<ProteinTileIcon />}
              iconColor="#8a5a3c"
              iconBg="#f3e7dd"
            />
            {showTokuten && (
              <BigTile
                href="/tokuten"
                name="特典ライブラリ"
                icon={
                  <TileIcon
                    paths={[
                      "M20 12v10H4V12",
                      "M2 7h20v5H2z",
                      "M12 22V7",
                      "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z",
                      "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
                    ]}
                  />
                }
                iconColor="#3a7d44"
                iconBg="#eef6ee"
                lineBadge
              />
            )}
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
          {/* 件F(2026-07-13): 「の」丸アイコンと「のりfitnessから」を撤去し見出しは「掲示板」に */}
          <span className="text-[13px] font-bold text-[#2b2620]">
            掲示板
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
          // 総2: ベータの日次FBは it.href(=その日の食事詳細)へ着地統一。無ければお知らせ一覧。
          const href = it.href ?? "/notices";
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

// 点18・確定7/7 bm()見せ方3=大きい数字型(リングは使わない)
function BodyBigCard({ bodyCard }: { bodyCard: BodyCard }) {
  return (
    <Link
      href="/record"
      className="group block rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-[13px] py-3 hover:border-[#4a875b] transition-colors"
    >
      {/* 2026-07-13: 「今のからだ」ラベルと「詳細・グラフ →」の行を削除し、その分カードを縮小
          (カード全体が /record リンク＋下部ボタンで導線は担保) */}
      {bodyCard.hasData ? (
        <>
          <div className="flex items-end gap-3">
            <div className="leading-none">
              <span className="text-[42px] font-extrabold leading-none text-black">
                {bodyCard.currentWeight?.toFixed(1) ?? "—"}
              </span>
              <span className="ml-0.5 text-[12px] font-bold text-[#6a6256]">kg</span>
            </div>
            {bodyCard.currentBodyFat != null && (
              <div className="pb-[3px] text-[12px] text-[#6a6256]">
                体脂肪 <b className="text-[#34603f]">{bodyCard.currentBodyFat.toFixed(1)}%</b>
              </div>
            )}
          </div>
          {bodyCard.targetWeightKg != null && (
            <div className="mt-[7px] text-[11.5px] text-[#6a6256]">
              {bodyCard.reached ? (
                <b className="text-[#004d40]">目標体重に到達しました</b>
              ) : (
                <>
                  目標まで <b className="text-[#c2693f]">体重-{bodyCard.remainingKg?.toFixed(1)}kg</b>
                </>
              )}
            </div>
          )}
          {/* 件D(2026-07-13): 立体3段モックの案2「中」を転写(薄グラデ+2px下エッジ・押下で2px沈む) */}
          <span
            className="mt-2.5 block rounded-lg py-2 text-center text-[12px] font-bold text-white transition-transform shadow-[0_2px_0_#2f5a3c,0_6px_12px_rgba(52,96,63,0.22)] group-active:translate-y-[2px] group-active:shadow-[0_0_0_#2f5a3c,0_3px_8px_rgba(52,96,63,0.2)]"
            style={{ background: "linear-gradient(180deg,#529367,#4a875b 55%,#3f7350)" }}
          >
            タップして記録 ・ グラフを見る
          </span>
        </>
      ) : (
        <div className="py-2 text-center">
          <div className="text-[13px] font-bold text-[#5b5344]">
            体組成をはじめて記録しよう
          </div>
          {/* 件D(2026-07-13): 立体3段モックの案2「中」を転写(薄グラデ+2px下エッジ・押下で2px沈む) */}
          <span
            className="mt-2.5 block rounded-lg py-2 text-center text-[12px] font-bold text-white transition-transform shadow-[0_2px_0_#2f5a3c,0_6px_12px_rgba(52,96,63,0.22)] group-active:translate-y-[2px] group-active:shadow-[0_0_0_#2f5a3c,0_3px_8px_rgba(52,96,63,0.2)]"
            style={{ background: "linear-gradient(180deg,#529367,#4a875b 55%,#3f7350)" }}
          >
            タップして記録 ・ グラフを見る
          </span>
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
// 生活の独立入口(細21・4問10秒)
// =====================================================================

function LifeRow({ done }: { done: boolean }) {
  return (
    <Link
      href="/meals?life=1"
      className="mt-2 flex min-h-[44px] items-center gap-2.5 rounded-xl border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-2.5 hover:border-[#4a875b] transition-colors"
    >
      <span
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${
          done ? "bg-[#2f9e5a] text-white" : "bg-[#eaf3ec] text-[#4a875b]"
        }`}
      >
        {done ? (
          <span className="text-[13px] font-extrabold">✓</span>
        ) : (
          <MoonIcon />
        )}
      </span>
      <span className="flex-1 text-[12.5px] font-bold text-[#2b2620]">
        {done ? "今日の生活を記録しました" : "今日の生活を記録"}
        <span className="ml-1 text-[10.5px] font-normal text-[#6a6256]">
          （4問・10秒）
        </span>
      </span>
      {!done && (
        <span className="flex-none text-[11px] font-bold text-[#4a875b]">
          記録する →
        </span>
      )}
    </Link>
  );
}

function MoonIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
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
  iconColor,
  iconBg,
  badge,
  lineBadge,
}: {
  href: string;
  name: string;
  desc?: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  badge?: string;
  /** 「LINE限定特典」の緑バッジ + シェブロンを表示(特典ライブラリ用・2026-07-14) */
  lineBadge?: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex h-[98px] flex-col justify-between gap-1 overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] p-3 hover:border-[#4a875b] transition-colors"
    >
      {badge && (
        <span className="absolute right-2 top-2 rounded-full bg-[#c2693f] px-1.5 py-px text-[8px] font-bold text-white">
          {badge}
        </span>
      )}
      {lineBadge && (
        <svg
          className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c3b8a2"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>
      )}
      {/* 細18: 確定7/7転写=色付きアイコン円 */}
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <div>
        <div className="text-[13px] font-bold text-[#2b2620]">{name}</div>
        {desc && <div className="text-[9.5px] text-[#6a6256]">{desc}</div>}
        {lineBadge && (
          <span className="mt-1 inline-flex items-center gap-[3px]">
            <span
              className="flex h-[13px] w-[13px] flex-shrink-0 items-center justify-center rounded-[4px]"
              style={{ background: "#06C755" }}
            >
              <svg viewBox="0 0 24 24" className="h-[9px] w-[9px]" fill="#fff">
                <path d="M12 3.5c-4.7 0-8.5 3-8.5 6.8 0 3.4 3 6.2 7 6.7.28.06.66.18.75.42.08.22.05.55.03.77 0 0-.1.6-.12.73-.04.22-.17.86.75.47s4.96-2.92 6.77-5C20.6 12.9 20.5 11.5 20.5 10.3c0-3.8-3.8-6.8-8.5-6.8z" />
              </svg>
            </span>
            <span className="text-[8.5px] font-bold" style={{ color: "#06C755" }}>
              LINE限定特典
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}

// 細18/細19: タイルアイコン(確定7/7 ICONS のSVGパスを転写)
const TILE_ICON = {
  course: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z", // 2026-07-13: 開いた本(候補B)
  learn: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4",
  comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
} as const;

function TileIcon({ paths }: { paths: string[] }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
function ToolsTileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3" rx="0.5" />
      <path d="M9 13h.01M12 13h.01M15 13h.01M9 16h.01M12 16h.01M15 16h.01" />
    </svg>
  );
}
function MonthlyTileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polygon points="10 9 15 12 10 15" fill="currentColor" stroke="none" />
    </svg>
  );
}
function GoalTileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
// フォーム添削: オンラインで直接見る=画面(モニタ)+再生の線画
function FormReviewTileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8 M12 17v4" />
      <polygon points="10.5 8.5 15 11 10.5 13.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
// プロテイン: シェイカーの線画(フタ+ボトル+目盛り)
function ProteinTileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h8 M9 3v2.5a3 3 0 0 1-.5 1.7L7 9.5a4 4 0 0 0-.7 2.3V19a2 2 0 0 0 2 2h7.4a2 2 0 0 0 2-2v-7.2a4 4 0 0 0-.7-2.3l-1.5-2.3a3 3 0 0 1-.5-1.7V3" />
      <path d="M6.4 12.5h11.2" />
      <path d="M15 15.5h1.5 M15 18h1.5" />
    </svg>
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
function FlameIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#c2693f"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

// =====================================================================
// 件1: 未記入誘導の黄バナー(旧ホーム page.tsx から転写・文言/条件/hrefそのまま)
// =====================================================================
type AlertConfig = {
  strong: string | ((alert: MemberAlert) => string);
  tail: string;
  href: string;
  icon: ReactNode;
};

const ALERT_CONFIG: Record<MemberAlertKey, AlertConfig> = {
  carte_blank: {
    strong: "カルテが未記入",
    tail: "です。専用メニュー作成のために記入を",
    href: "/workout/carte/new",
    icon: <DocIcon />,
  },
  goal_sheet_blank: {
    strong: "目標管理シートが未記入",
    tail: "です。タップして設定しましょう",
    href: "/goal-sheet",
    icon: <TargetIcon />,
  },
  body_metrics_missing: {
    strong: "体組成 まだ記録なし",
    tail: "。基準値を記録しましょう",
    href: "/record",
    icon: <BarIcon />,
  },
  body_metrics_stalled: {
    strong: (alert) =>
      `体組成の記録が止まっています (最後 ${alert.daysSinceLatest ?? "?"} 日前)`,
    tail: "。記録しましょう",
    href: "/record",
    icon: <BarIcon />,
  },
  notification_off: {
    strong: "通知が OFF です",
    tail: "。タップして 設定 → 通知 で ON にしましょう",
    href: "/account",
    icon: <BellIcon />,
  },
};

function NoticeBanner({ alert }: { alert: MemberAlert }) {
  const cfg = ALERT_CONFIG[alert.key];
  const strong =
    typeof cfg.strong === "function" ? cfg.strong(alert) : cfg.strong;
  return (
    <Link
      href={cfg.href}
      className="px-3.5 py-3 bg-gradient-to-br from-[rgba(255,235,59,0.18)] to-[rgba(255,235,59,0.10)] border border-[rgba(255,235,59,0.55)] rounded-[10px] flex items-center gap-2.5 text-[12px] text-[#2b2620]"
    >
      <span className="flex-shrink-0 w-[18px] h-[18px] text-zinc-700">
        {cfg.icon}
      </span>
      <span className="flex-1">
        <b className="text-[#b8860b] font-bold">{strong}</b>
        {cfg.tail}
      </span>
      <span className="text-[#b8860b] font-mono font-bold">→</span>
    </Link>
  );
}
