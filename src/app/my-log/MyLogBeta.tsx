import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";
import type { MyLogDashboard } from "@/lib/member/my-log-dashboard";

/**
 * 学びの記録(M18・案3ダッシュボード型・P3-2・ベータ限定)。
 *  - フラッシュバックは廃止。
 *  - 上部=数字帯4指標 / 下=大カード。
 *  - 「保存した添削」カードは /history/feedbacks(P7)公開まで非表示。
 */

const TEAL_DARK = "#34603f";

export function MyLogBeta({ data }: { data: MyLogDashboard }) {
  return (
    <>
      <MemberHeader title="学びの記録" fallbackHref="/" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-2.5 border-x border-[#e7dcc9] px-3.5 pb-5 pt-3.5">
          {/* 数字帯 4指標 */}
          <div className="flex rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8]">
            <BandItem
              value={data.progressPercent}
              unit="%"
              label={`進捗（${data.completedLessons}/${data.totalLessons}）`}
            />
            <BandItem value={data.reviewCount} unit="件" label="振り返り" divider />
            <BandItem
              value={data.implementationRate}
              unit="%"
              label="宣言→実践"
              divider
            />
            <BandItem value={data.streakDays} unit="日" label="継続" divider />
          </div>

          {/* 振り返りノート */}
          <BigCard
            href="/my-log/reviews"
            iconBg="#eaf3ec"
            iconColor={TEAL_DARK}
            icon={<NoteIcon />}
            title="振り返りノート"
            count={`${data.reviewCount}件`}
            desc={
              data.latestReview
                ? `書いた言葉は財産。検索・コース別に読み返せます／最新: 「${trim(data.latestReview.title)}」${data.latestReview.dateLabel}`
                : "書いた言葉は財産。学んだことを書き留めると、ここに残ります"
            }
          />

          {/* 実践リスト */}
          <BigCard
            href="/my-log/actions"
            iconBg="#fdf0e2"
            iconColor="#b06a1e"
            icon={<FlagIcon />}
            title="実践リスト"
            count={
              data.untriedCount > 0 ? `試してない ${data.untriedCount}` : "すべて実践済み"
            }
            desc={
              data.latestUntriedText
                ? `宣言したこと、やれていますか／「${trim(data.latestUntriedText)}」が待っています`
                : "レッスンで「試してみたいこと」を宣言すると、ここに並びます"
            }
          />

          {/* 完了レッスン */}
          <BigCard
            href="/my-log/completed"
            iconBg="#e8f0fa"
            iconColor="#3a6ea5"
            icon={<CheckIcon />}
            title="完了レッスン"
            count={`${data.completedLessons}本`}
            desc={
              data.latestCompleted
                ? `最新: ${trim(data.latestCompleted.title)} ${data.latestCompleted.dateLabel}`
                : "視聴を完了したレッスンが、ここに積み上がります"
            }
          />

          {/* 保存した添削(P7・入口のみ→デイリー添削ページの保存済みへ直着地) */}
          <BigCard
            href="/history/feedbacks?tab=saved"
            iconBg="#f6ecc8"
            iconColor="#8a6d10"
            icon={<BookmarkIcon />}
            title="保存した添削"
            count={`${data.savedFeedbackCount}件`}
            desc={
              data.savedFeedbackCount > 0
                ? "しおりでとっておいた、のりの言葉。くじけた日に開く場所です"
                : "心に残ったのりの言葉を、しおりでとっておけます"
            }
          />
        </div>
      </main>
    </>
  );
}

function trim(s: string, max = 16): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function BandItem({
  value,
  unit,
  label,
  divider = false,
}: {
  value: number;
  unit: string;
  label: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex-1 px-1 py-2.5 text-center ${divider ? "border-l border-[#f0ead9]" : ""}`}
    >
      <div className="text-[16px] font-extrabold" style={{ color: TEAL_DARK }}>
        {value}
        <span className="text-[9px] font-semibold text-[#a59b8c]">{unit}</span>
      </div>
      <div className="mt-px text-[8.5px] font-bold leading-tight text-[#6a6256]">
        {label}
      </div>
    </div>
  );
}

function BigCard({
  href,
  iconBg,
  iconColor,
  icon,
  title,
  count,
  desc,
}: {
  href: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  count: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-start gap-3 rounded-[15px] border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3.5 transition-colors hover:bg-emerald-50/40"
    >
      <span
        className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-[13.5px] font-extrabold text-[#2b2620]">
          {title}
          <span className="text-[10.5px] font-bold" style={{ color: TEAL_DARK }}>
            {count}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] leading-relaxed text-[#6a6256]">{desc}</div>
      </div>
      <span className="text-[#c9bfa9]">›</span>
    </Link>
  );
}

// ── 線画アイコン (SVG・絵文字不使用) ──
const ICO = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 17,
  height: 17,
};

function NoteIcon() {
  return (
    <svg {...ICO}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg {...ICO}>
      <path d="M5 3v18M5 3h11l-2 4 2 4H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICO}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg {...ICO}>
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
