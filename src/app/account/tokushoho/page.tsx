import { MemberHeader } from "@/components/MemberHeader";

export const dynamic = "force-static";

/**
 * 特定商取引法に基づく表記 ・ /account/tokushoho (2026-06-19 線① 新設)
 *
 * 法的根拠: 特定商取引に関する法律 第 11 条 (通信販売の広告)
 * 通信販売事業者が広告/サイト上で表示しなければならない事項を網羅。
 *
 * ⚠️ プレースホルダ [ TBD ] は ローンチ前に のり氏 / きよむさん 確認で実値に置換。
 * 詳細チェックリスト: docs/00_premises/_legal_info_checklist.md
 */
export default function TokushohoPage() {
  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="特定商取引法に基づく表記" fallbackHref="/account" />

        <div className="px-4 pt-5 pb-8 space-y-4 text-[12px] text-zinc-700 leading-[1.8]">
          <p className="text-[10px] text-[#a59b8c] font-mono">
            最終更新 ・ 2026 年 6 月 19 日
          </p>

          <Row label="販売事業者">のりfitness</Row>
          <Row label="運営統括責任者">[ TBD ・ のり氏 本名 ]</Row>
          <Row label="所在地">[ TBD ・ 事業所住所 ・ 請求があれば遅滞なく開示 ]</Row>
          <Row label="電話番号">[ TBD ・ 請求があれば遅滞なく開示 ]</Row>
          <Row label="メールアドレス">support@norifitness.com</Row>
          <Row label="サイト URL">https://juku.norifitness.com/</Row>

          <Row label="販売価格">
            各受講コースのお申し込みページに記載
            <br />
            (= 例: 筋肉塾 受講料 [ TBD ] 円 ・ 税込)
          </Row>

          <Row label="商品代金以外の必要料金">
            なし
            <br />
            (= プロテイン 等の特典は受講料に含まれます ・ 別途送料の請求はありません)
          </Row>

          <Row label="お支払い方法">
            銀行振込 ・ クレジットカード (Stripe 決済)
          </Row>

          <Row label="お支払い時期">
            お申し込み後 7 日以内 (= 銀行振込の場合)
            <br />
            申込時に即時決済 (= クレジットカードの場合)
          </Row>

          <Row label="サービス提供時期 (引き渡し)">
            ご入金確認後、 通常 1〜3 営業日以内に招待リンクを送付いたします。
            <br />
            招待リンクで会員登録された時点からサービスをご利用いただけます。
          </Row>

          <Row label="返品 ・ キャンセル ・ 返金">
            本サービスはデジタルコンテンツ提供を含むため、 招待リンクの発行後はキャンセル ・ 返金をお受けできません。
            <br />
            お申し込み前に必ず利用規約をご確認ください。
            <br />
            なお、 弊社の責めに帰すべき事由がある場合はこの限りではありません。 公式 LINE またはメールよりご相談ください。
          </Row>

          <Row label="動作環境">
            本サービスは下記環境でのご利用を推奨します:
            <ul className="list-disc pl-5 mt-2 space-y-0.5">
              <li>iPhone iOS 16.4 以上 ・ Safari</li>
              <li>Android 最新 2 バージョン ・ Chrome</li>
              <li>PC ・ Chrome / Safari / Edge 最新版</li>
            </ul>
            動画再生のため安定したインターネット接続が必要です。
          </Row>

          <p className="pt-3 text-[11px] text-[#6a6256]">
            お問い合わせ ・ 公式 LINE またはメール ({" "}
            <a href="mailto:support@norifitness.com" className="underline">
              support@norifitness.com
            </a>
            )
          </p>
        </div>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#e7dcc9] pb-3">
      <h2 className="text-[10px] font-bold text-[#6a6256] tracking-widest mb-1">
        {label}
      </h2>
      <div className="text-[12px] text-[#2b2620] leading-[1.8]">{children}</div>
    </div>
  );
}
