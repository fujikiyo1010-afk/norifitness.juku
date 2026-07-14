"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 受講生 UI 下部タブナビ (5 タブ)
 *
 * モック: docs/03_design_mocks/recovered/ホーム画面_v4_(ティール緑統一版).html
 * 確定: 2026-06-09 (screen_master)
 *
 * 表示条件:
 *   - 非表示パス (login / invite / admin / etc) では何も出さない
 *   - PWA standalone 前提のため、 戻り動線として最重要
 *
 * スペーサー方式:
 *   - 表示時は <Spacer> + <nav fixed> の両方を描画
 *   - layout で {children} の後ろに配置すると、 末尾コンテンツがタブで被らない
 *   - 各ページに pb-24 を手で足さない方針 (漏れ + 再発リスク回避)
 */
// アイコン(2026-07-14): のり監修のGemini仕様書画像を機械トレース→中心線抽出で太さ統一
//   →視覚重心センタリングした線画SVG。public/icons/nav/*.svg をCSSマスクで現行配色に着色。
//   チャットのみ吹き出しSVGをインライン(細線1.4・確定A)。
// 3番目のタブ: ベータ=チャット / 非ベータ=記録(点21・確定7/7)
const TAB_RECORD = { label: "記録", href: "/record", mask: "record", exact: false };
const TAB_CHAT = { label: "チャット", href: "/messages", chat: true, exact: false };

function tabsFor(isBeta: boolean) {
  return [
    { label: "ホーム", href: "/", mask: "home", exact: true },
    { label: "コース", href: "/courses", mask: "course", exact: false },
    isBeta ? TAB_CHAT : TAB_RECORD,
    { label: "筋トレ", href: "/workout", mask: "workout", exact: false },
    { label: "プロフィール", href: "/profile", mask: "profile", exact: false },
  ];
}

const HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/invite",
  "/onboarding", // オンボ中は受講生用ナビを出さない (= Step の「次へ」 ボタンを隠さない)
  "/forgot-password",
  "/reset-password",
  "/debug",
  // /messages(チャット)は 2026-07-13 に下部ナビ表示へ変更(他画面と統一)。
  // ページ側を「100dvh - ナビ高さ」に縮め、入力欄がナビの真上に来るよう調整済み。
  "/meals/new", // 旧・食事投稿(現在は/mealsへリダイレクトのみ。実投稿は/mealsのボトムシート)
  // /workout/today(実施記録)は 2026-07-13 に下部ナビ表示へ変更(他画面と統一)。
  // 固定の「今日のトレ完了/開始」バーはナビの上へ持ち上げ済み。
  // 完了直後の祝福画面(?done=1)だけは、その画面自身が :root[data-hide-membernav] を立てて隠す。
];

export function MemberBottomNav({ isBeta = false }: { isBeta?: boolean }) {
  const pathname = usePathname() ?? "/";
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  const TABS = tabsFor(isBeta);

  return (
    <>
      {/* 下部ナビの一時非表示(2026-07-13): フルスクリーンの行き止まり画面(トレ完了 祝福 等)が
          マウント中だけ :root に data-hide-membernav="1" を立て、ナビ本体とスペーサーを消す。
          画面が消えた瞬間にナビが戻る(コンポーネントのライフサイクルに追随=取りこぼしなし)。
          globals.css でなくここに置くのは、CSS も component と同じHMR単位で確実に反映させるため。 */}
      <style>{`:root[data-hide-membernav="1"] .member-nav{display:none!important}`}</style>

      {/* スペーサー: タブの物理高さに合わせて末尾に確保 (= 末尾コンテンツが nav に隠れない保証)。
          ブラウザ通常: 60px (= nav 自身 55-60px をカバー)
          PWA + iPhone: 60 + safe-area-inset-bottom (= 34px) = 94px (= nav + ホームインジケータをカバー)
          2026-06-18 改: 固定 h-16 (64px) では PWA で隠れる問題があり動的計算に。 */}
      <div
        aria-hidden
        className="member-nav flex-shrink-0"
        style={{
          height: "calc(60px + env(safe-area-inset-bottom))",
        }}
      />

      <nav className="member-nav fixed bottom-0 inset-x-0 z-40 bg-[#fffdf8] border-t border-[#e7dcc9] safe-bottom">
        <div className="mx-auto max-w-md flex">
          {TABS.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 items-center justify-center py-1 transition-colors ${
                  isActive ? "text-[#4a875b]" : "text-[#6a6256] hover:text-[#2b2620]"
                }`}
              >
                {/* 選択ピル: 全タブ同一幅(70px・案2/案3中間)。長い「プロフィール」でも同幅で崩れない。 */}
                <span
                  style={{ width: 70, maxWidth: "100%" }}
                  className={`flex flex-col items-center gap-0.5 rounded-[14px] px-0.5 py-1.5 transition-colors ${
                    isActive ? "bg-[#eaf3ec]" : ""
                  }`}
                >
                  {"chat" in tab && tab.chat ? (
                    <ChatIcon />
                  ) : (
                    <MaskIcon name={(tab as { mask: string }).mask} />
                  )}
                  <span
                    className={`text-[10px] leading-none whitespace-nowrap ${
                      isActive ? "font-extrabold text-[#34603f]" : "font-bold"
                    }`}
                  >
                    {tab.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// 機械トレースの線画SVG(public/icons/nav/*.svg)をCSSマスクで着色(背景色=currentColor)。
// SVGは中心線抽出で全アイコン太さ統一+視覚重心センタリング済み(viewBox 260角・26px表示)。
function MaskIcon({ name }: { name: string }) {
  const url = `url(/icons/nav/${name}.svg)`;
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: 26,
        height: 26,
        backgroundColor: "currentColor",
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

// チャット吹き出し(確定A・22px・細線1.4)。他アイコンと同じ26px枠に収めて縦位置を揃える。
function ChatIcon() {
  return (
    <span className="flex items-center justify-center" style={{ width: 26, height: 26 }}>
      <svg
        width="22"
        height="22"
        viewBox="2.5 2.5 19 19"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </span>
  );
}
