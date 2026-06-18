import Link from "next/link";
import { getMyGoalSheet } from "@/lib/goal-sheet/queries";
import { MemberHeader } from "@/components/MemberHeader";
import {
  SECTION_META,
  countFilledSections,
  type GoalSheetContent,
  type CurrentStatus,
  type GoalSelection,
  type Nutrition,
  type PositiveGoals,
  type SelfImageItem,
  type AuditComment,
} from "@/lib/goal-sheet/types";
import { SavedToast } from "./SavedToast";

export const dynamic = "force-dynamic";

/**
 * 目標管理シート 閲覧モード (/goal-sheet)
 *
 * 設計元:
 *   - /tmp/goal_sheet_overview.html (Phase 2-7 モック)
 *   - Phase 2-7 デザイン方針: ティール緑 #4a875b + Nike エッセンス + 線画 SVG
 *
 * 画面切替:
 *   - シート未作成 → 初回記入 CTA
 *   - シート作成済 → カルテ風 (ドキュメント風) で全項目表示
 */
export default async function GoalSheetPage() {
  const sheet = await getMyGoalSheet();

  // === シート未作成: 初回記入 CTA ===
  if (!sheet) {
    return (
      <>
        <MemberHeader title="目標管理シート" fallbackHref="/" />
        <main className="flex flex-1 flex-col p-6 sm:p-8 bg-[#e8ebec]">
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
              className="inline-block rounded-md bg-[#4a875b] hover:bg-[#34603f] text-white px-6 py-3 text-sm font-bold tracking-wide transition-colors"
            >
              記入を始める
            </Link>
          </div>
        </div>
      </main>
      </>
    );
  }

  // === シート作成済: カルテ風表示 ===
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
      <MemberHeader title="目標管理シート" fallbackHref="/" />
      <main className="flex flex-1 flex-col p-4 sm:p-6 bg-[#e8ebec]">
      <SavedToast />
      <div className="mx-auto w-full max-w-[980px] space-y-4">
        {/* ドキュメントフレーム */}
        <div className="bg-[#fffdf8] border border-[#d4d4d4] rounded-md shadow-sm overflow-hidden">
          {/* ① ヘッダー帯 */}
          <div className="px-5 py-4 border-b border-[#e7dcc9] grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="text-lg font-bold text-[#2b2620] tracking-tight">
              目標管理シート
            </div>
            <div className="text-xs text-[#6a6256] leading-relaxed sm:text-right">
              提出 {submittedDate}<br />
              記入状況 {filledCount} / 5 セクション
            </div>
          </div>

          {/* ② KPI サマリーバー (4 セル) */}
          <div className="px-5 py-3 bg-[#fafafa] border-b border-[#e7dcc9] grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi label="現状体重" num={cs?.weight_kg ?? "—"} unit="kg" />
            <Kpi label="目標体重" num={gs?.target_weight_kg ?? "—"} unit="kg" highlighted />
            <Kpi label="期限" num={gs?.target_date ? formatShortDate(gs.target_date) : "—"} />
            <Kpi label="目標 kcal" num={nt?.target_calorie?.toLocaleString() ?? "—"} />
          </div>

          {/* ③ 総評バー */}
          {audits?.summary && <SummaryBar audit={audits.summary} />}

          {/* ④ 本体カルテ表 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              {/* セクション 01 現状を把握 */}
              <SectionBand num="01" title="現状を把握" />
              <tbody>
                <DataRow label="体重" value={fmt(cs?.weight_kg, "kg")} />
                <DataRow label="身長" value={fmt(cs?.height_cm, "cm")} muted="(プロフィール連動)" />
                <DataRow label="ウエスト" value={fmt(cs?.waist_cm, "cm")} />
                <DataRow label="首回り" value={fmt(cs?.neck_cm, "cm")} />
                <DataRow
                  label="体脂肪率"
                  value={fmt(cs?.body_fat_pct, "%")}
                  auditTag={audits?.field_comments?.body_fat_pct ? "添削 1" : undefined}
                />
                <DataRow label="メンテ kcal" value={cs?.maintenance_kcal ? `${cs.maintenance_kcal.toLocaleString()} kcal/日` : "—"} />
                {audits?.section_comments?.current_status && (
                  <AuditRow audit={audits.section_comments.current_status} />
                )}
              </tbody>

              {/* セクション 02 目標の選定 */}
              <SectionBand num="02" title="目標の選定" />
              <tbody>
                <DataRow
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
                  auditTag={audits?.field_comments?.target_weight_kg ? "添削 1" : undefined}
                />
                <DataRow label="到達予定日" value={gs?.target_date ? formatFullDate(gs.target_date) : "—"} />
                <DataRow label="短期目標" value={gs?.short_term ?? "—"} />
                <DataRow label="長期目標" value={gs?.long_term ?? "—"} />
                <DataRow label="プロセス" value={gs?.process ?? "—"} />
                {audits?.section_comments?.goal_selection && (
                  <AuditRow audit={audits.section_comments.goal_selection} />
                )}
              </tbody>

              {/* セクション 03 栄養設計 */}
              <SectionBand num="03" title="栄養設計" />
              <tbody>
                <DataRow label="目標カロリー" value={nt?.target_calorie ? `${nt.target_calorie.toLocaleString()} kcal/日` : "—"} />
                <PfcRow label="たんぱく質 (P)" g={nt?.pfc?.p} kcalPerG={4} totalKcal={nt?.target_calorie} />
                <PfcRow label="脂質 (F)" g={nt?.pfc?.f} kcalPerG={9} totalKcal={nt?.target_calorie} />
                <PfcRow label="糖質 (C)" g={nt?.pfc?.c} kcalPerG={4} totalKcal={nt?.target_calorie} />
                <DataRow
                  label="合計"
                  value={
                    nt?.pfc?.p && nt?.pfc?.f && nt?.pfc?.c
                      ? `${(nt.pfc.p * 4 + nt.pfc.f * 9 + nt.pfc.c * 4).toLocaleString()} kcal`
                      : "—"
                  }
                />
                {audits?.section_comments?.nutrition && (
                  <AuditRow audit={audits.section_comments.nutrition} />
                )}
              </tbody>

              {/* セクション 04 プラスの感情を含むゴール */}
              <SectionBand num="04" title="プラスの感情を含むゴール" />
              <tbody>
                <DataRow
                  label="達成時の気持ち"
                  value={content.positive_goals?.achievement_feeling ?? "—"}
                />
                {audits?.section_comments?.positive_goals && (
                  <AuditRow audit={audits.section_comments.positive_goals} />
                )}
              </tbody>

              {/* セクション 05 セルフイメージ改善 */}
              <SectionBand num="05" title="セルフイメージ改善" />
              <tbody>
                {content.self_image && content.self_image.length > 0 ? (
                  content.self_image.map((item, i) => (
                    <DataRow
                      key={item.key ?? i}
                      label={`項目 ${i + 1}`}
                      value={
                        item.before !== undefined && item.after !== undefined
                          ? `${item.before} → ${item.after} (0-10)`
                          : "未記入"
                      }
                      muted={item.label}
                    />
                  ))
                ) : (
                  <DataRow label="状態" value="" muted="未記入 (8 項目)" />
                )}
                {audits?.section_comments?.self_image && (
                  <AuditRow audit={audits.section_comments.self_image} />
                )}
              </tbody>
            </table>
          </div>

          {/* ⑤ フッター */}
          <div className="px-5 py-3 bg-[#fafafa] border-t border-[#e7dcc9] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="flex flex-wrap gap-4 justify-center sm:justify-start">
              <FooterLink href="#" label="編集履歴" />
              <FooterLink href="#" label="変化を見る" />
              <FooterLink href="#" label="過去の添削履歴 (0)" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Link
                href="/goal-sheet/edit"
                className="inline-block text-center rounded-md border border-zinc-300 bg-[#fffdf8] hover:bg-[#f9f5ed] text-zinc-700 px-4 py-2 text-xs font-bold tracking-wide transition-colors"
              >
                修正する
              </Link>
              <Link
                href="/"
                className="inline-block text-center rounded-md bg-[#4a875b] hover:bg-[#34603f] text-white px-4 py-2 text-xs font-bold tracking-wide transition-colors"
              >
                ホームに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

// =====================================================================
// 子コンポーネント (Server Component で完結)
// =====================================================================

function Kpi({
  label,
  num,
  unit,
  highlighted,
}: {
  label: string;
  num: string | number;
  unit?: string;
  highlighted?: boolean;
}) {
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-md px-3 py-2">
      <div className="text-[10px] text-[#6a6256] tracking-wide mb-1">{label}</div>
      <div className={`font-medium text-[#2b2620] leading-none ${highlighted ? "font-bold" : ""}`}>
        <span
          className={`text-base ${
            highlighted
              ? "inline-block border-b-2 border-[#4a875b] pb-0.5"
              : ""
          }`}
        >
          {num}
        </span>
        {unit && <span className="text-[11px] text-[#6a6256] ml-1 font-normal">{unit}</span>}
      </div>
    </div>
  );
}

function SummaryBar({ audit }: { audit: AuditComment }) {
  return (
    <div className="px-5 py-3 bg-[rgba(255,235,59,0.12)] border-b border-[#e7dcc9]">
      <div className="flex justify-between items-center mb-1">
        <div className="text-[10px] text-[#b8860b] font-medium tracking-wide">
          {audit.who} 総評
        </div>
        <div className="text-[10px] text-[#6a6256] font-mono">{audit.date}</div>
      </div>
      <div className="text-[11px] text-zinc-700 leading-relaxed">{audit.text}</div>
    </div>
  );
}

function SectionBand({ num, title }: { num: string; title: string }) {
  return (
    <thead>
      <tr>
        <td colSpan={2} className="bg-black text-white px-4 py-2 text-[10px] tracking-widest font-semibold">
          <span className="text-[#4a875b] font-mono mr-2">{num}</span>
          {title}
        </td>
      </tr>
    </thead>
  );
}

function DataRow({
  label,
  value,
  muted,
  auditTag,
}: {
  label: string;
  value: string;
  muted?: string;
  auditTag?: string;
}) {
  return (
    <tr>
      <td className="w-[150px] bg-[#fafafa] text-[#6a6256] border-r border-[#e7dcc9] border-b border-[#e7dcc9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        {label}
      </td>
      <td className="border-b border-[#e7dcc9] px-4 py-2 text-[11px] text-[#2b2620] align-top">
        <span className="font-medium">{value}</span>
        {muted && <span className="text-[10px] text-[#6a6256] ml-1">{muted}</span>}
        {auditTag && (
          <span className="inline-block bg-[rgba(255,235,59,0.12)] text-[#b8860b] border border-[rgba(255,235,59,0.55)] px-2 py-px text-[9px] rounded-full font-semibold ml-2 align-middle">
            {auditTag}
          </span>
        )}
      </td>
    </tr>
  );
}

function PfcRow({
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
    return <DataRow label={label} value="—" />;
  }
  const kcal = g * kcalPerG;
  const pct = totalKcal ? Math.round((kcal / totalKcal) * 100) : 0;
  return (
    <tr>
      <td className="w-[150px] bg-[#fafafa] text-[#6a6256] border-r border-[#e7dcc9] border-b border-[#e7dcc9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        {label}
      </td>
      <td className="border-b border-[#e7dcc9] px-4 py-2 text-[11px] text-[#2b2620] align-top">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4a875b] flex-shrink-0"></div>
          <div className="font-bold font-mono min-w-[50px]">{g} g</div>
          <div className="text-[10px] text-[#6a6256]">/ {kcal.toLocaleString()} kcal{totalKcal && ` / ${pct} %`}</div>
        </div>
      </td>
    </tr>
  );
}

function AuditRow({ audit }: { audit: AuditComment }) {
  return (
    <tr>
      <td className="w-[150px] bg-[#fafafa] text-[#6a6256] border-r border-[#e7dcc9] border-b border-[#e7dcc9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        添削
      </td>
      <td className="bg-[rgba(255,235,59,0.12)] border-b border-[#e7dcc9] px-4 py-2 align-top">
        <div className="text-[10px] text-[#b8860b] font-medium mb-1">{audit.who}</div>
        <div className="text-[11px] text-zinc-700 leading-relaxed">{audit.text}</div>
      </td>
    </tr>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[10px] text-zinc-600 border-b border-transparent hover:border-zinc-600 transition-colors"
    >
      {label}
    </Link>
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
