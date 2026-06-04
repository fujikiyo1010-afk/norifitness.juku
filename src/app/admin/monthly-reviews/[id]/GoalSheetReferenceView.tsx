/**
 * 月次添削個別作業画面の「目標シート」参考タブ用 読み取り専用ビュー
 *
 * 設計元: /goal-sheet/page.tsx (受講生閲覧モード) の本体表示を流用
 * 違い:
 *   - main / breadcrumb / 編集ボタン は出さない (タブ内表示のため)
 *   - 表示のみ、編集動線なし (のり氏が録画中に「ちらっと参照」する用途)
 */
import {
  countFilledSections,
  type GoalSheetContent,
  type GoalSheetRow,
  type AuditComment,
} from "@/lib/goal-sheet/types";

export function GoalSheetReferenceView({
  sheet,
}: {
  sheet: GoalSheetRow | null;
}) {
  if (!sheet) {
    return (
      <div className="bg-white border border-[#e8ebe9] rounded-xl px-5 py-10 text-center">
        <div className="mx-auto w-10 h-10 text-zinc-400 mb-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-full"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        <div className="text-sm text-zinc-600">
          この受講生はまだ目標シートを作成していません
        </div>
      </div>
    );
  }

  const content: GoalSheetContent = sheet.content;
  const cs = content.current_status;
  const gs = content.goal_selection;
  const nt = content.nutrition;
  const audits = content.audits;
  const filledCount = countFilledSections(content);
  const updatedDate = new Date(sheet.updated_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div className="bg-white border border-[#d4d4d4] rounded-md shadow-sm overflow-hidden">
      {/* ① ヘッダー帯 */}
      <div className="px-5 py-4 border-b border-[#e8ebe9] grid grid-cols-[1fr_auto] gap-3 items-center">
        <div className="text-lg font-bold text-zinc-900 tracking-tight">
          目標管理シート
        </div>
        <div className="text-xs text-zinc-500 leading-relaxed text-right">
          最終更新 {updatedDate}
          <br />
          記入状況 {filledCount} / 5 セクション
        </div>
      </div>

      {/* ② KPI サマリーバー */}
      <div className="px-5 py-3 bg-[#fafafa] border-b border-[#e8ebe9] grid grid-cols-4 gap-2">
        <Kpi label="現状体重" num={cs?.weight_kg ?? "—"} unit="kg" />
        <Kpi
          label="目標体重"
          num={gs?.target_weight_kg ?? "—"}
          unit="kg"
          highlighted
        />
        <Kpi
          label="期限"
          num={gs?.target_date ? formatShortDate(gs.target_date) : "—"}
        />
        <Kpi
          label="目標 kcal"
          num={nt?.target_calorie?.toLocaleString() ?? "—"}
        />
      </div>

      {/* ③ 総評バー */}
      {audits?.summary && <SummaryBar audit={audits.summary} />}

      {/* ④ 本体カルテ表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          {/* 01 現状を把握 */}
          <SectionBand num="01" title="現状を把握" />
          <tbody>
            <DataRow label="体重" value={fmt(cs?.weight_kg, "kg")} />
            <DataRow
              label="身長"
              value={fmt(cs?.height_cm, "cm")}
              muted="(プロフィール連動)"
            />
            <DataRow label="ウエスト" value={fmt(cs?.waist_cm, "cm")} />
            <DataRow label="首回り" value={fmt(cs?.neck_cm, "cm")} />
            <DataRow
              label="体脂肪率"
              value={fmt(cs?.body_fat_pct, "%")}
              auditTag={
                audits?.field_comments?.body_fat_pct ? "添削 1" : undefined
              }
            />
            <DataRow
              label="メンテ kcal"
              value={
                cs?.maintenance_kcal
                  ? `${cs.maintenance_kcal.toLocaleString()} kcal/日`
                  : "—"
              }
            />
            {audits?.section_comments?.current_status && (
              <AuditRow audit={audits.section_comments.current_status} />
            )}
          </tbody>

          {/* 02 目標の選定 */}
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
              auditTag={
                audits?.field_comments?.target_weight_kg ? "添削 1" : undefined
              }
            />
            <DataRow
              label="到達予定日"
              value={gs?.target_date ? formatFullDate(gs.target_date) : "—"}
            />
            <DataRow label="短期目標" value={gs?.short_term ?? "—"} />
            <DataRow label="長期目標" value={gs?.long_term ?? "—"} />
            <DataRow label="プロセス" value={gs?.process ?? "—"} />
            {audits?.section_comments?.goal_selection && (
              <AuditRow audit={audits.section_comments.goal_selection} />
            )}
          </tbody>

          {/* 03 栄養設計 */}
          <SectionBand num="03" title="栄養設計" />
          <tbody>
            <DataRow
              label="目標カロリー"
              value={
                nt?.target_calorie
                  ? `${nt.target_calorie.toLocaleString()} kcal/日`
                  : "—"
              }
            />
            <PfcRow
              label="たんぱく質 (P)"
              g={nt?.pfc?.p}
              kcalPerG={4}
              totalKcal={nt?.target_calorie}
            />
            <PfcRow
              label="脂質 (F)"
              g={nt?.pfc?.f}
              kcalPerG={9}
              totalKcal={nt?.target_calorie}
            />
            <PfcRow
              label="糖質 (C)"
              g={nt?.pfc?.c}
              kcalPerG={4}
              totalKcal={nt?.target_calorie}
            />
            {audits?.section_comments?.nutrition && (
              <AuditRow audit={audits.section_comments.nutrition} />
            )}
          </tbody>

          {/* 04 プラスの感情を含むゴール */}
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

          {/* 05 セルフイメージ改善 */}
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
    </div>
  );
}

