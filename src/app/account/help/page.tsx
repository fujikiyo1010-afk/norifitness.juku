import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-static";

/**
 * ヘルプ画面 ・ /account/help (2026-06-17 線① 新設)
 *
 * 静的 FAQ。 内容は線① 時点で多くなく、 のり氏に随時追記してもらう。
 */
export default function HelpPage() {
  return (
    <main className="flex flex-1 flex-col bg-[#ebdfc6] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8]">
        <MemberHeader title="ヘルプ" fallbackHref="/account" />

        <div className="px-4 pt-5 pb-8 space-y-5">
          <Faq
            q="動画が再生できません"
            a="Wi-Fi に接続して再度お試しください。 改善しない場合はブラウザを最新版に更新するか、 シークレットウィンドウで開いて確認してみてください。"
          />
          <Faq
            q="目標管理シートが添削されないのですが"
            a="のり氏が直接添削する仕組みのため、 数日いただくことがあります。 1 週間以上待っても返信がない場合は LINE サポートからご連絡ください。"
          />
          <Faq
            q="筋トレフォームのチェックを依頼したい"
            a="記録タブの「筋トレ → リクエスト」 からフォーム動画を送ってください。 のり氏が個別にフィードバックします。"
          />
          <Faq
            q="プロテインの発送状況を知りたい"
            a="LINE サポートでお問い合わせください。 順次発送しています。"
          />
          <Faq
            q="退会したいのですが"
            a="LINE サポートからご連絡ください。 個別対応します。"
          />

          <div className="mt-6 bg-[#f8f9fa] border border-[#e7dcc9] rounded-2xl px-4 py-4">
            <p className="text-[12px] text-zinc-700 leading-[1.7]">
              ここに載っていない質問は <strong>LINE サポート</strong> までお気軽にどうぞ。 のり氏 ・ 事務局が直接お返事します。
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
