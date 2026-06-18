import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-static";

/**
 * プライバシーポリシー ・ /account/privacy (2026-06-17 線① 新設)
 *
 * 線① ローンチ前の最低限版。 のり氏 ・ 法的レビュー後に書き換える前提のドラフト。
 */
export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col bg-[#ebdfc6] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9] bg-[#fffdf8]">
        <MemberHeader title="プライバシーポリシー" fallbackHref="/account" />

        <div className="px-4 pt-5 pb-8 space-y-4 text-[12px] text-zinc-700 leading-[1.8]">
          <p className="text-[10px] text-[#a59b8c] font-mono">
            最終更新 ・ 2026 年 6 月 17 日
          </p>

          <Section title="1. 取得する情報">
            当方は、 本サービスの提供にあたり、 以下の情報を取得します。
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>氏名 ・ メールアドレス ・ 生年月日 ・ LINE 表示名</li>
              <li>体重 ・ 体脂肪率 ・ 筋トレ記録 等の健康関連データ (受講生が任意で入力)</li>
              <li>受講進捗 ・ 視聴履歴 ・ 振り返り記録</li>
              <li>プロテイン発送のための住所 ・ 電話番号</li>
            </ul>
          </Section>

          <Section title="2. 利用目的">
            取得した情報は、 以下の目的でのみ利用します。
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>本サービスの提供 ・ 個別添削 ・ サポート</li>
              <li>受講進捗の把握 ・ 改善提案</li>
              <li>プロテイン 等の特典発送</li>
              <li>サービス向上のための統計分析 (個人を特定しない形)</li>
            </ul>
          </Section>

          <Section title="3. 第三者提供">
            法令に基づく場合 ・ 受講生本人の同意がある場合を除き、 個人情報を第三者に提供することはありません。 配送業者 ・ メール送信業者 等の業務委託先には、 業務遂行に必要な範囲で情報を提供することがあります。
          </Section>

          <Section title="4. 安全管理措置">
            個人情報の漏洩 ・ 滅失 ・ 毀損の防止のため、 適切なアクセス制御 ・ 暗号化通信 ・ クラウド事業者のセキュリティ機能を利用しています。
          </Section>

          <Section title="5. 開示 ・ 訂正 ・ 削除請求">
            受講生本人からの開示 ・ 訂正 ・ 削除請求は、 LINE サポートまたは公式メールから受け付けます。 本人確認の上、 速やかに対応します。
          </Section>

          <Section title="6. Cookie ・ 解析ツール">
            本サービスでは、 ログイン状態の保持のために Cookie を利用します。 アクセス解析のために匿名化された情報を取得することがあります。
          </Section>

          <Section title="7. 改定">
            本ポリシーは、 必要に応じて改定することがあります。 改定後の内容は本ページに掲載した時点から効力を生じます。
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
