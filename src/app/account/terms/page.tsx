import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-static";

/**
 * 利用規約 ・ /account/terms (2026-06-17 線① 新設)
 *
 * 線① ローンチ前の最低限版。 のり氏 ・ 法的レビュー後に書き換える前提のドラフト。
 */
export default function TermsPage() {
  return (
    <main className="flex flex-1 flex-col bg-[#f3ecda] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="利用規約" fallbackHref="/account" />

        <div className="px-4 pt-5 pb-8 space-y-4 text-[12px] text-zinc-700 leading-[1.8]">
          <p className="text-[10px] text-[#a59b8c] font-mono">
            最終更新 ・ 2026 年 6 月 17 日
          </p>

          <Section title="第 1 条 (適用)">
            本規約は、 のりfitness (以下「当方」) が提供するオンライン会員制サービス「筋肉塾」 (以下「本サービス」) の利用に関する一切の関係に適用されます。
          </Section>

          <Section title="第 2 条 (会員登録)">
            本サービスの利用を希望する方は、 当方が定める方法により会員登録を行うものとします。 登録情報は正確かつ最新の状態を保ってください。
          </Section>

          <Section title="第 3 条 (利用料金 ・ 支払方法)">
            本サービスの利用料金は、 当方が別途定める方法により表示します。 受講料は買い切り型であり、 原則として支払後の返金は行いません。
          </Section>

          <Section title="第 4 条 (禁止事項)">
            会員は、 本サービスの利用にあたり、 以下の行為をしてはなりません。
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>動画 ・ 教材 ・ コンテンツの複製 ・ 転載 ・ 第三者への共有</li>
              <li>当方または第三者の知的財産権を侵害する行為</li>
              <li>他の会員 ・ のり氏 ・ 事務局に対する迷惑行為</li>
              <li>法令または公序良俗に反する行為</li>
            </ul>
          </Section>

          <Section title="第 5 条 (コンテンツの著作権)">
            本サービスで提供する動画 ・ 教材 ・ シート 等のコンテンツの著作権は、 当方または正当な権利者に帰属します。 会員は私的利用の範囲を超えて利用してはなりません。
          </Section>

          <Section title="第 6 条 (免責事項)">
            当方は、 本サービスで提供する情報 ・ アドバイスについて、 医学的 ・ 科学的な正確性を保証するものではありません。 健康状態に不安がある方は、 必ず医師に相談の上ご利用ください。
          </Section>

          <Section title="第 7 条 (退会)">
            会員は、 当方所定の方法により退会することができます。 退会後の再利用は別途お問い合わせください。
          </Section>

          <Section title="第 8 条 (規約の変更)">
            当方は、 必要と判断した場合、 会員に通知することなく本規約を変更できるものとします。 変更後の規約は本ページに掲載した時点から効力を生じます。
          </Section>

          <Section title="第 9 条 (準拠法 ・ 裁判管轄)">
            本規約の解釈にあたっては日本法を準拠法とし、 本サービスに関して紛争が生じた場合、 当方所在地を管轄する裁判所を専属的合意管轄とします。
          </Section>

          <p className="pt-3 text-[11px] text-[#6a6256]">
            お問い合わせ ・ LINE サポートまたは公式メール
          </p>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold text-[#2b2620] mb-1.5">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
