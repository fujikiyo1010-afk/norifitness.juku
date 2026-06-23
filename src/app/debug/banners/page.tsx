/**
 * ホーム画面 バナー全パターン プレビュー (= /debug/banners)
 *
 * 目的: のり氏 / 社員 / きよむさん が「ホームに出るバナーの全種類」 を一覧で確認するため。
 * 本番ホーム画面 (src/app/page.tsx) の NoticeBanner / 添削バッジカード を **コピペ移植**。
 * 既存実装に一切依存せず自己完結 (= 既存 page.tsx 改修なし)。
 *
 * URL: https://[preview-domain]/debug/banners
 * 注意: 受講生からは見えないデバッグ用。 本番リンクなし。
 */

import Link from "next/link";

export const dynamic = "force-static";

// =====================================================================
// 型 (= src/lib/member/alerts.ts と同期)
// =====================================================================

type MemberAlertKey =
  | "carte_blank"
  | "goal_sheet_blank"
  | "body_metrics_missing"
  | "body_metrics_stalled"
  | "notification_off";

type MemberAlert = {
  key: MemberAlertKey;
  daysSinceLatest?: number;
};

// =====================================================================
// バナー設定 (= src/app/page.tsx の ALERT_CONFIG コピー)
// =====================================================================

type AlertConfig = {
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
    href: "/body-metrics",
    icon: <BarIcon />,
  },
  body_metrics_stalled: {
    strong: (alert) =>
      `体組成の記録が止まっています (最後 ${alert.daysSinceLatest ?? "?"} 日前)`,
    tail: "。記録しましょう",
    href: "/body-metrics",
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
// 目標管理シート / 月次添削 カード (= 添削あり マイクロバッジ含む)
// =====================================================================

function GoalSheetCard({
  hasContent,
  hasReviewNotice,
}: {
  hasContent: boolean;
  hasReviewNotice: boolean;
}) {
  return (
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
          {hasReviewNotice && (
            <span className="bg-[#b8860b] text-white text-[9px] px-1.5 py-[1px] rounded-full inline-flex items-center gap-1">
              <MailMiniIcon /> 添削あり
            </span>
          )}
        </div>
        <div className="text-[10px] text-[#6a6256]">
          {hasContent
            ? hasReviewNotice
              ? "のりfitness から添削が届いています"
              : "記入済 ・ 添削待ち"
            : "まだ記入されていません"}
        </div>
      </div>
      <span className="text-[#a59b8c] font-mono text-xs">→</span>
    </Link>
  );
}

function MonthlyAuditCard({
  status,
  hasReviewNotice,
}: {
  status: "a_empty" | "b_in_progress" | "c_submitted" | "d_replied";
  hasReviewNotice: boolean;
}) {
  return (
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
          {hasReviewNotice && (
            <span className="bg-[#b8860b] text-white text-[9px] px-1.5 py-[1px] rounded-full inline-flex items-center gap-1">
              <MailMiniIcon /> 添削あり
            </span>
          )}
        </div>
        <div className="text-[10px] text-[#6a6256]">
          {status === "d_replied"
            ? "のりfitness から添削が届いています"
            : status === "c_submitted"
              ? "記入済 ・ 添削待ち"
              : status === "b_in_progress"
                ? "記入中 ・ 提出を待っています"
                : "今月分はまだ記入されていません"}
        </div>
      </div>
      <span className="text-[#a59b8c] font-mono text-xs">→</span>
    </Link>
  );
}

// =====================================================================
// メインページ
// =====================================================================

export default function DebugBannersPage() {
  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-[100dvh]">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        {/* ヘッダー */}
        <header className="px-4 pt-5 pb-3 border-b border-[#e7dcc9]">
          <h1 className="text-[15px] font-bold text-[#2b2620]">
            ホーム画面 バナー全パターン
          </h1>
          <p className="text-[10px] text-[#a59b8c] mt-1">
            実コードからコピー / iPhone サイズで実物そっくり / クリック先は本物
            (= /workout/carte/new 等)
          </p>
        </header>

        {/* =================== セクション 1 =================== */}
        <Section title="① 黄バナー 5 種 (= 個別表示)">
          <Caption>
            「未対応タスク」 がある時に出る警告系バナー。
            複数該当する場合は縦に並びます。
          </Caption>

          <Label>1-1. カルテが未記入</Label>
          <NoticeBanner alert={{ key: "carte_blank" }} />

          <Label>1-2. 目標管理シートが未記入</Label>
          <NoticeBanner alert={{ key: "goal_sheet_blank" }} />

          <Label>1-3. 体組成 まだ記録なし</Label>
          <NoticeBanner alert={{ key: "body_metrics_missing" }} />

          <Label>1-4. 体組成 7 日以上記録なし (= 動的 N 日数)</Label>
          <NoticeBanner
            alert={{ key: "body_metrics_stalled", daysSinceLatest: 10 }}
          />

          <Label>1-5. 通知が OFF</Label>
          <NoticeBanner alert={{ key: "notification_off" }} />
        </Section>

        {/* =================== セクション 2 =================== */}
        <Section title="② 添削あり マイクロバッジ (= 2 箇所)">
          <Caption>
            のり氏が添削して返した時に、 該当カードの右上に「📧 添削あり」
            バッジが付く。 カード本体も含めて全パターン:
          </Caption>

          <Label>2-1. 目標管理シート ・ 未記入</Label>
          <GoalSheetCard hasContent={false} hasReviewNotice={false} />

          <Label>2-2. 目標管理シート ・ 記入済 / 添削なし</Label>
          <GoalSheetCard hasContent={true} hasReviewNotice={false} />

          <Label>2-3. 目標管理シート ・ 記入済 / ★添削あり★</Label>
          <GoalSheetCard hasContent={true} hasReviewNotice={true} />

          <Label>2-4. 月次添削 ・ 未記入 (a_empty)</Label>
          <MonthlyAuditCard status="a_empty" hasReviewNotice={false} />

          <Label>2-5. 月次添削 ・ 記入中 (b_in_progress)</Label>
          <MonthlyAuditCard status="b_in_progress" hasReviewNotice={false} />

          <Label>2-6. 月次添削 ・ 提出済 (c_submitted) / 添削待ち</Label>
          <MonthlyAuditCard status="c_submitted" hasReviewNotice={false} />

          <Label>2-7. 月次添削 ・ ★添削あり (d_replied)★</Label>
          <MonthlyAuditCard status="d_replied" hasReviewNotice={true} />
        </Section>

        {/* =================== セクション 3 =================== */}
        <Section title="③ 組み合わせパターン (= 実受講生の状態想定)">
          <Caption>
            実際の受講生のホーム画面に出る組み合わせ例。
            ここを見れば「リアルにどう見えるか」 が分かります。
          </Caption>

          <Label>3-1. ◆ 新規入会直後 (= オンボ完走 ・ 全タスク未着手)</Label>
          <div className="space-y-2">
            <NoticeBanner alert={{ key: "carte_blank" }} />
            <NoticeBanner alert={{ key: "goal_sheet_blank" }} />
            <NoticeBanner alert={{ key: "body_metrics_missing" }} />
            <NoticeBanner alert={{ key: "notification_off" }} />
            <GoalSheetCard hasContent={false} hasReviewNotice={false} />
            <MonthlyAuditCard status="a_empty" hasReviewNotice={false} />
          </div>

          <Label>
            3-2. ◆ 1 週間目 (= カルテ + 目標シート提出済 / 体組成記録なし)
          </Label>
          <div className="space-y-2">
            <NoticeBanner alert={{ key: "body_metrics_missing" }} />
            <GoalSheetCard hasContent={true} hasReviewNotice={false} />
            <MonthlyAuditCard status="a_empty" hasReviewNotice={false} />
          </div>

          <Label>
            3-3. ◆ 1 ヶ月目 (= 全タスク完了 / 月次提出済 / のり氏返信待ち)
          </Label>
          <div className="space-y-2">
            <GoalSheetCard hasContent={true} hasReviewNotice={false} />
            <MonthlyAuditCard status="c_submitted" hasReviewNotice={false} />
          </div>

          <Label>3-4. ◆ のり氏 添削が届いた! (= 一番嬉しい瞬間)</Label>
          <div className="space-y-2">
            <GoalSheetCard hasContent={true} hasReviewNotice={true} />
            <MonthlyAuditCard status="d_replied" hasReviewNotice={true} />
          </div>

          <Label>
            3-5. ◆ デモ太郎 (= 4ヶ月目 / 体組成 10 日途絶 / カルテ変更リクエスト)
          </Label>
          <div className="space-y-2">
            <NoticeBanner
              alert={{ key: "body_metrics_stalled", daysSinceLatest: 10 }}
            />
            <GoalSheetCard hasContent={true} hasReviewNotice={false} />
            <MonthlyAuditCard status="c_submitted" hasReviewNotice={false} />
          </div>

          <Label>
            3-6. ◆ 全部入り (= 黄バナー 4 + 添削バッジ 2 / 最悪パターン想定)
          </Label>
          <div className="space-y-2">
            <NoticeBanner alert={{ key: "carte_blank" }} />
            <NoticeBanner alert={{ key: "goal_sheet_blank" }} />
            <NoticeBanner
              alert={{ key: "body_metrics_stalled", daysSinceLatest: 14 }}
            />
            <NoticeBanner alert={{ key: "notification_off" }} />
            <GoalSheetCard hasContent={true} hasReviewNotice={true} />
            <MonthlyAuditCard status="d_replied" hasReviewNotice={true} />
          </div>

          <Label>3-7. ◆ 理想状態 (= 全タスク順調 / 添削なし)</Label>
          <div className="space-y-2">
            <GoalSheetCard hasContent={true} hasReviewNotice={false} />
            <MonthlyAuditCard status="a_empty" hasReviewNotice={false} />
          </div>
        </Section>

        <footer className="px-4 py-6 text-center text-[10px] text-[#a59b8c] border-t border-[#e7dcc9] mt-6">
          ホーム画面 v4 ・ デバッグプレビュー ・ 2026-06-23 作成
        </footer>
      </div>
    </main>
  );
}

// =====================================================================
// セクション / ラベル ヘルパー (= debug 専用)
// =====================================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 pt-6 pb-2 space-y-2">
      <h2 className="text-[13px] font-bold text-[#34603f] border-l-4 border-[#4a875b] pl-2.5 mb-2">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#6a6256] font-mono pt-2 pb-1">
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-[#6a6256] leading-relaxed bg-white/50 border border-[#e7dcc9] rounded-lg px-3 py-2 mb-2">
      {children}
    </p>
  );
}

// =====================================================================
// アイコン (= src/app/page.tsx からコピー)
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

function TargetIcon() {
  return (
    <svg {...ICO_PROPS} width="20" height="20" className="text-[#4a875b]">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...ICO_PROPS} width="20" height="20" className="text-[#4a875b]">
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
