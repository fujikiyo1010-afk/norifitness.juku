"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveDraft, submitAudit } from "@/lib/monthly-audit/actions";
import { normalizeNumberInput } from "@/lib/utils/normalize-number";
import {
  AUDIT_QUESTIONS,
  AUDIT_CATEGORIES,
  countFilledItems,
  listMissingRequiredKeys,
  formatTargetMonthLabel,
  type MonthlyAuditItems,
  type AuditQuestion,
  type AuditCategoryKey,
  type BodyMeasureAnswer,
  type ScoreAnswer,
  type TextAnswer,
} from "@/lib/monthly-audit/types";

/**
 * 月次添削 記入フォーム (Client Component)
 *
 * 設計元: /tmp/monthly_review_form.html
 *
 * 設計方針:
 *   - useState で items (jsonb) 全体を管理
 *   - 17 項目を 6 カテゴリで区切って表示
 *   - 「下書き保存」 → saveDraft
 *   - 「プレビューを確認する」 → 同画面でプレビューモードに切替
 *   - プレビューで「修正する」 / 「送信する」を選択
 *   - 提出: 必須 16 項目チェック → submitAudit → 送信完了画面へ遷移
 */
export function MonthlyReviewForm({
  targetMonth,
  initialItems,
  initialLastSavedAt,
}: {
  targetMonth: string;
  initialItems: MonthlyAuditItems;
  initialLastSavedAt: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MonthlyAuditItems>(initialItems);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialLastSavedAt
  );
  const [mode, setMode] = useState<"form" | "preview">("form");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  const filledCount = useMemo(() => countFilledItems(items), [items]);
  const totalCount = AUDIT_QUESTIONS.length;
  const monthLabel = formatTargetMonthLabel(targetMonth);

  // ===== 各項目の更新関数 =====
  const updateAnswer = (
    key: string,
    patch: Partial<BodyMeasureAnswer | ScoreAnswer | TextAnswer>
  ) => {
    setItems((prev) => {
      const k = key as keyof MonthlyAuditItems;
      const existing = (prev[k] ?? {}) as Record<string, unknown>;
      return {
        ...prev,
        [k]: { ...existing, ...patch },
      } as MonthlyAuditItems;
    });
  };

  // ===== 保存処理 =====
  const handleSaveDraft = () => {
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      const result = await saveDraft(targetMonth, items);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLastSavedAt(result.updated_at);
      setSavedMessage("下書きを保存しました");
    });
  };

  const handlePreview = () => {
    setError(null);
    setMissingKeys([]);
    const missing = listMissingRequiredKeys(items);
    if (missing.length > 0) {
      setMissingKeys(missing);
      setError(`未記入の必須項目が ${missing.length} 個あります`);
      return;
    }
    setMode("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitAudit(targetMonth, items);
      if (!result.ok) {
        setError(result.message);
        if (result.missing_keys) setMissingKeys(result.missing_keys);
        setMode("form"); // フォームに戻して赤マーク表示
        return;
      }
      // 送信完了 → 送信完了画面へ
      router.push("/monthly-review/complete");
      router.refresh();
    });
  };

  // ===== カテゴリ別に項目をグループ化 =====
  const questionsByCategory = useMemo(() => {
    const map = new Map<AuditCategoryKey, AuditQuestion[]>();
    for (const q of AUDIT_QUESTIONS) {
      const arr = map.get(q.category) ?? [];
      arr.push(q);
      map.set(q.category, arr);
    }
    return map;
  }, []);

  return (
    <div className="bg-white border border-[#e8ebe9] rounded-2xl overflow-hidden">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-[#e8ebe9] flex items-center gap-2">
        <Link href="/monthly-review" className="text-zinc-900">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex-1 text-center text-sm font-bold text-zinc-900">
          月次添削
        </div>
        <div className="w-5 h-5" />
      </div>

      {mode === "form" ? (
        <>
          {/* ヘッダー統合ブロック (温かいグラデ) */}
          <div className="px-4 py-4 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-b border-[#e8ebe9] text-center">
            <div className="text-xs font-bold text-[#00695c] mb-2.5 tracking-wide flex items-center justify-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 5L2 7" />
              </svg>
              のりfitness の月次添削
            </div>
            <div className="text-2xl font-bold text-zinc-900 mb-2 tracking-wide leading-tight">
              {monthLabel}
            </div>
            <div className="text-xs text-zinc-700 mb-3">
              受付中 ・ 毎月 1 日が、振り返りの日です。
            </div>
            <div className="text-[11px] text-zinc-500 leading-relaxed pt-2.5 border-t border-[#e8ebe9]">
              0〜10 点で各自評価をお願いします。
              <br />
              <b className="text-[#00695c] font-bold">0</b> = 全然できなかった ・{" "}
              <b className="text-[#00695c] font-bold">10</b> = よくできた
              <br />
              毎月振り返ることで、自己モニタリングできます。
            </div>
          </div>

          {/* 進捗バー */}
          <div className="px-4 py-3 bg-[#f8f9fa] border-b border-[#e8ebe9]">
            <div className="flex justify-between text-[11px] text-zinc-500 mb-1.5">
              <span>記入状況</span>
              <span className="font-bold text-zinc-900 font-mono">
                {filledCount} / {totalCount} 項目
              </span>
            </div>
            <div className="h-1.5 bg-white border border-[#e8ebe9] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00897b] transition-all"
                style={{ width: `${(filledCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          {/* 最終保存通知 */}
          {lastSavedAt && (
            <div className="px-4 py-2.5 bg-[#f8f9fa] text-[10px] text-zinc-500 text-center border-b border-[#e8ebe9]">
              自動下書き保存しました ・{" "}
              {new Date(lastSavedAt).toLocaleString("ja-JP", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}

          {/* カテゴリ別 17 項目 */}
          <div className="bg-white">
            {(Object.keys(AUDIT_CATEGORIES) as AuditCategoryKey[])
              .sort((a, b) => AUDIT_CATEGORIES[a].order - AUDIT_CATEGORIES[b].order)
              .map((catKey) => {
                const cat = AUDIT_CATEGORIES[catKey];
                const questions = questionsByCategory.get(catKey) ?? [];
                return (
                  <div key={catKey}>
                    <CategoryBand label={cat.label} count={cat.count} />
                    {questions.map((q) => (
                      <ItemCard
                        key={q.key}
                        question={q}
                        answer={items[q.key as keyof MonthlyAuditItems]}
                        onChange={(patch) => updateAnswer(q.key, patch)}
                        missing={missingKeys.includes(q.key)}
                      />
                    ))}
                  </div>
                );
              })}
          </div>

          {/* エラー / 成功メッセージ */}
          {error && (
            <div className="mx-4 my-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
              ⚠ {error}
            </div>
          )}
          {savedMessage && (
            <div className="mx-4 my-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-xs text-green-800">
              ✓ {savedMessage}
            </div>
          )}

          {/* 保存バー (フォームモード) */}
          <div className="bg-white border-t border-[#e8ebe9] px-4 py-3 flex gap-2 sticky bottom-0">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveDraft}
              className="px-4 py-3 bg-white text-zinc-900 border border-[#e8ebe9] rounded-2xl text-[12px] font-bold disabled:opacity-50"
            >
              下書き保存
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handlePreview}
              className="flex-1 px-4 py-3 bg-[#00897b] hover:bg-[#00695c] text-white rounded-2xl text-sm font-bold disabled:opacity-50 transition-colors"
            >
              プレビューを確認する
            </button>
          </div>
        </>
      ) : (
        // === プレビューモード ===
        <PreviewView
          monthLabel={monthLabel}
          items={items}
          onEdit={() => setMode("form")}
          onSubmit={handleSubmit}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// =====================================================================
// プレビュー画面 (送信前の確認、編集不可)
// =====================================================================
function PreviewView({
  monthLabel,
  items,
  onEdit,
  onSubmit,
  isPending,
}: {
  monthLabel: string;
  items: MonthlyAuditItems;
  onEdit: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <div className="px-4 py-4 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-b border-[#e8ebe9] text-center">
        <div className="text-xs font-bold text-[#00695c] mb-2 tracking-wide">
          プレビュー (送信前の確認)
        </div>
        <div className="text-xl font-bold text-zinc-900 mb-1 tracking-wide">
          {monthLabel}
        </div>
        <div className="text-[11px] text-zinc-600 leading-relaxed mt-2">
          入力内容を確認してから送信してください。<br />
          送信後は編集できません。
        </div>
      </div>

      <div className="bg-white">
        {(Object.keys(AUDIT_CATEGORIES) as AuditCategoryKey[])
          .sort((a, b) => AUDIT_CATEGORIES[a].order - AUDIT_CATEGORIES[b].order)
          .map((catKey) => {
            const cat = AUDIT_CATEGORIES[catKey];
            const questions = AUDIT_QUESTIONS.filter((q) => q.category === catKey);
            return (
              <div key={catKey}>
                <CategoryBand label={cat.label} count={cat.count} />
                {questions.map((q) => (
                  <PreviewItem
                    key={q.key}
                    question={q}
                    answer={items[q.key as keyof MonthlyAuditItems]}
                  />
                ))}
              </div>
            );
          })}
      </div>

      {/* 修正 / 送信ボタン */}
      <div className="bg-white border-t border-[#e8ebe9] px-4 py-3 flex gap-2 sticky bottom-0">
        <button
          type="button"
          disabled={isPending}
          onClick={onEdit}
          className="px-4 py-3 bg-white text-zinc-900 border border-[#e8ebe9] rounded-2xl text-[12px] font-bold disabled:opacity-50"
        >
          修正する
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onSubmit}
          className="flex-1 px-4 py-3 bg-[#00897b] hover:bg-[#00695c] text-white rounded-2xl text-sm font-bold disabled:opacity-50 transition-colors"
        >
          {isPending ? "送信中..." : "送信する"}
        </button>
      </div>
    </>
  );
}

// =====================================================================
// 子コンポーネント
// =====================================================================

function CategoryBand({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-zinc-900 text-white px-4 py-2.5 text-[11px] font-semibold tracking-widest flex items-center gap-2">
      <span>{label}</span>
      <span className="ml-auto text-[#00897b] font-mono">{count}</span>
    </div>
  );
}

function ItemCard({
  question,
  answer,
  onChange,
  missing,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
  onChange: (patch: Partial<BodyMeasureAnswer | ScoreAnswer | TextAnswer>) => void;
  missing: boolean;
}) {
  const num = question.key.replace("q", "");
  return (
    <div
      className={`p-4 border-b border-[#e8ebe9] ${
        missing ? "bg-red-50" : ""
      }`}
    >
      <div className="text-[11px] text-zinc-500 font-bold font-mono mb-1">
        Q{num} / 17
      </div>
      <div className="text-[13px] font-bold text-zinc-900 leading-snug mb-2.5 flex justify-between items-start gap-2">
        <span>{question.label}</span>
        {question.required ? (
          <span className="text-red-500 text-[11px] flex-shrink-0">★</span>
        ) : (
          <span className="text-zinc-300 text-[10px] font-medium flex-shrink-0">
            (任意)
          </span>
        )}
      </div>
      {question.type === "body_measure" && (
        <BodyMeasureInput
          unit={question.unit ?? ""}
          step={question.numberStep ?? 0.1}
          min={question.numberMin}
          max={question.numberMax}
          decimals={question.numberDecimals ?? 1}
          placeholder={question.numberPlaceholder ?? ""}
          answer={(answer ?? {}) as BodyMeasureAnswer}
          onChange={onChange}
        />
      )}
      {question.type === "score" && (
        <ScoreInput
          answer={(answer ?? {}) as ScoreAnswer}
          onChange={onChange}
        />
      )}
      {question.type === "text" && (
        <TextOnlyInput
          answer={(answer ?? {}) as TextAnswer}
          placeholder={question.textPlaceholder ?? "自由にお書きください"}
          onChange={onChange}
          large
        />
      )}
      {question.type !== "text" && (
        <textarea
          value={(answer as { text?: string })?.text ?? ""}
          placeholder={question.textPlaceholder ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          className="w-full mt-2.5 px-3 py-2.5 text-xs border border-[#e8ebe9] rounded-lg bg-white text-zinc-900 resize-none focus:outline-none focus:border-[#00897b]"
        />
      )}
    </div>
  );
}

function BodyMeasureInput({
  unit,
  step,
  min,
  max,
  decimals,
  placeholder,
  answer,
  onChange,
}: {
  unit: string;
  step: number;
  min?: number;
  max?: number;
  decimals: number;
  placeholder: string;
  answer: BodyMeasureAnswer;
  onChange: (patch: Partial<BodyMeasureAnswer>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <BodyMeasureColumn
        label="先月"
        value={answer.last_value}
        onChange={(v) => onChange({ last_value: v })}
        unit={unit}
        step={step}
        min={min}
        max={max}
        decimals={decimals}
        placeholder={placeholder}
      />
      <BodyMeasureColumn
        label="今月"
        value={answer.current_value}
        onChange={(v) => onChange({ current_value: v })}
        unit={unit}
        step={step}
        min={min}
        max={max}
        decimals={decimals}
        placeholder={placeholder}
      />
    </div>
  );
}

function BodyMeasureColumn({
  label,
  value,
  onChange,
  unit,
  step,
  min,
  max,
  decimals,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  decimals: number;
  placeholder: string;
}) {
  // 表示用の文字列 state (フォーカス外で整形値 75 → 75.0)
  const [display, setDisplay] = useState(
    value !== undefined ? value.toFixed(decimals) : ""
  );
  // フォーカス中フラグ (入力中は外部 value 変化を反映しない)
  const [isFocused, setIsFocused] = useState(false);

  // 外部から value が変わった時、フォーカス外でだけ display 同期
  useEffect(() => {
    if (isFocused) return;
    setDisplay(value !== undefined ? value.toFixed(decimals) : "");
  }, [value, decimals, isFocused]);

  // step / min / max は将来的なバリデーション用に保持 (現在 text input なので step 機能は使えない)
  void step;

  return (
    <div>
      <div className="text-[10px] text-zinc-500 text-center mb-1 font-semibold">
        {label}
      </div>
      <div className="flex gap-1 items-center">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9.]*"
          value={display}
          placeholder={placeholder}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            // 全角→半角に自動正規化 + 不正文字除去
            const normalized = normalizeNumberInput(e.target.value);
            setDisplay(normalized);
            onChange(normalized === "" ? undefined : parseFloat(normalized));
          }}
          onBlur={() => {
            setIsFocused(false);
            // フォーカス外れた瞬間に小数桁を整形 (75 → 75.0)
            const parsed = parseFloat(display);
            if (!isNaN(parsed)) {
              // 範囲チェック (min/max を強制)
              let clamped = parsed;
              if (min !== undefined && clamped < min) clamped = min;
              if (max !== undefined && clamped > max) clamped = max;
              setDisplay(clamped.toFixed(decimals));
              onChange(clamped);
            } else {
              setDisplay("");
              onChange(undefined);
            }
          }}
          className="flex-1 px-2 py-2 text-sm border border-[#e8ebe9] rounded-lg bg-white text-zinc-900 text-center font-bold font-mono focus:outline-none focus:border-[#00897b]"
        />
        <span className="text-[11px] text-zinc-500">{unit}</span>
      </div>
    </div>
  );
}

function ScoreInput({
  answer,
  onChange,
}: {
  answer: ScoreAnswer;
  onChange: (patch: Partial<ScoreAnswer>) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-11 gap-1 mb-1.5">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const active = answer.score === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ score: n })}
              className={`aspect-square min-w-0 rounded-md text-[11px] font-bold font-mono transition-colors flex items-center justify-center ${
                active
                  ? "bg-[#00897b] text-white border border-[#00897b]"
                  : "bg-white text-zinc-600 border border-[#e8ebe9] hover:border-[#00897b]"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-500 px-1">
        <span>0 全然できなかった</span>
        <span>10 よくできた</span>
      </div>
    </div>
  );
}

function TextOnlyInput({
  answer,
  placeholder,
  onChange,
  large,
}: {
  answer: TextAnswer;
  placeholder: string;
  onChange: (patch: Partial<TextAnswer>) => void;
  large?: boolean;
}) {
  return (
    <textarea
      value={answer.text ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={large ? 4 : 2}
      className={`w-full px-3 py-2.5 text-xs border border-[#e8ebe9] rounded-lg bg-white text-zinc-900 resize-none focus:outline-none focus:border-[#00897b] ${
        large ? "min-h-[80px]" : ""
      }`}
    />
  );
}

// =====================================================================
// プレビュー用の項目表示 (編集不可)
// =====================================================================
function PreviewItem({
  question,
  answer,
}: {
  question: AuditQuestion;
  answer: BodyMeasureAnswer | ScoreAnswer | TextAnswer | undefined;
}) {
  const num = question.key.replace("q", "");
  return (
    <div className="p-4 border-b border-[#e8ebe9]">
      <div className="text-[11px] text-zinc-500 font-bold font-mono mb-1">
        Q{num} / 17
      </div>
      <div className="text-[13px] font-bold text-zinc-900 leading-snug mb-2.5">
        {question.label}
      </div>

      {question.type === "body_measure" && (
        <div className="grid grid-cols-2 gap-2.5 mb-2">
          <div className="bg-[#f8f9fa] border border-[#e8ebe9] rounded-lg p-2 text-center">
            <div className="text-[10px] text-zinc-500 mb-0.5">先月</div>
            <div className="text-sm font-bold text-zinc-900 font-mono">
              {(answer as BodyMeasureAnswer | undefined)?.last_value ?? "—"}
              <span className="text-[10px] text-zinc-500 ml-1 font-normal">
                {question.unit}
              </span>
            </div>
          </div>
          <div className="bg-[rgba(0,137,123,0.08)] border border-[#00897b] rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#00695c] mb-0.5 font-semibold">
              今月
            </div>
            <div className="text-sm font-bold text-[#00695c] font-mono">
              {(answer as BodyMeasureAnswer | undefined)?.current_value ?? "—"}
              <span className="text-[10px] text-[#00695c] ml-1 font-normal">
                {question.unit}
              </span>
            </div>
          </div>
        </div>
      )}

      {question.type === "score" && (
        <div className="flex items-center gap-3 mb-2">
          <div className="text-3xl font-bold text-[#00695c] font-mono">
            {(answer as ScoreAnswer | undefined)?.score ?? "—"}
          </div>
          <div className="text-[10px] text-zinc-500">/ 10 点</div>
        </div>
      )}

      <div className="text-[12px] text-zinc-700 leading-relaxed whitespace-pre-wrap min-h-[1.2em] bg-[#f8f9fa] rounded-md px-2.5 py-2">
        {(answer as { text?: string } | undefined)?.text ?? (
          <span className="text-zinc-400">(自由記述 なし)</span>
        )}
      </div>
    </div>
  );
}
