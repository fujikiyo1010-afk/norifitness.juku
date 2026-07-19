import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminInfo } from "@/lib/auth/admin";
import { getMyAlerts, type MemberAlert, type MemberAlertKey } from "@/lib/member/alerts";
import { getMyHomeStats } from "@/lib/member/home-stats";
import { getMyLastWatchedLesson } from "@/lib/member/last-watched";
import { getMyGoalSheetStatus } from "@/lib/member/goal-sheet-status";
import { getMyMonthlyAuditHomeStatus } from "@/lib/member/monthly-audit-status";
import { getMyBodyCard, type BodyCard } from "@/lib/member/body-card";
import { getRecordStreak } from "@/lib/member/record-streak";
import { getTodayWorkout } from "@/lib/workout/logs";
import { getExerciseTarget } from "@/lib/workout/menu-display";
import { getMyUnreadCount } from "@/lib/chat/queries";
import { getMyBoardItems, type BoardItem } from "@/lib/member/board";
import { hasUnreadReply } from "@/lib/member/notifications";
import { getTodayActivity } from "@/lib/member/today-activity";
import { isBetaUser } from "@/lib/auth/beta";
import { isTokutenPreviewUser } from "@/lib/auth/tokuten-preview";
import { HomeBeta } from "./HomeBeta";

export const dynamic = "force-dynamic";

/**
 * 受講生 ホーム画面 v4 (ティール緑統一版)
 *
 * 設計元: docs/03_design_mocks/recovered/ホーム画面_v4_(ティール緑統一版).html
 *
 * 構成 (上から):
 *   - ヘッダー (筋肉塾ロゴ / お知らせアイコン / プロフィールアイコン)
 *   - ヒーロー帯 (挨拶 + 入会日 + 経過日数)
 *   - 黄バナー 3 (カルテ / 目標シート / 体組成 未記入の時のみ)
 *   - 続きから学ぶ CTA (last_watched_at 最新、 なければ「最初のレッスンへ」)
 *   - 4 機能ブロック (コース / 学習 / LINE / ツール)
 *   - 横長 目標管理シート (添削届けば メールアイコンバッジ)
 *   - 全体進捗バー
 *   - 数値 3 枠 (完了レッスン / 視聴時間 / 入会日数)
 *   - 管理者の場合のみ「管理画面へ」リンク (小さく目立たない)
 *   - ログアウトボタン
 *
 * 嘘の数字禁止原則:
 *   - 視聴時間 = watched_seconds 加算ロジック未実装のため null = 「—」表示
 *   - 通知未読バッジ = 未読管理テーブル未実装のため 赤ドット出さない
 *   - 目標シート添削数 = 既読管理未実装のため 数字なし「添削あり」表示のみ
 */
