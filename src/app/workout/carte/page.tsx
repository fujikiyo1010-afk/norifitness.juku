import { redirect } from "next/navigation";
import Link from "next/link";
import { getMyCarte, getMyCurrentMenu } from "@/lib/workout/queries";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * 受講生カルテ閲覧画面 (/workout/carte)
 *
 * 設計元:
 *   - /goal-sheet/page.tsx のカルテ風テーブル表示パターンを踏襲
 *   - Phase 2-7 デザイン方針: ティール緑 + Nike エッセンス + 線画 SVG
 *
 * 振る舞い:
 *   - カルテなし → /workout/carte/new にリダイレクト
 *   - カルテあり → 表示 (黒帯セクション + データ行)
 *   - メニューなし → 「メニュー作成中」バナー表示
 *   - メニューあり → 「メニュー配布済」バナー + メニュー閲覧 CTA
 */
export default async function WorkoutCartePage() {
  const carte = await getMyCarte();
  if (!carte) {
    redirect("/workout/carte/new");
  }

  const currentMenu = await getMyCurrentMenu();
  const hasMenu = !!currentMenu;
  const submittedDate = new Date(carte.created_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <>
      <MemberHeader title="筋トレカルテ" fallbackHref="/" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#e8ebec]">
        <div className="mx-auto w-full max-w-[980px] space-y-4">
        {/* ドキュメントフレーム */}
        <div className="bg-white border border-[#d4d4d4] rounded-md shadow-sm overflow-hidden">
          {/* ① ヘッダー帯 */}
          <div className="px-5 py-4 border-b border-[#e8ebe9] grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="text-lg font-bold text-zinc-900 tracking-tight">
              筋トレカルテ
            </div>
            <div className="text-xs text-zinc-500 leading-relaxed sm:text-right">
              提出 {submittedDate}<br />
              ステータス {hasMenu ? "メニュー配布済み" : "メニュー作成中"}
            </div>
          </div>

          {/* ② KPI サマリーバー (4 セル) */}
          <div className="px-5 py-3 bg-[#fafafa] border-b border-[#e8ebe9] grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="性別" num={carte.gender} />
            <Kpi
              label="頻度"
              num={carte.frequency_wish ?? "—"}
              highlighted
            />
            <Kpi
              label="環境"
              num={
                carte.environments.length > 0
                  ? carte.environments.length === 1
                    ? carte.environments[0]
                    : `${carte.environments[0]} 他${carte.environments.length - 1}`
                  : "—"
              }
            />
            <Kpi
              label="重点部位"
              num={
                carte.focus_body_parts.length > 0
                  ? carte.focus_body_parts.length === 1
                    ? carte.focus_body_parts[0]
                    : `${carte.focus_body_parts[0]} 他${carte.focus_body_parts.length - 1}`
                  : "—"
              }
            />
          </div>

          {/* ③ メニュー状態バナー */}
          {hasMenu ? (
            <div className="px-5 py-3 bg-[rgba(0,137,123,0.08)] border-b border-[#e8ebe9] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#00897b]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#00695c] tracking-wide">
                    メニュー配布済み
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    あなた専用のメニューが届いています
                  </div>
                </div>
              </div>
              <Link
                href="/workout"
                className="rounded-md bg-[#00897b] hover:bg-[#00695c] text-white px-4 py-2 text-xs font-bold tracking-wide transition-colors flex-shrink-0"
              >
                メニューを見る
              </Link>
            </div>
          ) : (
            <div className="px-5 py-3 bg-[rgba(255,235,59,0.12)] border-b border-[#e8ebe9] flex items-center gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(255,235,59,0.4)]">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#92400e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#b8860b] tracking-wide">
                  メニュー作成中
                </div>
                <div className="text-[10px] text-zinc-700 leading-relaxed">
                  のりfitness があなたのカルテを確認しています。
                  できあがったらアプリで通知が届きます。
                </div>
              </div>
            </div>
          )}

          {/* ④ 本体カルテ表 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              {/* セクション 01 あなたについて */}
              <SectionBand num="01" title="あなたについて" />
              <tbody>
                <DataRow label="性別" value={carte.gender} />
                <DataRow
                  label="使える環境"
                  value={
                    carte.environments.length > 0
                      ? carte.environments.join(" ・ ")
                      : "—"
                  }
                />
                <DataRow
                  label="理想の頻度"
                  value={carte.frequency_wish ?? "—"}
                />
                <DataRow
                  label="鍛えたい部位"
                  value={
                    carte.focus_body_parts.length > 0
                      ? carte.focus_body_parts.join(" ・ ")
                      : "—"
                  }
                />
              </tbody>

              {/* セクション 02 のりfitness への参考情報 */}
              <SectionBand num="02" title="のりfitness への参考情報" />
              <tbody>
                <DataRow
                  label="目的"
                  value={
                    carte.purposes.length > 0
                      ? carte.purposes.join(" ・ ")
                      : "—"
                  }
                />
                <DataRow
                  label="今までの運動経験"
                  value={carte.experience ?? "—"}
                />
                <DataRow
                  label="気になる体の不調"
                  value={
                    carte.medical_limits.length > 0
                      ? carte.medical_limits.join(" ・ ")
                      : "なし"
                  }
                />
                <DataRow label="目指す身体像" value={carte.ideal_body ?? "—"} />
              </tbody>
            </table>
          </div>

          {/* ⑤ フッター */}
          <div className="px-5 py-3 bg-[#fafafa] border-t border-[#e8ebe9] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="text-[10px] text-zinc-600 leading-relaxed">
              内容を変更したい時は、右のボタンから
              <br className="sm:hidden" />
              のりfitness にお伝えください。
            </div>
            <Link
              href="/workout/carte/request"
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white border border-[#00897b] text-[#00695c] hover:bg-[rgba(0,137,123,0.08)] px-4 py-2 text-xs font-bold tracking-wide transition-colors flex-shrink-0"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              カルテ更新リクエスト
            </Link>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

// =====================================================================
// 子コンポーネント (goal-sheet/page.tsx と統一)
// =====================================================================

function Kpi({
  label,
  num,
  highlighted,
}: {
  label: string;
  num: string;
  highlighted?: boolean;
}) {
  return (
    <div className="bg-white border border-[#e8ebe9] rounded-md px-3 py-2">
      <div className="text-[10px] text-zinc-500 tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`font-medium text-zinc-900 leading-none ${
          highlighted ? "font-bold" : ""
        }`}
      >
        <span
          className={`text-sm ${
            highlighted
              ? "inline-block border-b-2 border-[#00897b] pb-0.5"
              : ""
          }`}
        >
          {num}
        </span>
      </div>
    </div>
  );
}

function SectionBand({ num, title }: { num: string; title: string }) {
  return (
    <thead>
      <tr>
        <td
          colSpan={2}
          className="bg-black text-white px-4 py-2 text-[10px] tracking-widest font-semibold"
        >
          <span className="text-[#00897b] font-mono mr-2">{num}</span>
          {title}
        </td>
      </tr>
    </thead>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="w-[150px] bg-[#fafafa] text-zinc-500 border-r border-[#e8ebe9] border-b border-[#e8ebe9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        {label}
      </td>
      <td className="border-b border-[#e8ebe9] px-4 py-2 text-[11px] text-zinc-900 align-top">
        <span className="font-medium">{value}</span>
      </td>
    </tr>
  );
}
