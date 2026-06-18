import { redirect } from "next/navigation";
import Link from "next/link";
import { getMyCarte, getMyCurrentMenu } from "@/lib/workout/queries";
import { MenuView } from "./MenuView";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * 受講生メニュー閲覧画面 (/workout)
 *
 * 設計元: /tmp/workout_menu_view_v6.html (確定モック、2026-06-02 きよむさん合意)
 *
 * 振る舞い:
 *   - カルテ未提出 → /workout/carte/new にリダイレクト
 *   - カルテ提出済 & メニュー未配布 → 「メニュー作成中」表示
 *   - カルテ提出済 & メニュー配布済 → メニュー本体表示 (MenuView)
 */
export default async function WorkoutPage() {
  const carte = await getMyCarte();
  if (!carte) {
    redirect("/workout/carte/new");
  }

  const menu = await getMyCurrentMenu();

  // メニュー未配布: 作成中バナー
  if (!menu) {
    return <WaitingForMenu carte={carte} />;
  }

  // メニュー配布済: 本体表示
  return <MenuView carte={carte} menu={menu} />;
}

// =====================================================================
// メニュー作成中の Server Component
// =====================================================================

function WaitingForMenu({ carte }: { carte: NonNullable<Awaited<ReturnType<typeof getMyCarte>>> }) {
  const submittedDate = new Date(carte.created_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <>
      <MemberHeader title="筋トレ" fallbackHref="/" />
      <div className="min-h-screen bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-6">
          <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
            {/* 温かいグラデ説明 */}
          <div className="px-4 py-6 text-center bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-b border-[#e7dcc9]">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#34603f] tracking-wide mb-3">
              <svg
                className="w-3.5 h-3.5"
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
              メニュー作成中
            </div>
            <div className="text-base font-bold text-[#2b2620] mb-2 leading-relaxed">
              のりfitness があなたの
              <br />
              カルテを確認しています
            </div>
            <div className="text-xs text-zinc-700 leading-relaxed">
              できあがったらアプリで通知が届きます。
              <br />
              少々お待ちください。
            </div>
          </div>

          {/* カルテサマリ */}
          <div className="p-4 space-y-3">
            <div className="bg-[#f9f5ed] border border-[#e7dcc9] rounded-lg p-4">
              <div className="text-[11px] font-bold text-[#6a6256] tracking-wide mb-3">
                提出したカルテ
              </div>
              <dl className="grid grid-cols-[80px_1fr] gap-y-1.5 gap-x-3 text-xs">
                <dt className="text-[#6a6256] text-[11px]">性別</dt>
                <dd className="text-[#2b2620] font-semibold">{carte.gender}</dd>
                <dt className="text-[#6a6256] text-[11px]">使える環境</dt>
                <dd className="text-[#2b2620] font-semibold">
                  {carte.environments.length > 0 ? carte.environments.join("・") : "—"}
                </dd>
                <dt className="text-[#6a6256] text-[11px]">理想の頻度</dt>
                <dd className="text-[#2b2620] font-semibold">
                  {carte.frequency_wish ?? "—"}
                </dd>
                <dt className="text-[#6a6256] text-[11px]">重点部位</dt>
                <dd className="text-[#2b2620] font-semibold">
                  {carte.focus_body_parts.length > 0
                    ? carte.focus_body_parts.join("・")
                    : "—"}
                </dd>
              </dl>
              <Link
                href="/workout/carte"
                className="block text-center text-[11px] text-[#34603f] font-bold border-t border-[#e7dcc9] mt-3 pt-3"
              >
                カルテを見る →
              </Link>
            </div>

            <div className="text-[11px] text-[#6a6256] text-center leading-relaxed">
              通常 1〜3 日以内にメニューが届きます
              <br />
              {submittedDate} にカルテ提出済み
            </div>
          </div>

          {/* フッタ (disabled) */}
          <div className="bg-[#fffdf8] border-t border-[#e7dcc9] px-4 py-3">
            <button
              disabled
              className="w-full px-4 py-3 bg-[#e7dcc9] text-[#a59b8c] rounded-2xl text-sm font-bold cursor-not-allowed"
            >
              メニューはまだありません
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