// =====================================================================
// 子コンポーネント
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
    <div className="bg-white border border-[#e8ebe9] rounded-md px-3 py-2">
      <div className="text-[10px] text-zinc-500 tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`font-medium text-zinc-900 leading-none ${
          highlighted ? "font-bold" : ""
        }`}
      >
        <span
          className={`text-base ${
            highlighted ? "inline-block border-b-2 border-[#00897b] pb-0.5" : ""
          }`}
        >
          {num}
        </span>
        {unit && (
          <span className="text-[11px] text-zinc-500 ml-1 font-normal">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryBar({ audit }: { audit: AuditComment }) {
  return (
    <div className="px-5 py-3 bg-[rgba(255,235,59,0.12)] border-b border-[#e8ebe9]">
      <div className="flex justify-between items-center mb-1">
        <div className="text-[10px] text-[#b8860b] font-medium tracking-wide">
          {audit.who} 総評
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">{audit.date}</div>
      </div>
      <div className="text-[11px] text-zinc-700 leading-relaxed">
        {audit.text}
      </div>
    </div>
  );
}

function SectionBand({ num, title }: { num: string; title: string }) {
  return (
    <thead>
      <tr>
        <td
          colSpan={2}
          className="bg-black text-white px-4 py-2 text-[10px] tracking-widest font-semibold"
        >
          <span className="text-[#00897b] font-mono mr-2">{num}</span>
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
      <td className="w-[150px] bg-[#fafafa] text-zinc-500 border-r border-[#e8ebe9] border-b border-[#e8ebe9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        {label}
      </td>
      <td className="border-b border-[#e8ebe9] px-4 py-2 text-[11px] text-zinc-900 align-top">
        <span className="font-medium">{value}</span>
        {muted && (
          <span className="text-[10px] text-zinc-500 ml-1">{muted}</span>
        )}
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
      <td className="w-[150px] bg-[#fafafa] text-zinc-500 border-r border-[#e8ebe9] border-b border-[#e8ebe9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        {label}
      </td>
      <td className="border-b border-[#e8ebe9] px-4 py-2 text-[11px] text-zinc-900 align-top">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00897b] flex-shrink-0"></div>
          <div className="font-bold font-mono min-w-[50px]">{g} g</div>
          <div className="text-[10px] text-zinc-500">
            / {kcal.toLocaleString()} kcal{totalKcal && ` / ${pct} %`}
          </div>
        </div>
      </td>
    </tr>
  );
}

function AuditRow({ audit }: { audit: AuditComment }) {
  return (
    <tr>
      <td className="w-[150px] bg-[#fafafa] text-zinc-500 border-r border-[#e8ebe9] border-b border-[#e8ebe9] px-4 py-2 text-[10px] font-medium tracking-wide align-top">
        添削
      </td>
      <td className="bg-[rgba(255,235,59,0.12)] border-b border-[#e8ebe9] px-4 py-2 align-top">
        <div className="text-[10px] text-[#b8860b] font-medium mb-1">
          {audit.who}
        </div>
        <div className="text-[11px] text-zinc-700 leading-relaxed">
          {audit.text}
        </div>
      </td>
    </tr>
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
