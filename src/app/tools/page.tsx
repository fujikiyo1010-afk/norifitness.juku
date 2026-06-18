import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";

export const metadata = {
  title: "ツール | 筋肉塾",
};

/**
 * 計算ツール一覧画面 (/tools)
 *
 * 設計元: /tmp/tools_index.html (Phase 2-7 モック)
 *
 * 役割:
 *   - 4 つの計算ツールへの導線
 *   - 順序固定 (体脂肪率 → カロリー → 期間 → PFC、目標シートを自然に埋めるフロー)
 *
 * 配色:
 *   - ツール群はインディゴ #3949ab (受講生 UI 全体のティール緑 #4a875b と区別、
 *     「ここは計算する場所」を直感的に伝えるための役割色分け、合意の正典セクション 4)
 *
 * 認証: middleware (src/proxy.ts) で自動。このページ自身では何もしない。
 */
export default function ToolsIndexPage() {
  return (
    <>
      <MemberHeader title="ツール" fallbackHref="/" />
      <main className="min-h-screen bg-[#fafbfa] flex flex-col">

      <div className="flex-1 max-w-[460px] mx-auto w-full pb-12">
        {/* ヒーロー帯 */}
        <section className="bg-gradient-to-br from-[#e8eaf6] to-[#fffbe6] border-b border-[#e7dcc9] px-6 py-5">
          <h2 className="text-xl font-bold text-[#1a237e] mb-1.5 flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[18px] h-[18px]"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            計算ツール
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            カラダづくりに必要な数値を、まとめて。
            <br />
            気になった時、日々の見直しに。
          </p>
        </section>

        {/* ツール 4 カード */}
        <section className="px-4 py-5 flex flex-col gap-3">
          <ToolCard
            href="/tools/body-fat"
            name="体脂肪率計算"
            desc="現状把握を埋める ・ アメリカ海軍式"
          />
          <ToolCard
            href="/tools/calorie"
            name="必要カロリー計算"
            desc="基礎代謝 / メンテ / ダイエット / 増量"
          />
          <ToolCard
            href="/tools/diet-period"
            name="減量期間逆算"
            desc="目標体重までの期間と到達予定日"
          />
          <ToolCard
            href="/tools/pfc-carb"
            name="PFC・カーボサイクル設定"
            desc="栄養素の数値 + 1 週間の糖質配分 (統合)"
          />
        </section>

        {/* flow-tip */}
        <aside className="mx-4 my-2 px-4 py-3.5 bg-[#f8f9fa] rounded-lg text-[11px] text-zinc-600 leading-relaxed">
          <div className="flex items-start gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 text-[#283593] flex-shrink-0 mt-0.5"
            >
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
            <div>
              <span className="font-bold text-[#283593]">はじめての方へ</span>
              <br />
              体脂肪率 → カロリー → 期間 → PFC の順で使うと、目標管理シートが自然に埋まります。
            </div>
          </div>
        </aside>
      </div>
    </main>
    </>
  );
}

// =====================================================================
// 子コンポーネント
// =====================================================================

function ToolCard({
  href,
  name,
  desc,
}: {
  href: string;
  name: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="bg-[#fffdf8] border border-[#e7dcc9] rounded-xl px-4 py-4 flex items-center gap-3.5 hover:border-[#3949ab] transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-[#2b2620] mb-0.5">{name}</div>
        <div className="text-[11px] text-[#6a6256] leading-relaxed">{desc}</div>
      </div>
      <div className="text-[#3949ab] font-mono text-sm flex-shrink-0">→</div>
    </Link>
  );
}
