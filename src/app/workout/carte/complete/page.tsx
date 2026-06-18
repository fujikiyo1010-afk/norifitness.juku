import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getMyCarte } from "@/lib/workout/queries";
import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-dynamic";

/**
 * カルテ提出完了画面 (/workout/carte/complete)
 *
 * 役割:
 *   - カルテ提出後の完了演出
 *   - 月次添削 送信完了画面と同じトーン (キャラ + ✓ + 温かいグラデ)
 *   - カルテ未提出のユーザーが直接来た場合は /workout/carte/new にリダイレクト
 */
export default async function WorkoutCarteCompletePage() {
  const carte = await getMyCarte();
  if (!carte) {
    // カルテがない = まだ提出していない、入力画面へ
    redirect("/workout/carte/new");
  }

  return (
    <>
      <MemberHeader title="カルテ 提出完了" fallbackHref="/workout" />
      <div
        className="min-h-screen"
        style={{
          background: "linear-gradient(135deg, #e0f2f1, #fffbe6)",
        }}
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

        {/* タイトル */}
        <h1 className="mb-3 text-center text-xl font-semibold text-[#2b2620]">
          カルテを提出しました
        </h1>

        {/* メッセージ */}
        <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-zinc-700">
          のりfitness があなたの内容を確認して、
          あなた専用のメニューを作成します。
          <br />
          できあがったらアプリで通知が届きます。
        </p>

        {/* ステータスカード */}
        <div className="mb-8 w-full max-w-sm rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">ステータス</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              のりfitness がメニュー作成中
            </span>
          </div>
        </div>

        {/* ボタン群 */}
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/workout/carte"
            className="rounded-[4px] border border-zinc-300 bg-[#fffdf8] px-6 py-3 text-center text-sm font-medium text-zinc-700 hover:bg-[#f0e6d3]"
          >
            提出したカルテを見る
          </Link>
          <Link
            href="/"
            className="rounded-[4px] bg-[#4a875b] px-6 py-3 text-center text-sm font-medium text-white hover:bg-[#34603f]"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
