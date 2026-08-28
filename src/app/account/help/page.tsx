import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-static";

/**
 * よくある質問 ・ /account/help (2026-06-17 線① 新設 / 2026-08-28 改)
 *
 * 2026-08-28: 名前を「ヘルプ」→「よくある質問」に変更(プロフィールの入口と統一)。
 * 旧文面の「LINE サポートへ」誘導を全廃し、お問い合わせ窓口(/support)へ集約。
 * 入口はプロフィール(戻り先も /profile)。内容はのり氏に随時追記してもらう。
 */
export default function HelpPage() {
  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="よくある質問" fallbackHref="/profile" />

        <div className="px-4 pt-5 pb-8 space-y-5">
          <Faq
            q="動画が再生できません"
            a="Wi-Fi に接続して再度お試しください。 改善しない場合は、アプリを一度完全に終了して開き直してみてください。 それでも直らないときは、プロフィールの「お問い合わせ」からお知らせください。"
          />
          <Faq
            q="目標管理シートが添削されないのですが"
            a="のり氏が直接添削する仕組みのため、 数日いただくことがあります。 1 週間以上待っても返信がない場合は、プロフィールの「お問い合わせ」からご連絡ください。"
          />
          <Faq
            q="筋トレフォームのチェックを依頼したい"
            a="ホームの「フォーム添削」からお申し込みください。 のり氏が個別にフィードバックします。"
          />
          <Faq
            q="プロテインの発送状況を知りたい"
            a="プロフィールの「お問い合わせ」からご連絡ください。 確認してお返事します。"
          />
          <Faq
            q="退会したいのですが"
            a="プロフィールの「お問い合わせ」からご連絡ください。 個別対応します。"
          />

          <div className="mt-6 bg-[#f8f9fa] border border-[#e7dcc9] rounded-2xl px-4 py-4">
            <p className="text-[12px] text-zinc-700 leading-[1.7]">
              ここに載っていないことや、アプリの不具合・動作や操作のお困りごとは、
              プロフィールの <strong>「お問い合わせ」</strong> からお送りください。
              担当者が確認して、アプリの中でお返事します。
              <br />
              食事やトレーニングのご相談は、これまでどおり
              <strong>チャット</strong>へお送りください。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden group">
      <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[#2b2620] flex-1">{q}</span>
        <span className="text-[#a59b8c] text-sm transition-transform group-open:rotate-90">→</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-[12px] text-zinc-600 leading-[1.7] border-t border-[#e7dcc9]">
        {a}
      </div>
    </details>
  );
}
