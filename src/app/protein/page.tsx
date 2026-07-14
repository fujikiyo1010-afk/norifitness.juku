import { redirect } from "next/navigation";
import { isBetaUser } from "@/lib/auth/beta";
import { MemberHeader } from "@/components/MemberHeader";
import {
  PROTEIN_SHOP_URL,
  PROTEIN_COUPON_CODE,
  PROTEIN_DISCOUNT_PERCENT,
} from "@/lib/protein/config";
import { CouponCopy } from "./CouponCopy";

export const dynamic = "force-dynamic";

/**
 * プロテイン購入(5大機能④・軽量版・ベータ限定)。
 * アプリ内では決済しない。外部ショップ(できトレ)への購入ボタン＋受講生専用クーポンだけ。
 */
export default async function ProteinPage() {
  const isBeta = await isBetaUser();
  if (!isBeta) redirect("/");

  return (
    <>
      <MemberHeader title="プロテイン" fallbackHref="/" />
      <main className="min-h-[100dvh] bg-[#f9f5ed]">
        <div className="mx-auto max-w-[460px] px-4 py-5">
          <div className="overflow-hidden rounded-2xl border border-[#e7dcc9] bg-[#fffdf8]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/protein-cocoa.jpg"
              alt="飲むたんぱく質 ソイ&ホエイプロテイン ココア風味 タンパク質22.4g"
              width={970}
              height={600}
              className="w-full"
            />
            <div className="px-5 py-6">
              <h1 className="text-[18px] font-extrabold text-[#2b2620]">
                筋肉塾の受講生に、飲むたんぱく質を
              </h1>
              <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-[#4a4436]">
                <p>
                  たんぱく質がおいしく摂れる、ソイ＆ホエイのプロテインです。後味すっきりのココア風味で、続けやすい一杯を。
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-[#eaf3ec] px-3 py-2.5 text-[11px] font-bold leading-[1.7] tracking-[-0.015em] text-[#34603f]">
                <p>
                  受講生は専用クーポンで、
                  <span className="text-[#c2693f]">
                    何個買っても{PROTEIN_DISCOUNT_PERCENT}％オフ。
                  </span>
                </p>
                <p>まとめ買いにもそのまま使えます。</p>
              </div>

              {/* クーポン＋コピー */}
              <div className="mt-4">
                <CouponCopy code={PROTEIN_COUPON_CODE} />
                <p className="mt-2 text-[11px] leading-relaxed text-[#9a917f]">
                  コピーしたコードを、購入ページのクーポン欄に貼ってください（進むと入力欄が出ます）。
                </p>
              </div>

              {/* 購入ボタン */}
              <a
                href={PROTEIN_SHOP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex min-h-[52px] items-center justify-center rounded-xl btn3d px-5 text-[15px] font-bold text-white transition-colors"
              >
                購入ページを開く →
              </a>
              <p className="mt-2.5 text-center text-[11px] text-[#9a917f]">
                購入ページ（外部）が開きます
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
