import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getMyCurrentMonthAudit } from "@/lib/monthly-audit/queries";
import { formatTargetMonthLabel } from "@/lib/monthly-audit/types";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * 月次添削 送信完了画面 (/monthly-review/complete)
 *
 * 設計元: /tmp/monthly_review_complete.html (Phase 2-7 モック)
 *
 * 表示条件:
 *   - 当月の月次添削が提出済 (submitted_at あり)
 *   - 未提出なら /monthly-review/form にリダイレクト (直接アクセス防止)
 *
 * 構成:
 *   - 温かいグラデ背景
 *   - キャラ画像 140px
 *   - ✓ チェックマーク (ティール緑)
 *   - 「送信完了!」+ 「今月もお疲れさまでした」
 *   - ステータスカード 3 行 (送信完了 / 確認中 / 返信予定)
 *   - CTA: 履歴を見る
 *   - サブリンク: ホームに戻る
 */
export default async function MonthlyReviewCompletePage() {
  const audit = await getMyCurrentMonthAudit();

  // 未提出の場合はフォームへリダイレクト
  if (!audit || !audit.submitted_at) {
    redirect("/monthly-review/form");
  }

  const submittedAt = new Date(audit.submitted_at);
  const submittedAtLabel = submittedAt.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const monthLabel = formatTargetMonthLabel(audit.target_month);

  return (
    <>
      <MemberHeader title="月次添削 送信完了" fallbackHref="/monthly-review" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#f9f5ed]">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden min-h-[640px] flex flex-col">
          {/* 完了画面本体 (温かいグラデ背景) */}
          <div className="flex-1 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] flex flex-col items-center justify-center px-7 py-10 text-center">
            {/* キャラ画像 (140px 円形、scale 1.2 で黒円を枠外に追い出す) */}
            <div className="w-[140px] h-[140px] rounded-full shadow-lg mb-6 overflow-hidden bg-[#fffdf8] relative">
              <Image
                src="/images/nori-character.png"
                alt="のりキャラクター"
                width={140}
                height={140}
                className="w-full h-full object-cover"
                style={{ transform: "scale(1.2)" }}
                priority
              />
            </div>

            {/* チェックマーク (ティール緑円 + 白チェック) */}
            <div className="w-14 h-14 rounded-full bg-[#4a875b] text-white flex items-center justify-center mb-4 shadow-[0_4px_12px_rgba(0,137,123,0.25)]">
              <svg
                className="w-7 h-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* メイン文言 */}
            <div className="text-[22px] font-bold text-[#2b2620] mb-2">
              送信完了!
            </div>
            <div className="text-sm text-zinc-700 mb-8">
              今月もお疲れさまでした
            </div>

            {/* ステータスカード */}
            <div className="bg-[#fffdf8]/85 border border-[rgba(0,137,123,0.15)] rounded-2xl px-4 py-3.5 mb-7 w-full max-w-[340px] space-y-2">
              <div className="flex items-center gap-2.5 text-xs text-zinc-700">
                <span className="text-[#4a875b] font-bold">✓</span>
                <span className="flex-1 text-left">
                  <b className="text-[#34603f] font-bold">{monthLabel}</b> 送信完了
                </span>
                <span className="text-[10px] text-[#6a6256] font-mono whitespace-nowrap">
                  {submittedAtLabel}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-zinc-700">
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0 text-[#6a6256]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                <span className="flex-1 text-left">
                  のりfitness が{" "}
                  <b className="text-[#34603f] font-bold">確認中</b>...
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-zinc-700">
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0 text-[#6a6256]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="flex-1 text-left">
                  返信は <b className="text-[#34603f] font-bold">数日以内</b>{" "}
                  にお届けします
                </span>
              </div>
            </div>

            {/* CTA ボタン: 履歴を見る */}
            <Link
              href="/monthly-review"
              className="btn3d text-white rounded-2xl px-6 py-3.5 text-[13px] font-bold w-full max-w-[340px] flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,137,123,0.25)] transition-colors"
            >
              月次添削履歴を見る
              <span className="text-base">→</span>
            </Link>

            {/* サブリンク: ホームに戻る */}
            <Link
              href="/"
              className="mt-3.5 text-[11px] text-[#6a6256] hover:text-zinc-700 underline"
            >
              ホームに戻る
            </Link>
          </div>
          </div>
        </div>
      </main>
    </>
  );
}
