import Image from "next/image";
import Link from "next/link";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * リクエスト送信完了画面 (/workout/request-complete?type=carte|menu)
 *
 * カルテ更新リクエスト送信後 と メニュー変更リクエスト送信後 の共通完了画面。
 * クエリパラメータ type で文言を切替。
 */
export default async function RequestCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const isMenu = type === "menu";

  const title = isMenu ? "メニュー変更リクエストを送りました" : "カルテ更新リクエストを送りました";
  const message = isMenu
    ? "のりfitness が確認して、必要に応じてメニューを調整します。\n反映され次第アプリで通知が届きます。"
    : "のりfitness が確認して、必要に応じてカルテを更新します。\n反映され次第アプリで通知が届きます。";
  const backHref = isMenu ? "/workout" : "/workout/carte";
  const backLabel = isMenu ? "メニューに戻る" : "カルテに戻る";

  return (
    <>
      <MemberHeader title="リクエスト 送信完了" fallbackHref={backHref} />
      <div
        className="min-h-screen"
        style={{ background: "linear-gradient(135deg, #e0f2f1, #fffbe6)" }}
      >
        <div className="mx-auto flex min-h-screen max-w-[460px] flex-col items-center justify-center px-6 py-12">
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

        {/* ✓ チェック */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#4a875b]">
          <svg
            width="28"
            height="28"
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

        <h1 className="mb-3 text-center text-lg font-semibold text-[#2b2620] leading-tight">
          {title}
        </h1>

        <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-zinc-700 whitespace-pre-line">
          {message}
        </p>

        {/* ステータスカード */}
        <div className="mb-8 w-full max-w-sm rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">ステータス</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              のりfitness 確認中
            </span>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            href={backHref}
            className="rounded-[4px] bg-[#4a875b] px-6 py-3 text-center text-sm font-medium text-white hover:bg-[#34603f]"
          >
            {backLabel}
          </Link>
          <Link
            href="/"
            className="rounded-[4px] border border-zinc-300 bg-[#fffdf8] px-6 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-[#e0d5be]"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
