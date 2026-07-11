import { redirect } from "next/navigation";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import { getFormReviewFirstDone } from "@/lib/form-review/status";
import {
  FORM_REVIEW_URL_FIRST,
  FORM_REVIEW_URL_REPEAT,
  FORM_REVIEW_PRICE_REPEAT,
} from "@/lib/form-review/config";

export const dynamic = "force-dynamic";

/**
 * フォーム添削(5大機能②・ベータ限定)。
 * 本体はUTAGE予約ページへの遷移だけ。初回完了フラグでURL/文言を出し分ける。
 * 誘導文章はのりさん最終確認までの仮版(のち差し替え)。
 */
export default async function FormReviewPage() {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  const firstDone = await getFormReviewFirstDone();
  const url = firstDone ? FORM_REVIEW_URL_REPEAT : FORM_REVIEW_URL_FIRST;

  return (
    <>
      <MemberHeader title="フォーム添削" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          <div className="rounded-2xl border border-[#e7dcc9] bg-[#fffdf8] px-5 py-6">
            {firstDone ? (
              <>
                <h1 className="text-[18px] font-extrabold text-[#2b2620]">
                  フォーム、さらに磨きましょう
                </h1>
                <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-[#4a4436]">
                  <p>
                    気になったときが、伸ばしどきです。トレーナーがオンラインで直接見て、その場で一緒に整えていきます。
                  </p>
                  <p>
                    ボタンから予約ページへ進み、日にちと時間を指定してください。
                  </p>
                </div>
                <div className="mt-4 rounded-xl bg-[#f3ede0] px-4 py-3 text-[12.5px] font-bold text-[#5b5344]">
                  2回目以降は1回{" "}
                  <span className="text-[#c2693f]">
                    {FORM_REVIEW_PRICE_REPEAT.toLocaleString()}円
                  </span>
                  。何度でも受けられます。1回あたり1時間前後が目安です。
                </div>
              </>
            ) : (
              <>
                <h1 className="text-[18px] font-extrabold text-[#2b2620]">
                  フォーム、いっしょに仕上げましょう
                </h1>
                <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-[#4a4436]">
                  <p>
                    あなたのトレーニングフォームを、トレーナーが直接見ます。オンラインで画面をつなぎ、その場でやり取りしながら、気になるところをその日のうちに整えていきます。
                  </p>
                  <p>
                    ボタンから予約ページへ進み、ご希望の日にちと時間を指定してください。
                  </p>
                </div>
                <div className="mt-4 rounded-xl bg-[#eaf3ec] px-4 py-3 text-[12.5px] font-bold text-[#34603f]">
                  初回は無料。まずは一度、今のフォームを見せてください。1回あたり1時間前後、じっくり向き合います。
                </div>
              </>
            )}

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex min-h-[52px] items-center justify-center rounded-xl btn3d px-5 text-[15px] font-bold text-white transition-colors"
            >
              フォーム添削を依頼する →
            </a>
            <p className="mt-2.5 text-center text-[11px] text-[#9a917f]">
              予約ページ（外部）が開きます
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
