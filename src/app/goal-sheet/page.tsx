import Link from "next/link";
import { getMyGoalSheet } from "@/lib/goal-sheet/queries";
import { MemberHeader } from "@/components/MemberHeader";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import {
  countFilledSections,
  isCurrentStatusFilled,
  isGoalSelectionFilled,
  isNutritionFilled,
  isPositiveGoalsFilled,
  isSelfImageFilled,
  type AuditComment,
} from "@/lib/goal-sheet/types";
import { SavedToast } from "./SavedToast";

export const dynamic = "force-dynamic";

/**
 * 目標管理シート 閲覧モード (/goal-sheet)
 *
 * 2026-07-13 再設計(案1・見た目のみ): 黒帯カルテ表→大カード型。番号バッジ廃止→記入済=✓丸/未記入=グレー丸。
 *   のり添削=薄い赤の吹き出しに統一。最下部ボタン=「目標修正リクエスト」1本(着地は従来の /goal-sheet/edit)。
 *   ★表示する項目・条件・添削の紐づき・提出日・記入状況n/5 は現行から1つも増減させない(見た目だけ)。
 *   編集画面(edit/GoalSheetEditor.tsx)には一切触れない。
 */
export default async function GoalSheetPage() {
  const sheet = await getMyGoalSheet();

  // === シート未作成: 初回記入 CTA(現状維持) ===
  if (!sheet) {
    return (
      <>
        <RefreshOnFocus />
        <MemberHeader title="目標管理シート" fallbackHref="/" />
        <main className="flex flex-1 flex-col p-6 sm:p-8 bg-[#f9f5ed]">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="rounded-xl bg-[#fffdf8] border border-[#e7dcc9] p-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 text-[#4a875b]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-bold text-[#2b2620]">
                  まずは目標を立てるところから
                </h2>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  目標管理シートに、あなたの現状と目標を記入してください。<br />
                  記入後、のりfitness が添削してフィードバックします。
                </p>
              </div>
              <Link
                href="/goal-sheet/edit"
                className="inline-block rounded-md btn3d text-white px-6 py-3 text-sm font-bold tracking-wide transition-colors"
              >
                記入を始める
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // === シート作成済: 大カード型(案1) ===
  const content = sheet.content;
  const filledCount = countFilledSections(content);
  const cs = content.current_status;
  const gs = content.goal_selection;
  const nt = content.nutrition;
  const audits = content.audits;
  const submittedDate = new Date(sheet.updated_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <>
      <RefreshOnFocus />
      <MemberHeader title="目標管理シート" fallbackHref="/" />
      <main className="flex flex-1 flex-col bg-[#f9f5ed] px-4 py-4">
        <SavedToast />
        <div className="mx-auto w-full max-w-[560px] space-y-2.5">
          {/* 冒頭: 大数字タイル4枚(現行KPIを大型化) */}
          <div className="grid grid-cols-2 gap-2">
            <BigTile label="現状体重" num={cs?.weight_kg ?? "—"} unit="kg" />
            <BigTile label="目標体重" num={gs?.target_weight_kg ?? "—"} unit="kg" green />
            <BigTile label="期限" num={gs?.target_date ? formatShortDate(gs.target_date) : "—"} />
            <BigTile
              label="目標カロリー"
              num={nt?.target_calorie?.toLocaleString() ?? "—"}
              unit="kcal"
            />
          </div>

          {/* 提出日 / 記入状況 n/5(現行の表示を保持) */}
          <div className="flex items-center justify-between px-1 text-[11px] text-[#6a6256]">
            <span>提出 {submittedDate}</span>
            <span>記入状況 {filledCount} / 5 セクション</span>
          </div>

          {/* 総評(あれば・薄赤に統一) */}
          {audits?.summary && (
            <NoriAudit audit={audits.summary} labelSuffix="総評" />
          )}

          {/* 栄養設計(PFCゲージ大表示) — 並び順: タイル→栄養→現状→残り現行順 */}
          <SheetCard title="栄養設計" filled={isNutritionFilled(nt)}>
            <SheetRow label="目標カロリー" value={nt?.target_calorie ? `${nt.target_calorie.toLocaleString()} kcal/日` : "—"} />
            {audits?.field_comments?.target_calorie && <NoriAudit audit={audits.field_comments.target_calorie} />}
            <PfcGauge label="たんぱく質 P" g={nt?.pfc?.p} kcalPerG={4} totalKcal={nt?.target_calorie} />
            {audits?.field_comments?.pfc_p && <NoriAudit audit={audits.field_comments.pfc_p} />}
            <PfcGauge label="脂質 F" g={nt?.pfc?.f} kcalPerG={9} totalKcal={nt?.target_calorie} />
            {audits?.field_comments?.pfc_f && <NoriAudit audit={audits.field_comments.pfc_f} />}
            <PfcGauge label="糖質 C" g={nt?.pfc?.c} kcalPerG={4} totalKcal={nt?.target_calorie} />
            {audits?.field_comments?.pfc_c && <NoriAudit audit={audits.field_comments.pfc_c} />}
            {audits?.field_comments?.carb_cycle && <NoriAudit audit={audits.field_comments.carb_cycle} />}
            {/* 合計(小さく残す) */}
            <div className="mt-1 flex justify-between border-t border-dashed border-[#f0ead9] pt-1.5 text-[11px] text-[#6a6256]">
              <span>合計</span>
              <span className="font-mono">
                {nt?.pfc?.p && nt?.pfc?.f && nt?.pfc?.c
                  ? `${(nt.pfc.p * 4 + nt.pfc.f * 9 + nt.pfc.c * 4).toLocaleString()} kcal`
                  : "—"}
              </span>
            </div>
            {audits?.section_comments?.nutrition && <NoriAudit audit={audits.section_comments.nutrition} />}
          </SheetCard>

          {/* 現状を把握 */}
          <SheetCard title="現状を把握" filled={isCurrentStatusFilled(cs)}>
            <SheetRow label="体重" value={fmt(cs?.weight_kg, "kg")} />
            {audits?.field_comments?.weight_kg && <NoriAudit audit={audits.field_comments.weight_kg} />}
            <SheetRow label="身長" value={fmt(cs?.height_cm, "cm")} muted="(プロフィール連動)" />
            {audits?.field_comments?.height_cm && <NoriAudit audit={audits.field_comments.height_cm} />}
            <SheetRow label="ウエスト" value={fmt(cs?.waist_cm, "cm")} />
            {audits?.field_comments?.waist_cm && <NoriAudit audit={audits.field_comments.waist_cm} />}
            <SheetRow label="首回り" value={fmt(cs?.neck_cm, "cm")} />
            {audits?.field_comments?.neck_cm && <NoriAudit audit={audits.field_comments.neck_cm} />}
            <SheetRow label="体脂肪率" value={fmt(cs?.body_fat_pct, "%")} />
            {audits?.field_comments?.body_fat_pct && <NoriAudit audit={audits.field_comments.body_fat_pct} />}
            <SheetRow label="メンテ kcal" value={cs?.maintenance_kcal ? `${cs.maintenance_kcal.toLocaleString()} kcal/日` : "—"} />
            {audits?.field_comments?.maintenance_kcal && <NoriAudit audit={audits.field_comments.maintenance_kcal} />}
            {audits?.section_comments?.current_status && <NoriAudit audit={audits.section_comments.current_status} />}
          </SheetCard>

          {/* 目標の選定 */}
          <SheetCard title="目標の選定" filled={isGoalSelectionFilled(gs)}>
            <SheetRow
              label="目標体重"
              value={
                cs?.weight_kg && gs?.target_weight_kg
                  ? `${cs.weight_kg.toFixed(1)} kg → ${gs.target_weight_kg.toFixed(1)} kg`
                  : "—"
              }
              muted={
                cs?.weight_kg && gs?.target_weight_kg
                  ? `(${(gs.target_weight_kg - cs.weight_kg).toFixed(1)} kg)`
                  : undefined
              }
            />
            {audits?.field_comments?.target_weight_kg && <NoriAudit audit={audits.field_comments.target_weight_kg} />}
            <SheetRow label="到達予定日" value={gs?.target_date ? formatFullDate(gs.target_date) : "—"} />
            {audits?.field_comments?.target_date && <NoriAudit audit={audits.field_comments.target_date} />}
            <SheetRow label="短期目標" value={gs?.short_term ?? "—"} />
            {audits?.field_comments?.short_term && <NoriAudit audit={audits.field_comments.short_term} />}
            <SheetRow label="長期目標" value={gs?.long_term ?? "—"} />
            {audits?.field_comments?.long_term && <NoriAudit audit={audits.field_comments.long_term} />}
            <SheetRow label="プロセス" value={gs?.process ?? "—"} />
            {audits?.field_comments?.process && <NoriAudit audit={audits.field_comments.process} />}
            {audits?.section_comments?.goal_selection && <NoriAudit audit={audits.section_comments.goal_selection} />}
          </SheetCard>

          {/* プラスの感情を含むゴール */}
          <SheetCard title="プラスの感情を含むゴール" filled={isPositiveGoalsFilled(content.positive_goals)}>
            <SheetRow label="達成時の気持ち" value={content.positive_goals?.achievement_feeling ?? "—"} />
            {audits?.field_comments?.achievement_feeling && <NoriAudit audit={audits.field_comments.achievement_feeling} />}
            {audits?.section_comments?.positive_goals && <NoriAudit audit={audits.section_comments.positive_goals} />}
          </SheetCard>

          {/* セルフイメージ改善 */}
          <SheetCard title="セルフイメージ改善" filled={isSelfImageFilled(content.self_image)}>
            {content.self_image && content.self_image.length > 0 ? (
              content.self_image.map((item, i) => {
                // admin の fieldKey = `self_image_${item.key}` (例 self_image_item_1)
                const comment = item.key
                  ? audits?.field_comments?.[`self_image_${item.key}`]
                  : undefined;
                return (
                  <div key={item.key ?? i}>
                    <SheetRow
                      label={`項目 ${i + 1}`}
                      value={
                        item.before !== undefined && item.after !== undefined
                          ? `${item.before} → ${item.after} (0-10)`
                          : "未記入"
                      }
                      muted={item.label}
                    />
                    {comment && <NoriAudit audit={comment} />}
                  </div>
                );
              })
            ) : (
              <SheetRow label="状態" value="" muted="未記入 (8 項目)" />
            )}
            {audits?.section_comments?.self_image && <NoriAudit audit={audits.section_comments.self_image} />}
          </SheetCard>

          {/* 最下部ボタン1本: 目標修正リクエスト(緑立体・祝福型)。着地は従来の /goal-sheet/edit(挙動不変)。 */}
          <Link
            href="/goal-sheet/edit"
            className="mt-1 block rounded-[10px] py-3.5 text-center text-[14px] font-extrabold text-white active:translate-y-[2px]"
            style={{
              background: "linear-gradient(180deg,#54946a,#4a875b 45%,#34603f)",
              boxShadow: "0 5px 0 #274c31, 0 9px 18px rgba(52,96,63,0.3)",
            }}
          >
            目標修正リクエスト
          </Link>
        </div>
      </main>
    </>
  );
}

// =====================================================================
// 子コンポーネント (Server Component で完結)
// =====================================================================

// 冒頭の大数字タイル
function BigTile({
  label,
  num,
  unit,
  green,
}: {
  label: string;
  num: string | number;
  unit?: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[#e7dcc9] bg-[#fffdf8] px-3 py-2.5">
      <div className="mb-0.5 text-[10px] font-bold text-[#6a6256]">{label}</div>
      <div className="leading-none">
        <span className={`text-[22px] font-extrabold ${green ? "text-[#34603f]" : "text-[#2b2620]"}`}>
          {num}
        </span>
        {unit && <span className="ml-0.5 text-[11px] text-[#a59b8c]">{unit}</span>}
      </div>
    </div>
  );
}

// 白カードのセクション。見出し=✓丸バッジ(記入済=緑✓/未記入=グレー丸)＋大見出し。番号は出さない。
function SheetCard({
  title,
  filled,
  children,
}: {
  title: string;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[#e7dcc9] bg-[#fffdf8] px-3.5 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-extrabold ${
            filled ? "bg-[#34603f] text-white" : "bg-[#e2ddd2] text-[#b8b0a0]"
          }`}
          aria-label={filled ? "記入済" : "未記入"}
        >
          {filled ? "✓" : ""}
        </span>
        <h2 className="text-[15px] font-extrabold text-[#2b2620]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// 1データ行: ラベル(左)＋値(右)。
function SheetRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#f0ead9] py-[7px] last:border-0">
      <span className="flex-none text-[12px] text-[#6a6256]">{label}</span>
      <span className="min-w-0 text-right">
        <span className="text-[14px] font-bold text-[#2b2620]">{value}</span>
        {muted && <span className="ml-1 text-[11px] text-[#a59b8c]">{muted}</span>}
      </span>
    </div>
  );
}

// PFC ゲージ(g・kcal・% は現行値そのまま)。g未設定は「—」。
function PfcGauge({
  label,
  g,
  kcalPerG,
  totalKcal,
}: {
  label: string;
  g?: number;
  kcalPerG: number;
  totalKcal?: number;
}) {
  if (g === undefined) {
    return <SheetRow label={label} value="—" />;
  }
  const kcal = g * kcalPerG;
  const pct = totalKcal ? Math.round((kcal / totalKcal) * 100) : 0;
  return (
    <div className="border-b border-dashed border-[#f0ead9] py-[7px] last:border-0">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-bold text-[#2b2620]">{label}</span>
        <span className="text-[#6a6256]">
          <b className="font-mono text-[13px] text-[#2b2620]">{g} g</b> ・ {kcal.toLocaleString()} kcal
          {totalKcal ? ` ・ ${pct} %` : ""}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e3ddcf]">
        <div className="h-full rounded-full bg-[#4a875b]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// のり添削(薄い赤の吹き出しに統一)。ラベル「のりfitnessの添削」＋日付は小さく残す(who は畳む)。
function NoriAudit({ audit, labelSuffix }: { audit: AuditComment; labelSuffix?: string }) {
  return (
    <div className="mt-2 rounded-md border-l-[3px] border-[#c2693f] bg-[#fdecec] px-2.5 py-1.5">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] font-extrabold text-[#c2693f]">
          のりfitnessの添削{labelSuffix ? `（${labelSuffix}）` : ""}
        </span>
        {audit.date && (
          <span className="font-mono text-[10px] text-[#c2693f]/70">{audit.date}</span>
        )}
      </div>
      <div className="text-[12px] leading-relaxed text-[#8a3d2a]">{audit.text}</div>
    </div>
  );
}

// =====================================================================
// ユーティリティ
// =====================================================================

function fmt(num: number | undefined, unit: string): string {
  if (num === undefined) return "—";
  return `${num} ${unit}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ごろ`;
}
