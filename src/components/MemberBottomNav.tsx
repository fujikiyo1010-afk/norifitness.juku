"use client";

import { useEffect, useState } from "react";
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

function tabsFor(isBeta: boolean, isCalendar: boolean) {
  // 藤田さん先行(calendar-gate): 4番目「筋トレ」をカレンダーに置換。
  // /workout(原本メニュー閲覧)はカレンダー内「配布メニューを見る」から到達(連携メモ §0a ガード①)。
  const fourth = isCalendar
    ? { label: "カレンダー", href: "/calendar", cal: true, exact: false }
    : { label: "筋トレ", href: "/workout", mask: "workout", exact: false };
  return [
    { label: "ホーム", href: "/", mask: "home", exact: true },
    { label: "コース", href: "/courses", mask: "course", exact: false },
    isBeta ? TAB_CHAT : TAB_RECORD,
    fourth,
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

export function MemberBottomNav({
  isBeta = false,
  isCalendar = false,
}: {
  isBeta?: boolean;
  isCalendar?: boolean;
}) {
  const pathname = usePathname() ?? "/";

  // お問い合わせに未読の返事があるか(2026-08-28)。プロフィールタブに赤ドットを出す。
  // 画面遷移のたびに軽く確認(読むと消える)。失敗しても無印なだけ。
  const [supportUnread, setSupportUnread] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/support/unread")
      .then((r) => (r.ok ? r.json() : { unread: false }))
      .then((d) => {
        if (alive) setSupportUnread(!!(d as { unread?: boolean }).unread);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  const TABS = tabsFor(isBeta, isCalendar);

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
                  <span className="relative">
                    {"cal" in tab && tab.cal ? (
                      <CalendarIcon />
                    ) : "chat" in tab && tab.chat ? (
                      <ChatIcon />
                    ) : (
                      <MaskIcon name={(tab as { mask: string }).mask} />
                    )}
                    {/* お問い合わせ未読(プロフィールタブのみ) */}
                    {supportUnread &&
                      "mask" in tab &&
                      (tab as { mask: string }).mask === "profile" && (
                        <span className="absolute -top-0.5 -right-1 h-[9px] w-[9px] rounded-full bg-[#d6536a] ring-2 ring-[#fffdf8]" />
                      )}
                  </span>
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

// カレンダー(藤田先行・筋トレタブ置換)。「予約する」の緑カレンダーを機械トレース→
// やや細(塗り面を均等に痩せ)。塗りはタブ色(currentColor)連動＝選択グリーン/非選択グレー。
function CalendarIcon() {
  return (
    <span className="flex items-center justify-center" style={{ width: 26, height: 26 }}>
      <svg
        width="22"
        height="22"
        viewBox="0 0 126 128"
        fill="currentColor"
        fillRule="evenodd"
        aria-hidden="true"
      >
        <path d="M108.0 125.5 L102.0 125.5 L95.0 123.5 L87.5 118.0 L83.5 108.0 L83.5 97.0 L88.5 86.0 L94.0 82.5 L109.0 81.5 L113.0 83.5 L115.5 81.0 L115.5 43.0 L113.0 40.5 L13.0 40.5 L10.5 43.0 L10.5 112.0 L14.0 115.5 L74.0 115.5 L77.5 123.0 L11.0 123.5 L4.5 119.0 L2.5 114.0 L2.5 22.0 L6.0 15.5 L11.0 12.5 L25.0 12.5 L27.5 10.0 L27.5 5.0 L29.0 2.5 L36.0 2.5 L36.5 10.0 L39.0 12.5 L87.0 12.5 L89.5 10.0 L89.5 5.0 L91.0 2.5 L97.0 2.5 L98.5 4.0 L98.5 10.0 L101.0 12.5 L115.0 12.5 L121.5 17.0 L123.5 21.0 L123.5 113.0 L121.5 118.0 L117.0 122.5 L108.0 125.5 ZM34.5 32.0 L38.5 29.0 L38.5 24.0 L35.0 20.5 L30.0 20.5 L26.5 24.0 L26.5 28.0 L31.0 32.5 L34.5 32.0 ZM96.5 32.0 L100.5 28.0 L100.5 25.0 L97.0 20.5 L92.0 20.5 L87.5 27.0 L91.0 31.5 L96.5 32.0 ZM40.0 69.5 L27.5 69.0 L27.5 57.0 L29.0 55.5 L39.0 55.5 L40.5 57.0 L40.0 69.5 ZM68.0 69.5 L56.5 69.0 L56.5 57.0 L58.0 55.5 L69.5 57.0 L69.5 68.0 L68.0 69.5 ZM97.0 69.5 L87.0 69.5 L85.5 68.0 L86.0 56.5 L96.0 55.5 L98.5 57.0 L98.5 68.0 L97.0 69.5 ZM40.0 97.5 L27.5 97.0 L28.0 84.5 L40.5 85.0 L40.0 97.5 ZM69.0 97.5 L56.5 97.0 L57.0 84.5 L69.5 85.0 L69.0 97.5 ZM106.5 117.0 L109.0 116.5 L114.5 111.0 L116.5 107.0 L116.5 100.0 L113.5 94.0 L110.0 90.5 L102.0 88.5 L93.5 95.0 L91.5 104.0 L93.5 110.0 L100.0 116.5 L106.5 117.0 Z" />
      </svg>
    </span>
  );
}