export default async function Home() {
  // ───── オンボーディング未完了ガード ─────
  // 入会直後の受講生が メール / ブラウザ履歴 / URL 直打ち で / に到達するのを防ぎ、
  // 強制的に /onboarding に送り返す。 shipments 行 = オンボ Step 6 完了マーカー
  // (= プロテイン発送先入力済) = 「入会動線を最低限通った」 印。
  // admin (= きよむさん / のり氏) は shipments を持たないが /admin にも /(ホーム) にも
  // 到達できる必要があるため、 ガード対象外。
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  // 層1: カルテ入力を必須化 (= 関所)。新規受講生のみ対象。
  // 既存受講生 (このカットオフより前に入会) はカルテ未提出でも影響させない。
  // カットオフ = この機能の本番投入日 (= 必要なら調整)。
  const CARTE_REQUIRED_SINCE = "2026-06-29T00:00:00+09:00";

  // 関所に必要な4つを並列取得 (= 直列だと太平洋を最大4往復するため一括化)。
  // リダイレクト判定そのものは下記で従来どおり順序を保って評価する。
  // admin / onboarding 送りの人にも carte 等を余分に読むが user.id 引きの軽い読み取りで無害。
  const adminSb = createAdminClient();
  const [adminRes, shipmentRes, userRes, carteRes] = await Promise.all([
    adminSb.from("admin_users").select("id").eq("id", user.id).maybeSingle(),
    adminSb.from("shipments").select("id").eq("user_id", user.id).maybeSingle(),
    adminSb.from("users").select("joined_at").eq("id", user.id).maybeSingle(),
    adminSb
      .from("user_workout_carte")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const adminRow = adminRes.data;
  if (!adminRow) {
    if (!shipmentRes.data) {
      redirect("/onboarding");
    }
    const joinedAt = userRes.data?.joined_at;
    if (
      joinedAt &&
      new Date(joinedAt) >= new Date(CARTE_REQUIRED_SINCE) &&
      !carteRes.data
    ) {
      redirect("/workout/carte/new");
    }
  }

  const [
    alerts,
    stats,
    lastWatched,
    goalSheet,
    monthlyAudit,
    bodyCard,
    admin,
    chatUnread,
    boardItems,
    unreadReply,
    isBeta,
    todayActivity,
    streakDays,
    w,
    isTokutenPreview,
  ] = await Promise.all([
    getMyAlerts(),
    getMyHomeStats(),
    getMyLastWatchedLesson(),
    getMyGoalSheetStatus(),
    getMyMonthlyAuditHomeStatus(),
    getMyBodyCard(),
    getAdminInfo(),
    getMyUnreadCount(),
    getMyBoardItems(2),
    hasUnreadReply(),
    isBetaUser(),
    getTodayActivity(),
    // F: beta ホームで使う2本を本体バッチに合流(後段の直列往復を1つ消す)。
    // 非betaでは使わないが、並列なので待ち時間コストは無い。
    getRecordStreak(),
    getTodayWorkout(),
    // 特典ライブラリの本番・藤田さん限定 仮反映(2026-07-17)
    isTokutenPreviewUser(),
  ]);

  const displayName = stats?.displayName ?? "受講生";
  const joinedAtLabel = stats
    ? new Date(stats.joinedAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
  const progressPct =
    stats && stats.totalLessons > 0
      ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
      : 0;

  // P3(ベータ限定): 確定7/7ホーム。非ベータは従来ホーム(下の return)。
  // 藤田さん限定の特典ライブラリ仮反映では、非ベータでも HomeBeta 経路に通す。
  if (isBeta || isTokutenPreview) {
    // streakDays, w は上の本体バッチで取得済み(F: 後段の直列を合流)。
    // トレカードのラベル(◯日目 + メニュー名/部位ラベル)
    const workoutDayNumber = w.started ? w.dayNumber : null;
    let workoutPartLabel: string | null = null;
    if (w.started && w.dayMenu) {
      const label = w.dayMenu.日;
      if (label && label !== `${w.dayNumber}日目`) {
        workoutPartLabel = label;
      } else {
        const t = getExerciseTarget(
          (w.dayMenu.種目 ?? []).flatMap((e) => e.主部位 ?? [])
        );
        workoutPartLabel = t && t !== "全身" ? `${t}の日` : `${w.dayNumber}日目`;
      }
    }
    return (
      <HomeBeta
        displayName={displayName}
        daysSinceJoined={stats?.daysSinceJoined ?? 0}
        streakDays={streakDays}
        workoutDayNumber={workoutDayNumber}
        workoutPartLabel={workoutPartLabel}
        bodyCard={bodyCard}
        completedLessons={stats?.completedLessons ?? 0}
        totalLessons={stats?.totalLessons ?? 0}
        lastWatched={lastWatched}
        monthlyBadge={monthlyAudit?.hasReviewNotice ?? false}
        boardItems={boardItems}
        unreadReply={unreadReply}
        today={todayActivity}
        alerts={alerts}
        showTokuten={isBeta || isTokutenPreview}
      />
    );
  }

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
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </header>

      {/* ヒーロー帯 */}
      <section className="bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] px-5 py-[22px]">
        <h1 className="text-[18px] font-bold text-[#2b2620] mb-1">
          こんにちは、{displayName} さん
        </h1>
        <div className="text-[11px] text-[#6a6256] font-mono">
          入会 {joinedAtLabel}
          {stats && ` ・ ${stats.daysSinceJoined + 1} 日目`}
        </div>
      </section>

      {/* 黄バナー 3 (該当アラートのみ表示) */}
      <div className="px-4 pt-3.5 flex flex-col gap-2">
        {alerts.map((alert) => (
          <NoticeBanner key={alert.key} alert={alert} />
        ))}
      </div>

      {/* 掲示板「のりfitnessから」(P2b-1) ＋ 返信あり緑バッジ(P2b-2) */}
      {boardItems.length > 0 && (
        <div className="px-4 pt-3.5">
          <BoardSection items={boardItems} hasUnreadReply={unreadReply} />
        </div>
      )}

      {/* 続きから学ぶ CTA */}
      <div className="px-4 pt-3.5">
        <ContinueCTA lastWatched={lastWatched} />
      </div>

      {/* 4 機能ブロック (2026-06-18 #2 で チャット 復活) */}
      <SectionLabel>機能</SectionLabel>
      <div className="grid grid-cols-2 gap-2 px-4">
        <FeatureBlock
          href="/courses"
          name="コース一覧"
          desc="動画を見る"
          icon={<BookIcon />}
        />
        <FeatureBlock
          href="/my-log"
          name="学習"
          desc="振り返りと進捗"
          icon={<PencilIcon />}
        />
        <FeatureBlock
          href="/messages"
          name="チャット"
          desc="のり氏に質問・相談"
          icon={<ChatIcon />}
          badge={chatUnread}
        />
        <FeatureBlock
          href="/tools"
          name="ツール"
          desc="計算ツール"
          icon={<ToolIcon />}
        />
      </div>

      {/* 横長 目標管理シート */}
      <div className="px-4 pt-2">
        <Link
          href="/goal-sheet"
          className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-[18px] py-4 flex items-center gap-3 hover:border-[#4a875b] transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[#4a875b1a] flex items-center justify-center flex-shrink-0">
            <TargetIcon />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-[#2b2620] mb-0.5 flex items-center gap-1.5">
              目標管理シート
              {goalSheet.hasReviewNotice && (
                <span className="bg-[#b8860b] text-white text-[9px] px-1.5 py-[1px] rounded-full inline-flex items-center gap-1">
                  <MailMiniIcon /> 添削あり
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#6a6256]">
              {goalSheet.hasContent
                ? goalSheet.hasReviewNotice
                  ? "のりfitness から添削が届いています"
                  : "記入済 ・ 添削待ち"
                : "まだ記入されていません"}
            </div>
          </div>
          <span className="text-[#a59b8c] font-mono text-xs">→</span>
        </Link>
      </div>

      {/* 横長 月次添削 */}
      <div className="px-4 pt-2">
        <Link
          href="/monthly-review"
          className="bg-[#fffdf8] border border-[#e7dcc9] rounded-[14px] px-[18px] py-4 flex items-center gap-3 hover:border-[#4a875b] transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[#4a875b1a] flex items-center justify-center flex-shrink-0">
            <ClipboardIcon />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-[#2b2620] mb-0.5 flex items-center gap-1.5">
              月次添削
              {monthlyAudit.hasReviewNotice && (
                <span className="bg-[#b8860b] text-white text-[9px] px-1.5 py-[1px] rounded-full inline-flex items-center gap-1">
                  <MailMiniIcon /> 添削あり
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#6a6256]">
              {monthlyAudit.status === "d_replied"
                ? "のりfitness から添削が届いています"
                : monthlyAudit.status === "c_submitted"
                  ? "記入済 ・ 添削待ち"
                  : monthlyAudit.status === "b_in_progress"
                    ? "記入中 ・ 提出を待っています"
                    : "今月分はまだ記入されていません"}
            </div>
          </div>
          <span className="text-[#a59b8c] font-mono text-xs">→</span>
        </Link>
      </div>

      {/* 横長 体組成 (2026-07-06 P7) */}
      <div className="px-4 pt-2">
        <BodyCardBlock card={bodyCard} />
      </div>

      {/* 全体進捗バー */}
      <div className="px-4 pt-[18px]">
        <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-3.5">
          <div className="flex justify-between items-baseline mb-2">
            <div className="text-[11px] font-semibold text-zinc-600">
              全体進捗
            </div>
            <div className="font-mono text-base font-bold text-[#34603f]">
              {progressPct}%
              <span className="text-[10px] text-[#6a6256] ml-1">
                ({stats?.completedLessons ?? 0} / {stats?.totalLessons ?? 0})
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-[#f0f2f1] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4a875b] to-[#34603f] rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 数値 2 枠 (視聴時間は加算ロジック未実装 = 線② で復活) */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        <StatCell
          num={stats?.completedLessons ?? 0}
          unit="レッスン"
          label="完了"
        />
        <StatCell
          num={(stats?.daysSinceJoined ?? 0) + 1}
          unit="日目"
          label="入会から"
        />
      </div>

      {/* フッター (管理者リンクのみ ・ ログアウトは /account へ集約 2026-06-18) */}
      {admin && (
        <footer className="mt-auto px-4 pt-8 pb-6 flex justify-center">
          <Link
            href="/admin"
            className="text-[11px] text-[#6a6256] hover:text-[#34603f] transition-colors"
          >
            管理画面へ →
          </Link>
        </footer>
      )}
      </div>
    </main>
  );
}

// =====================================================================
// 黄バナー
// =====================================================================

type AlertConfig = {
  /** 動的データを受けて strong 文字列を生成 (= 体組成 N 日途絶など)。 string で固定値も OK */
  strong: string | ((alert: MemberAlert) => string);
  tail: string;
  href: string;
  icon: React.ReactNode;
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

// =====================================================================
// 横長 体組成カード (P7) ・ /record への導線
// =====================================================================

function BodyCardBlock({ card }: { card: BodyCard }) {
  // 記録なし → 記録を促すだけ (嘘の数字を出さない)
  if (!card.hasData) {
    return (
      <Link
        href="/record"
        className="flex items-center gap-3 rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-[18px] py-4 transition-colors hover:border-[#4a875b]"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#4a875b1a]">
          <ScaleIcon />
        </div>
        <div className="flex-1">
          <div className="mb-0.5 text-[13px] font-bold text-[#2b2620]">
            体組成
          </div>
          <div className="text-[10px] text-[#6a6256]">
            まだ記録がありません ・ 体重を記録して変化を見える化
          </div>
        </div>
        <span className="font-mono text-xs text-[#a59b8c]">→</span>
      </Link>
    );
  }

  const pct = card.ringPct ?? 0;
  const R = 15;
  const C = 2 * Math.PI * R;
  const sub = card.reached
    ? "目標達成 ・ おめでとうございます"
    : card.remainingKg != null
      ? `目標まで あと ${card.remainingKg.toFixed(1)}kg`
      : "目標体重が未設定です";

  return (
    <Link
      href="/record"
      className="flex items-center gap-3 rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-[18px] py-4 transition-colors hover:border-[#4a875b]"
    >
      {/* ミニリング (達成%) */}
      <div className="relative h-10 w-10 flex-shrink-0">
        {card.ringPct != null ? (
          <>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r={R}
                fill="none"
                stroke="#eadfce"
                strokeWidth="5"
              />
              <circle
                cx="20"
                cy="20"
                r={R}
                fill="none"
                stroke="#4a875b"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct / 100)}
                transform="rotate(-90 20 20)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-[#004d40]">
              {pct}%
            </span>
          </>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4a875b1a]">
            <ScaleIcon />
          </div>
        )}
      </div>

      <div className="flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-[13px] font-bold text-[#2b2620]">
          体組成
          {card.daysSinceLatest != null && card.daysSinceLatest >= 7 ? (
            <span className="inline-flex items-center rounded-full bg-[#b8860b] px-1.5 py-[1px] text-[9px] text-white">
              {card.daysSinceLatest}日 記録なし
            </span>
          ) : null}
        </div>
        <div className="text-[10px] text-[#6a6256]">
          現在{" "}
          <b className="font-mono text-[#004d40]">
            {card.currentWeight?.toFixed(1) ?? "—"}
          </b>{" "}
          kg ・ {sub}
        </div>
      </div>
      <span className="font-mono text-xs text-[#a59b8c]">→</span>
    </Link>
  );
}

function ScaleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4a875b"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" />
      <path d="M12 12 15 8" />
    </svg>
  );
}

// =====================================================================
// 掲示板「のりfitnessから」(P2b-1)
// =====================================================================

function BoardSection({
  items,
  hasUnreadReply,
}: {
  items: BoardItem[];
  hasUnreadReply: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4a875b] text-[11px] font-bold text-white">
            の
          </span>
          <span className="text-[13px] font-bold text-[#2b2620]">
            のりfitnessから
          </span>
          {hasUnreadReply && (
            <span className="rounded-full bg-[#4a875b] px-2 py-0.5 text-[10px] font-bold text-white">
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
        {items.map((it) => (
          <li key={it.key} className="py-2 first:pt-0 last:pb-0">
            <BoardRow item={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardRow({ item }: { item: BoardItem }) {
  // 案A: ホームは「短い合図」だけ。日次FBの全文はお知らせ一覧(/notices)で読む。
  //   日次FB   → 「のりから返信が届きました」＋/notices へ
  //   お知らせ → 件名＋詳細(/notices/[id]) へ
  const href = item.kind === "announcement" ? item.href ?? "/notices" : "/notices";
  return (
    <Link href={href} className="block hover:opacity-90">
      <div className="flex items-center gap-2">
        <span className="w-8 flex-shrink-0 font-mono text-[10px] text-[#a59b8c]">
          {item.dateLabel}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {item.kind === "announcement" ? (
            <>
              <span className="flex-shrink-0 rounded bg-[#fbf2dd] px-1.5 py-px text-[9px] font-bold text-[#a5631f]">
                お知らせ
              </span>
              <span className="truncate text-[12.5px] font-bold text-[#2b2620]">
                {item.title}
              </span>
            </>
          ) : (
            <span className="truncate text-[12.5px] text-[#2b2620]">
              のりから返信が届きました
            </span>
          )}
        </div>
        <span className="flex-shrink-0 text-[#a59b8c]">›</span>
      </div>
    </Link>
  );
}

// =====================================================================
// 続きから学ぶ CTA
// =====================================================================

function ContinueCTA({
  lastWatched,
}: {
  lastWatched: Awaited<ReturnType<typeof getMyLastWatchedLesson>>;
}) {
  if (lastWatched) {
    return (
      <Link
        href={lastWatched.href}
        className="block bg-gradient-to-br from-[#4a875b] to-[#34603f] rounded-[14px] px-[18px] py-4 text-white shadow-[0_4px_14px_rgba(0,137,123,0.22)] relative overflow-hidden"
      >
        <div className="text-[11px] opacity-90 mb-1 tracking-[0.03em] flex items-center gap-1">
          <span className="font-mono">▶</span> 続きから学ぶ
        </div>
        <div className="text-[16px] font-bold mb-0.5 pr-12 line-clamp-1">
          {lastWatched.lessonTitle}
        </div>
        <div className="text-[11px] opacity-85 pr-12 line-clamp-1">
          {lastWatched.courseTitle} ・ {lastWatched.chapterTitle}
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#fffdf8]/20 flex items-center justify-center text-sm">
          ▶
        </div>
      </Link>
    );
  }

  // 未受講: 最初のレッスンへ
  return (
    <Link
      href="/courses"
      className="block bg-gradient-to-br from-[#4a875b] to-[#34603f] rounded-[14px] px-[18px] py-4 text-white shadow-[0_4px_14px_rgba(0,137,123,0.22)] relative overflow-hidden"
    >
      <div className="text-[11px] opacity-90 mb-1 tracking-[0.03em] flex items-center gap-1">
        <span className="font-mono">▶</span> 最初のレッスンへ
      </div>
      <div className="text-[16px] font-bold mb-0.5 pr-12">
        コース一覧を開く
      </div>
      <div className="text-[11px] opacity-85 pr-12">
        まずは 1 本見てみましょう
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#fffdf8]/20 flex items-center justify-center text-sm">
        ▶
      </div>
    </Link>
  );
}

// =====================================================================
// 4 機能ブロック
// =====================================================================

function FeatureBlock({
  href,
  name,
  desc,
  icon,
  disabled,
  badge,
}: {
  href?: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: number;
}) {
  const inner = (
    <>
      <div className="relative w-10 h-10 mx-auto mb-2.5 flex items-center justify-center text-[#2b2620]">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#d9743f] text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center font-mono">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <div className="text-[12px] font-semibold text-[#2b2620] mb-0.5">
        {name}
      </div>
      <div className="text-[9px] text-[#6a6256] leading-tight">{desc}</div>
    </>
  );
  const base =
    "bg-[#fffdf8] border border-[#e7dcc9] rounded-[4px] px-3 pt-5 pb-4 text-center transition-[border-color,transform] duration-150";
  if (disabled || !href) {
    return (
      <div className={`${base} opacity-60 cursor-not-allowed`}>{inner}</div>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} hover:border-[#4a875b] hover:-translate-y-px`}
    >
      {inner}
    </Link>
  );
}

// =====================================================================
// 数値 1 枠
// =====================================================================

function StatCell({
  num,
  unit,
  label,
}: {
  num: number | string;
  unit: string;
  label: string;
}) {
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-1.5 py-3 text-center">
      <div className="font-mono text-[22px] font-bold text-[#004d40] leading-none">
        {num}
      </div>
      {unit && (
        <div className="text-[10px] text-[#6a6256] mt-1">{unit}</div>
      )}
      <div className="text-[10px] text-zinc-600 mt-1">{label}</div>
    </div>
  );
}

// =====================================================================
// セクションラベル
// =====================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-[#6a6256] font-bold tracking-[0.06em] mx-4 mt-[18px] mb-2 pl-1">
      {children}
    </div>
  );
}

// =====================================================================
// ユーティリティ
// =====================================================================

// =====================================================================
// アイコン (線画黒一色、 許可絵文字は ✓ ▶ → ← のみ)
// =====================================================================

const ICO_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function MailMiniIcon() {
  return (
    <svg {...ICO_PROPS} width="10" height="10" strokeWidth={2.5}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg {...ICO_PROPS} width="24" height="24">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      {...ICO_PROPS}
      width="20"
      height="20"
      className="text-[#4a875b]"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      {...ICO_PROPS}
      width="20"
      height="20"
      className="text-[#4a875b]"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="m9.5 13 2 2 3.5-4" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...ICO_PROPS} width="18" height="18">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function BarIcon() {
  return (
    <svg {...ICO_PROPS} width="18" height="18">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...ICO_PROPS} width="18" height="18">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
