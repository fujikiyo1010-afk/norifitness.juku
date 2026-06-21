"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveGoalSheetAuditByAdmin } from "@/lib/goal-sheet/actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  SECTION_META,
  type GoalSheetRow,
  type GoalSheetAudits,
  type AuditComment,
  type SectionKey,
} from "@/lib/goal-sheet/types";
import { ReferencePanel, type ReferenceData } from "./ReferencePanel";

/**
 * 目標シート 添削エディタ (Client Component)
 *
 * 構成:
 *   - 左カラム: 受講生の入力内容 (読み取り専用、5 セクション)
 *   - 各フィールド横にコメント入力欄 (B 案 項目単位添削)
 *   - 各セクションの末尾にセクション総評欄
 *   - 最下部に全体総評欄
 *   - 保存 → saveGoalSheetAuditByAdmin
 */
type FieldHistoryEntry = { date: string; text: string; who: string };
type FieldHistoryMap = Record<string, FieldHistoryEntry[]>;

export function GoalSheetAuditEditor({
  userId,
  displayName,
  sheet,
  hubHref,
  referenceData,
  fieldHistory,
}: {
  userId: string;
  displayName: string;
  sheet: GoalSheetRow;
  hubHref: string;
  referenceData: ReferenceData;
  fieldHistory: FieldHistoryMap;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [audits, setAudits] = useState<GoalSheetAudits>(
    sheet.content.audits ?? {}
  );
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const noriName = "のりfitness";

  // フィールド単位コメント更新
  function updateFieldComment(fieldKey: string, text: string) {
    setAudits((prev) => {
      const next = { ...prev };
      const fc = { ...(prev.field_comments ?? {}) };
      if (text.trim()) {
        fc[fieldKey] = { text: text.trim(), who: noriName, date: today };
      } else {
        delete fc[fieldKey];
      }
      next.field_comments = fc;
      return next;
    });
  }

  // セクション総評更新
  function updateSectionComment(sectionKey: SectionKey, text: string) {
    setAudits((prev) => {
      const next = { ...prev };
      const sc = { ...(prev.section_comments ?? {}) };
      if (text.trim()) {
        sc[sectionKey] = { text: text.trim(), who: noriName, date: today };
      } else {
        delete sc[sectionKey];
      }
      next.section_comments = sc;
      return next;
    });
  }

  // 全体総評更新
  function updateSummary(text: string) {
    setAudits((prev) => ({
      ...prev,
      summary: text.trim()
        ? { text: text.trim(), who: noriName, date: today }
        : undefined,
    }));
  }

  // 保存 (成功時はハブに自動遷移)
  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveGoalSheetAuditByAdmin(userId, audits);
      if (result.ok) {
        setMessage({ type: "ok", text: "添削を保存しました。ハブ画面に戻ります..." });
        // 1.2 秒後にハブに自動遷移 (成功メッセージを見せてから)
        setTimeout(() => {
          router.push(hubHref);
        }, 1200);
      } else {
        setMessage({ type: "error", text: result.message });
      }
    });
  }

  const c = sheet.content;

  // ===== hint (目標値の下に出す現状値・残り日数・推奨値) を計算 =====
  const sw = c.current_status?.weight_kg;
  const tw = c.goal_selection?.target_weight_kg;
  const targetWeightHint =
    typeof sw === "number" && typeof tw === "number"
      ? `現状 ${sw.toFixed(1)} kg (${tw === sw ? "±0" : tw < sw ? "" : "+"}${(tw - sw).toFixed(1)} kg)`
      : null;

  const mk = c.current_status?.maintenance_kcal;
  const tc = c.nutrition?.target_calorie;
  const targetCalorieHint =
    typeof mk === "number" && typeof tc === "number"
      ? `メンテ ${mk} kcal (${tc === mk ? "±0" : tc > mk ? "+" : ""}${tc - mk} kcal)`
      : null;

  const td = c.goal_selection?.target_date;
  let targetDateHint: string | null = null;
  if (td) {
    const days = Math.floor(
      (new Date(td).getTime() - Date.now()) / 86_400_000
    );
    targetDateHint = days < 0 ? `期限超過 ${-days} 日` : `残り ${days} 日`;
  }

  // PFC 推奨値 (体重ベース、減量・維持の一般ライン)
  const wForPfc = typeof sw === "number" ? sw : null;
  const pHint =
    wForPfc !== null
      ? `推奨 ${Math.round(wForPfc * 1.9)} g (体重 × 1.9)`
      : null;
  const fHint =
    wForPfc !== null
      ? `推奨 ${Math.round(wForPfc * 0.8)} g (体重 × 0.8)`
      : null;
  const cKcalLeft =
    typeof tc === "number" &&
    typeof c.nutrition?.pfc?.p === "number" &&
    typeof c.nutrition?.pfc?.f === "number"
      ? tc - (c.nutrition.pfc.p * 4 + c.nutrition.pfc.f * 9)
      : null;
  const cHint =
    cKcalLeft !== null
      ? `残り ${cKcalLeft} kcal ÷ 4 = ${Math.round(cKcalLeft / 4)} g`
      : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-[1400px] px-6 py-8 pb-32 grid grid-cols-[1fr_320px] gap-6">
        {/* 左カラム: 添削エディタ */}
        <div>
        {/* ヘッダー */}
        <header className="mb-6 flex items-center gap-3">
          <Link
            href={hubHref}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100"
            aria-label="受講生ハブに戻る"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-zinc-900">
              {displayName} さんの目標シート添削
            </h1>
            <p className="text-xs text-zinc-600 mt-0.5">
              受講生の入力を読みながら、項目単位でコメントを残せます
            </p>
          </div>
          {sheet.reviewed_at && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800">
              添削済み
            </span>
          )}
        </header>

        {message && (
          <div
            className={`mb-5 rounded-[14px] border p-3 text-sm ${
              message.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 全体総評 (最上部にも配置: のり氏が最初に書きたい時用) */}
        <SummarySection
          summary={audits.summary}
          onChange={updateSummary}
          placeholder="シート全体の総評・励まし・大きな方向性"
        />

        {/* 5 セクション */}
        <div className="mt-5 space-y-5">
          {/* セクション 1: 現状を把握 */}
          <SectionWrap section="current_status" audits={audits} onSectionCommentChange={updateSectionComment}>
            <Field label="体重 (kg)" value={c.current_status?.weight_kg} fieldKey="weight_kg" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.weight_kg} />
            <Field label="身長 (cm)" value={c.current_status?.height_cm} fieldKey="height_cm" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.height_cm} />
            <Field label="ウエスト (cm)" value={c.current_status?.waist_cm} fieldKey="waist_cm" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.waist_cm} />
            <Field label="首回り (cm)" value={c.current_status?.neck_cm} fieldKey="neck_cm" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.neck_cm} />
            <Field label="体脂肪率 (%)" value={c.current_status?.body_fat_pct} fieldKey="body_fat_pct" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.body_fat_pct} />
            <Field label="メンテナンスカロリー (kcal)" value={c.current_status?.maintenance_kcal} fieldKey="maintenance_kcal" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.maintenance_kcal} />
          </SectionWrap>

          {/* セクション 2: 目標の選定 */}
          <SectionWrap section="goal_selection" audits={audits} onSectionCommentChange={updateSectionComment}>
            <Field label="目標体重 (kg)" value={c.goal_selection?.target_weight_kg} hint={targetWeightHint} fieldKey="target_weight_kg" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.target_weight_kg} />
            <Field label="到達予定日" value={c.goal_selection?.target_date} hint={targetDateHint} fieldKey="target_date" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.target_date} />
            <Field label="短期目標" value={c.goal_selection?.short_term} fieldKey="short_term" audits={audits} onCommentChange={updateFieldComment} multiline historyEntries={fieldHistory.short_term} />
            <Field label="長期目標" value={c.goal_selection?.long_term} fieldKey="long_term" audits={audits} onCommentChange={updateFieldComment} multiline historyEntries={fieldHistory.long_term} />
            <Field label="プロセス" value={c.goal_selection?.process} fieldKey="process" audits={audits} onCommentChange={updateFieldComment} multiline historyEntries={fieldHistory.process} />
          </SectionWrap>

          {/* セクション 3: 栄養設計 */}
          <SectionWrap section="nutrition" audits={audits} onSectionCommentChange={updateSectionComment}>
            <Field label="目標カロリー (kcal/日)" value={c.nutrition?.target_calorie} hint={targetCalorieHint} fieldKey="target_calorie" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.target_calorie} />
            <Field label="たんぱく質 (g)" value={c.nutrition?.pfc?.p} hint={pHint} fieldKey="pfc_p" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.pfc_p} />
            <Field label="脂質 (g)" value={c.nutrition?.pfc?.f} hint={fHint} fieldKey="pfc_f" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.pfc_f} />
            <Field label="糖質 (g)" value={c.nutrition?.pfc?.c} hint={cHint} fieldKey="pfc_c" audits={audits} onCommentChange={updateFieldComment} historyEntries={fieldHistory.pfc_c} />
            {c.nutrition?.carb_cycle?.weekly_pattern && (
              <Field
                label="カーボサイクル (月-日)"
                value={c.nutrition.carb_cycle.weekly_pattern.join(" / ")}
                fieldKey="carb_cycle"
                audits={audits}
                onCommentChange={updateFieldComment}
                historyEntries={fieldHistory.carb_cycle}
              />
            )}
          </SectionWrap>

          {/* セクション 4: プラスの感情を含むゴール */}
          <SectionWrap section="positive_goals" audits={audits} onSectionCommentChange={updateSectionComment}>
            <Field label="達成時の気持ち" value={c.positive_goals?.achievement_feeling} fieldKey="achievement_feeling" audits={audits} onCommentChange={updateFieldComment} multiline historyEntries={fieldHistory.achievement_feeling} />
          </SectionWrap>

          {/* セクション 5: セルフイメージ改善 */}
          <SectionWrap section="self_image" audits={audits} onSectionCommentChange={updateSectionComment}>
            {(c.self_image ?? []).map((item, i) => (
              <Field
                key={item.key}
                label={`${i + 1}. ${item.label} (現在 ${item.before ?? "—"} → 目標 ${item.after ?? "—"})`}
                value={`現在 ${item.before ?? "—"} / 目標 ${item.after ?? "—"}`}
                fieldKey={`self_image_${item.key}`}
                audits={audits}
                onCommentChange={updateFieldComment}
                historyEntries={fieldHistory[`self_image_${item.key}`]}
              />
            ))}
          </SectionWrap>
        </div>
        </div>
        {/* /左カラム終了 */}

        {/* 右カラム: 参考情報パネル (sticky で常時表示) */}
        <aside className="sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
          <ReferencePanel data={referenceData} userId={userId} />
        </aside>
      </div>

      {/* 固定保存バー */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#e8ebe9] bg-white px-6 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex-1 text-xs text-zinc-600">
            添削件数:{" "}
            <span className="font-bold text-zinc-900">
              {Object.keys(audits.field_comments ?? {}).length}
            </span>{" "}
            項目 ・{" "}
            <span className="font-bold text-zinc-900">
              {Object.keys(audits.section_comments ?? {}).length}
            </span>{" "}
            セクション総評 ・{" "}
            <span className="font-bold text-zinc-900">
              {audits.summary ? "あり" : "なし"}
            </span>{" "}
            全体総評
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-[4px] bg-[#00897b] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#00695c] disabled:opacity-50"
          >
            {isPending ? (
              <>
                <LoadingSpinner /> 保存中…
              </>
            ) : (
              "添削を保存"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// セクションラップ
// =====================================================================

function SectionWrap({
  section,
  audits,
  onSectionCommentChange,
  children,
}: {
  section: SectionKey;
  audits: GoalSheetAudits;
  onSectionCommentChange: (key: SectionKey, text: string) => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[section];
  const sc = audits.section_comments?.[section];
  return (
    <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-[#00897b]" />
        <h2 className="text-sm font-semibold text-zinc-900">
          {meta.num}. {meta.title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>

      {/* セクション総評 */}
      <div className="mt-5 pt-4 border-t border-[#e8ebe9]">
        <label className="block text-[10px] font-bold text-zinc-500 tracking-widest mb-1.5">
          セクション総評
        </label>
        <textarea
          value={sc?.text ?? ""}
          onChange={(e) => onSectionCommentChange(section, e.target.value)}
          placeholder={`「${meta.title}」セクション全体に対する総評・励まし`}
          rows={2}
          className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#00897b]"
        />
        {sc?.date && (
          <div className="mt-1 text-[9px] text-zinc-400 font-mono">
            {sc.who} ・ {sc.date}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// フィールド (受講生の値表示 + 赤字コメント入力)
// =====================================================================

function Field({
  label,
  value,
  hint,
  fieldKey,
  audits,
  onCommentChange,
  multiline,
  historyEntries,
}: {
  label: string;
  value: number | string | undefined | null;
  /** 値の下に灰色小フォントで併記 (現状値・差分・残り日数など) */
  hint?: string | null;
  fieldKey: string;
  audits: GoalSheetAudits;
  onCommentChange: (key: string, text: string) => void;
  multiline?: boolean;
  /** 過去添削履歴 (C-2 アコーディオン用、日付降順) */
  historyEntries?: Array<{ date: string; text: string; who: string }>;
}) {
  const comment = audits.field_comments?.[fieldKey];
  const displayValue =
    value === undefined || value === null || value === ""
      ? "—"
      : typeof value === "number"
        ? value.toString()
        : value;
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasHistory = !!historyEntries && historyEntries.length > 0;

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 items-start">
      {/* 左: 受講生の入力値 */}
      <div>
        <label className="block text-[11px] font-bold text-zinc-500 tracking-widest mb-1">
          {label}
        </label>
        <div
          className={`rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm text-zinc-900 ${
            multiline ? "whitespace-pre-wrap min-h-[60px]" : ""
          }`}
        >
          {displayValue}
        </div>
        {hint && (
          <div className="mt-1 text-[10px] text-zinc-500 font-mono">
            {hint}
          </div>
        )}
      </div>
      {/* 右: 赤字コメント入力 */}
      <div>
        <label className="block text-[10px] font-bold text-rose-600 tracking-widest mb-1 flex items-center gap-1">
          <span>のりfitness 添削</span>
        </label>
        <textarea
          value={comment?.text ?? ""}
          onChange={(e) => onCommentChange(fieldKey, e.target.value)}
          placeholder="この項目への添削コメント (赤字相当、空ならコメントなし)"
          rows={multiline ? 3 : 2}
          className="w-full rounded-md border border-rose-200 bg-rose-50/30 px-3 py-2 text-xs focus:outline-none focus:border-rose-500"
        />
        {comment?.date && (
          <div className="mt-1 text-[9px] text-zinc-400 font-mono">
            {comment.who} ・ {comment.date}
          </div>
        )}
        {/* C-2: 過去添削履歴アコーディオン */}
        {hasHistory && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="text-[10px] text-zinc-500 hover:text-zinc-800 font-bold"
            >
              {historyOpen ? "▼" : "▶"} 過去の添削 ({historyEntries!.length} 件)
            </button>
            {historyOpen && (
              <div className="mt-1.5 space-y-1.5 border-l-2 border-rose-100 pl-2">
                {historyEntries!.map((e, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="text-zinc-400 font-mono">
                      {e.date} ・ {e.who}
                    </div>
                    <div className="text-rose-700 leading-relaxed">
                      {e.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 全体総評
// =====================================================================

function SummarySection({
  summary,
  onChange,
  placeholder,
}: {
  summary: AuditComment | undefined;
  onChange: (text: string) => void;
  placeholder: string;
}) {
  return (
    <section className="rounded-[14px] border border-[#e8ebe9] bg-amber-50/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-amber-500" />
        <h2 className="text-sm font-semibold text-zinc-900">全体総評</h2>
        <span className="text-[10px] text-zinc-500">
          シート全体に対するのりfitnessコメント
        </span>
      </div>
      <textarea
        value={summary?.text ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#00897b]"
      />
      {summary?.date && (
        <div className="mt-1 text-[10px] text-zinc-500 font-mono">
          {summary.who} ・ {summary.date}
        </div>
      )}
    </section>
  );
}
