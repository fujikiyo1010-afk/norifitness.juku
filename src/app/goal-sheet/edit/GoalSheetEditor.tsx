"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveMyGoalSheet } from "@/lib/goal-sheet/actions";
import { readDraft, writeDraft, clearDraft } from "@/lib/goal-sheet/draft-storage";
import { normalizeNumberInput } from "@/lib/utils/normalize-number";
import { calculateBodyFat } from "@/lib/tools/calculations";
import type { Gender as ToolGender } from "@/lib/tools/types";
import {
  SECTION_META,
  SELF_IMAGE_ITEMS,
  countFilledSections,
  type GoalSheetContent,
  type CurrentStatus,
  type GoalSelection,
  type Nutrition,
  type PFC,
  type PositiveGoals,
  type SelfImageItem,
  type AuditComment,
  type SectionKey,
} from "@/lib/goal-sheet/types";

/**
 * 目標管理シート 編集フォーム (Client Component)
 *
 * 設計元: /tmp/goal_sheet_v3.html
 *
 * 設計方針:
 *   - useState で content 全体を管理 (シンプル、依存ライブラリなし)
 *   - 各セクションで patch 形式の更新関数を渡す
 *   - 添削コメント (audits) は読み取り専用 (受講生は編集不可)
 *   - ツール起動ボタンは Link のみ (機能は Day 10-12 で実装)
 *   - 保存処理は Server Action (saveMyGoalSheet)
 */
export function GoalSheetEditor({
  initialContent,
  gender,
}: {
  initialContent: GoalSheetContent;
  /** 体脂肪率自動計算用 (= カルテ未提出時は null = 計算スキップ) */
  gender: ToolGender | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState<GoalSheetContent>(initialContent);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // savedMessage のフェード制御 (B2-2 きよむさん指定の「ふわっと」)
  const [savedMessageVisible, setSavedMessageVisible] = useState(false);
  const toastTimersRef = useRef<{ fadeOut: number | null; unmount: number | null }>({
    fadeOut: null,
    unmount: null,
  });
  const showToast = (message: string) => {
    if (toastTimersRef.current.fadeOut !== null)
      window.clearTimeout(toastTimersRef.current.fadeOut);
    if (toastTimersRef.current.unmount !== null)
      window.clearTimeout(toastTimersRef.current.unmount);
    setSavedMessage(message);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSavedMessageVisible(true));
    });
    toastTimersRef.current.fadeOut = window.setTimeout(
      () => setSavedMessageVisible(false),
      3000
    );
    toastTimersRef.current.unmount = window.setTimeout(
      () => setSavedMessage(null),
      3300
    );
  };

  const filledCount = countFilledSections(content);
  const audits = content.audits;

  // ===== マウント時: ドラフト復元 + ツール反映の取り込み =====
  // - 編集中の draft (sessionStorage) があれば優先 (リロード/タブ往復で消えない)
  // - ツール画面から戻ってきた場合は reflect キーを上書き適用
  // - React StrictMode (dev) の useEffect 二重実行で reflect 反映が undefined に
  //   上書きされる事故を防ぐため、 useRef で 1 回だけ走らせる (B2 修正)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    let next: GoalSheetContent = initialContent;
    let reflectMessage: string | null = null;

    // 1. ドラフト復元
    const draft = readDraft();
    if (draft) next = draft;

    // 2. calorie: メンテナンスカロリー
    const calorieRaw = sessionStorage.getItem("goal-sheet-reflect-calorie");
    if (calorieRaw) {
      try {
        const v = JSON.parse(calorieRaw) as { maintenance_kcal?: number };
        if (typeof v.maintenance_kcal === "number") {
          next = {
            ...next,
            current_status: {
              ...(next.current_status ?? {}),
              maintenance_kcal: v.maintenance_kcal,
            },
          };
          reflectMessage = `メンテナンスカロリー ${v.maintenance_kcal} kcal を反映しました`;
        }
      } catch {}
      sessionStorage.removeItem("goal-sheet-reflect-calorie");
    }

    // 3. diet-period: 到達予定日
    const dietRaw = sessionStorage.getItem("goal-sheet-reflect-diet-period");
    if (dietRaw) {
      try {
        const v = JSON.parse(dietRaw) as { target_date?: string };
        if (typeof v.target_date === "string") {
          next = {
            ...next,
            goal_selection: {
              ...(next.goal_selection ?? {}),
              target_date: v.target_date,
            },
          };
          reflectMessage = `到達予定日 ${v.target_date} を反映しました`;
        }
      } catch {}
      sessionStorage.removeItem("goal-sheet-reflect-diet-period");
    }

    // 4. pfc-carb: PFC + カーボサイクル
    const pfcRaw = sessionStorage.getItem("goal-sheet-reflect-pfc-carb");
    if (pfcRaw) {
      try {
        const v = JSON.parse(pfcRaw) as {
          target_calorie?: number;
          pfc?: { p?: number; f?: number; c?: number };
          carb_cycle?: { weekly_pattern?: Array<"low" | "mid" | "high"> };
        };
        next = {
          ...next,
          nutrition: {
            ...(next.nutrition ?? {}),
            target_calorie: v.target_calorie ?? next.nutrition?.target_calorie,
            pfc: {
              ...(next.nutrition?.pfc ?? {}),
              ...(v.pfc ?? {}),
            },
            carb_cycle: v.carb_cycle ?? next.nutrition?.carb_cycle,
          },
        };
        reflectMessage = "PFC・カーボサイクルを反映しました";
      } catch {}
      sessionStorage.removeItem("goal-sheet-reflect-pfc-carb");
    }

    setContent(next);
    setHydrated(true);
    if (reflectMessage) {
      showToast(reflectMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== content 変化のたびに sessionStorage へミラー =====
  // hydration 前は書かない (initialContent の上書きを避けるため)
  useEffect(() => {
    if (!hydrated) return;
    writeDraft(content);
  }, [content, hydrated]);

  // ===== 自動保存 (debounce 1.5s ・ 2026-06-18 下書きボタン削除に伴う対応) =====
  // 「下書き保存」 ボタンを廃止して 1 ボタン化したため、 編集内容の永続化は
  // ここで自動で行う。 saveMyGoalSheet(content, { notify: false }) で
  // 静かに DB upsert (= last_review_requested_at は触らない、 admin に浮上しない)。
  //   - 連続編集中は最後のタイミングだけ走らせる (debounce)
  //   - hydration 前 / 送信中は何もしない
  //   - エラーは silent (= 下書きと同じ性質、 ユーザーには触らない)
  const autoSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (isPending) return; // 「送信して添削を依頼」 実行中はスキップ
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      // fire-and-forget (= UI は止めない)
      saveMyGoalSheet(content, { notify: false }).catch((e) => {
        console.warn("[goal-sheet] auto-save failed", e);
      });
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, hydrated, isPending]);

  // ===== 体脂肪率 自動計算 (B1: アメリカ海軍式) =====
  // 必要 4 項目 (体重 / 身長 / ウエスト / 首回り) + gender が全部揃った時、
  // calculateBodyFat を呼んで current_status.body_fat_pct に書き込む。
  // - gender が null (= カルテ未提出) なら計算スキップ
  // - 既存値と一致するなら setContent しない (= 無限ループ防止)
  // - 計算エラー時は silent skip (= 入力途中の異常値は無視)
  // - gender = "other" は formula = "male" (男性式) をデフォルトで使う
  //   (= 別 UI で選ばせるとスコープ膨らむため、 受講生は自己申告で値直す前提)
  // - readOnly は維持 = 自動計算のみ反映、 手入力は元から不可
  useEffect(() => {
    if (!hydrated) return;
    if (!gender) return;
    const cs = content.current_status;
    if (!cs) return;
    const weight_kg = cs.weight_kg;
    const height_cm = cs.height_cm;
    const waist_cm = cs.waist_cm;
    const neck_cm = cs.neck_cm;
    if (
      typeof height_cm !== "number" ||
      typeof waist_cm !== "number" ||
      typeof neck_cm !== "number"
    ) {
      return;
    }
    try {
      const { body_fat_pct } = calculateBodyFat({
        gender,
        formula: gender === "other" ? "male" : undefined,
        height_cm,
        waist_cm,
        neck_cm,
        weight_kg,
      });
      if (cs.body_fat_pct === body_fat_pct) return;
      setContent((prev) => ({
        ...prev,
        current_status: { ...(prev.current_status ?? {}), body_fat_pct },
      }));
    } catch {
      // 入力値が範囲外等 → silent skip
    }
  }, [
    hydrated,
    gender,
    content.current_status?.weight_kg,
    content.current_status?.height_cm,
    content.current_status?.waist_cm,
    content.current_status?.neck_cm,
    content.current_status?.body_fat_pct,
    content.current_status,
  ]);

  // ===== 各セクションの更新関数 =====
  const updateCurrentStatus = (patch: Partial<CurrentStatus>) => {
    setContent({
      ...content,
      current_status: { ...(content.current_status ?? {}), ...patch },
    });
  };
  const updateGoalSelection = (patch: Partial<GoalSelection>) => {
    setContent({
      ...content,
      goal_selection: { ...(content.goal_selection ?? {}), ...patch },
    });
  };
  const updateNutrition = (patch: Partial<Nutrition>) => {
    setContent({
      ...content,
      nutrition: { ...(content.nutrition ?? {}), ...patch },
    });
  };
  const updatePFC = (patch: Partial<PFC>) => {
    setContent({
      ...content,
      nutrition: {
        ...(content.nutrition ?? {}),
        pfc: { ...(content.nutrition?.pfc ?? {}), ...patch },
      },
    });
  };
  const updatePositiveGoals = (patch: Partial<PositiveGoals>) => {
    setContent({
      ...content,
      positive_goals: { ...(content.positive_goals ?? {}), ...patch },
    });
  };
  const updateSelfImage = (key: string, patch: Partial<SelfImageItem>) => {
    const existing = content.self_image ?? [];
    const idx = existing.findIndex((i) => i.key === key);
    const meta = SELF_IMAGE_ITEMS.find((m) => m.key === key);
    if (!meta) return;
    const item: SelfImageItem = {
      key,
      label: meta.label,
      ...(idx >= 0 ? existing[idx] : {}),
      ...patch,
    };
    const next = idx >= 0 ? existing.map((i, j) => (j === idx ? item : i)) : [...existing, item];
    setContent({ ...content, self_image: next });
  };

  // ===== 保存処理 =====
  // 「送信して添削を依頼」 のみ (= notify=true で last_review_requested_at セット)
  //   - 下書き保存ボタンは 2026-06-18 廃止 (= 編集内容は自動保存で常時 DB に同期)
  //   - 本送信後は ドラフト破棄 → 閲覧モードへ遷移
  const handleSubmit = () => {
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      const result = await saveMyGoalSheet(content, { notify: true });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      clearDraft();
      try {
        sessionStorage.setItem("goal-sheet-just-saved", "1");
      } catch {}
      router.push("/goal-sheet");
      router.refresh();
    });
  };

  // 「送信して添削を依頼」 ボタン文言 (2026-06-17 きよむさん判断で「再」 撤回 ・ B 案)
  // 動的「再」 化は混乱を招く + 受講生 UI 上の必要性低い → 常時統一文言
  const reviewButtonLabel = "送信して添削を依頼";

  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
      {/* 進捗バー */}
      <div className="px-4 py-3 border-b border-[#e7dcc9]">
        <div className="flex justify-between text-[11px] text-[#6a6256] mb-1.5">
          <span>記入状況</span>
          <span className="font-bold text-[#2b2620] font-mono">
            {filledCount} / 5 セクション
          </span>
        </div>
        <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4a875b] rounded-full transition-all"
            style={{ width: `${(filledCount / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* 本体 */}
      <div className="p-4 space-y-3">
        {/* ① 現状を把握 */}
        <SectionWrapper sectionKey="current_status" filled={!!content.filled_sections?.includes("current_status")}>
          <Field label="体重" required>
            <NumberInput
              value={content.current_status?.weight_kg}
              onChange={(v) => updateCurrentStatus({ weight_kg: v })}
              unit="kg"
              step={0.1}
              min={20}
              max={300}
              placeholder="例: 75.0"
              decimals={1}
            />
          </Field>
          <Field label="身長" required>
            <NumberInput
              value={content.current_status?.height_cm}
              onChange={(v) => updateCurrentStatus({ height_cm: v })}
              unit="cm"
              step={1}
              min={100}
              max={250}
              placeholder="例: 170"
              decimals={0}
            />
          </Field>
          <Field label="ウエスト" required>
            <NumberInput
              value={content.current_status?.waist_cm}
              onChange={(v) => updateCurrentStatus({ waist_cm: v })}
              unit="cm"
              step={0.5}
              min={40}
              max={200}
              placeholder="例: 82.0"
              decimals={1}
            />
          </Field>
          <Field label="首回り" required>
            <NumberInput
              value={content.current_status?.neck_cm}
              onChange={(v) => updateCurrentStatus({ neck_cm: v })}
              unit="cm"
              step={0.5}
              min={20}
              max={80}
              placeholder="例: 38.5"
              decimals={1}
            />
          </Field>
          <Field
            label="体脂肪率"
            autoTag="自動計算"
            audit={audits?.field_comments?.body_fat_pct}
          >
            <NumberInput
              value={content.current_status?.body_fat_pct}
              onChange={(v) => updateCurrentStatus({ body_fat_pct: v })}
              unit="%"
              readOnly
              decimals={1}
            />
          </Field>
          <Field label="メンテ kcal" autoTag="ツール反映">
            <NumberInput
              value={content.current_status?.maintenance_kcal}
              onChange={(v) => updateCurrentStatus({ maintenance_kcal: v })}
              unit="kcal"
              readOnly
              decimals={0}
            />
          </Field>

          <ToolButton href="/tools/calorie?return=goal-sheet" label="必要カロリー計算ツール" applied={!!content.current_status?.maintenance_kcal} />

          {audits?.section_comments?.current_status && (
            <SectionAudit audit={audits.section_comments.current_status} />
          )}
        </SectionWrapper>

        {/* ② 目標の選定 */}
        <SectionWrapper sectionKey="goal_selection" filled={!!content.filled_sections?.includes("goal_selection")}>
          <Field
            label="目標体重"
            required
            audit={audits?.field_comments?.target_weight_kg}
          >
            <NumberInput
              value={content.goal_selection?.target_weight_kg}
              onChange={(v) => updateGoalSelection({ target_weight_kg: v })}
              unit="kg"
              step={0.1}
              min={20}
              max={300}
              placeholder="例: 68.0"
              decimals={1}
            />
          </Field>
          <Field label="到達予定日" autoTag="自動">
            <TextInput
              value={
                content.goal_selection?.target_date
                  ? new Date(content.goal_selection.target_date).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }) + " ごろ"
                  : ""
              }
              onChange={() => {}}
              readOnly
            />
          </Field>
          <Field label="短期目標" required>
            <TextInput
              value={content.goal_selection?.short_term ?? ""}
              onChange={(v) => updateGoalSelection({ short_term: v })}
              placeholder="例: 3 ヶ月で体重を 5kg 落とす"
            />
          </Field>
          <Field label="長期目標" required>
            <TextInput
              value={content.goal_selection?.long_term ?? ""}
              onChange={(v) => updateGoalSelection({ long_term: v })}
              placeholder="例: 1 年後に体脂肪率 15% 以下"
            />
          </Field>
          <Field label="プロセス (行動の目標)" required>
            <TextInput
              value={content.goal_selection?.process ?? ""}
              onChange={(v) => updateGoalSelection({ process: v })}
              placeholder="例: 毎日食事を記録、週 3 回筋トレ"
            />
          </Field>

          <ToolButton href="/tools/diet-period?return=goal-sheet" label="減量期間逆算ツール" applied={!!content.goal_selection?.target_date} />

          {audits?.section_comments?.goal_selection && (
            <SectionAudit audit={audits.section_comments.goal_selection} />
          )}
        </SectionWrapper>

        {/* ③ 栄養設計 (入力フィールドなし、ツール反映のみ、視覚的表現中心) */}
        <SectionWrapper sectionKey="nutrition" filled={!!content.filled_sections?.includes("nutrition")}>
          <NutritionVisualization nutrition={content.nutrition} />

          <ToolButton href="/tools/pfc-carb?return=goal-sheet" label="PFC・カーボサイクル設定" applied={!!content.nutrition?.pfc?.c} />

          {audits?.section_comments?.nutrition && (
            <SectionAudit audit={audits.section_comments.nutrition} />
          )}
        </SectionWrapper>

        {/* ④ プラスの感情を含むゴール */}
        <SectionWrapper sectionKey="positive_goals" filled={!!content.filled_sections?.includes("positive_goals")}>
          <Field label="達成時の気持ち" required>
            <TextArea
              value={content.positive_goals?.achievement_feeling ?? ""}
              onChange={(v) => updatePositiveGoals({ achievement_feeling: v })}
              placeholder="例: 自信がついて、家族と思いっきり遊べる体になりたい"
            />
          </Field>

          {audits?.section_comments?.positive_goals && (
            <SectionAudit audit={audits.section_comments.positive_goals} />
          )}
        </SectionWrapper>

        {/* ⑤ セルフイメージ改善 */}
        <SectionWrapper sectionKey="self_image" filled={!!content.filled_sections?.includes("self_image")}>
          <div className="text-[11px] text-[#6a6256] mb-2 leading-relaxed">
            8 項目それぞれを「今 (改善前)」 と「目標 (改善後)」 で 0-10 点で評価。
          </div>
          <div className="text-[10px] text-[#a59b8c] mb-3 leading-relaxed">
            スコア: 0 = まったく / 5 = ときどき / 10 = いつもできている。
            <br />
            改善前 = 今のリアルな実感で (高くつけすぎ注意)、 改善後 = 想像で OK (後で修正できます)。
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-[10px] font-bold text-center py-1 px-2 rounded bg-[#fffdf8] text-[#6a6256] border border-[#e7dcc9]">
              改善前 (今)
            </div>
            <div className="text-[10px] font-bold text-center py-1 px-2 rounded bg-[#f8f9fa] text-[#34603f] border border-[#4a875b]">
              改善後 (目標)
            </div>
          </div>
          {SELF_IMAGE_ITEMS.map((meta) => {
            const item = content.self_image?.find((i) => i.key === meta.key);
            const hint = SELF_IMAGE_HINTS[meta.key];
            return (
              <div key={meta.key} className="py-2.5 border-b border-dashed border-[#e7dcc9] last:border-b-0">
                <div className="text-[11px] text-zinc-700 leading-snug mb-2">
                  {meta.label}
                  {hint && (
                    <span className="block text-[10px] text-[#a59b8c] mt-0.5">
                      ・ {hint}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <SliderWithValue
                    value={item?.before ?? null}
                    onChange={(v) => updateSelfImage(meta.key, { before: v })}
                  />
                  <SliderWithValue
                    value={item?.after ?? null}
                    onChange={(v) => updateSelfImage(meta.key, { after: v })}
                  />
                </div>
              </div>
            );
          })}

          {audits?.section_comments?.self_image && (
            <SectionAudit audit={audits.section_comments.self_image} />
          )}
        </SectionWrapper>

        {/* 全体総評 */}
        {audits?.summary && (
          <div className="bg-[rgba(255,235,59,0.12)] border border-[rgba(255,235,59,0.55)] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-bold text-[#b8860b]">{audits.summary.who}</div>
              <div className="ml-auto text-[10px] text-[#6a6256] font-mono">{audits.summary.date}</div>
            </div>
            <div className="text-[13px] text-[#2b2620] leading-relaxed whitespace-pre-wrap">
              {audits.summary.text}
            </div>
          </div>
        )}

        {/* 下部リンク 2 個 (編集履歴 / 変化を見る) */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="#"
            onClick={(e) => { e.preventDefault(); alert("編集履歴は Phase 3 後半で実装予定です"); }}
            className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-3.5 text-center text-[11px] font-semibold text-[#2b2620] flex flex-col items-center gap-1.5 hover:border-[#4a875b] transition-colors"
          >
            <svg className="w-5 h-5 text-[#2b2620]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            編集履歴
          </Link>
          <Link
            href="#"
            onClick={(e) => { e.preventDefault(); alert("変化を見るページは Phase 3 後半で実装予定です"); }}
            className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-3.5 text-center text-[11px] font-semibold text-[#2b2620] flex flex-col items-center gap-1.5 hover:border-[#4a875b] transition-colors"
          >
            <svg className="w-5 h-5 text-[#2b2620]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            変化を見る
          </Link>
        </div>
      </div>

      {/* エラー / 成功メッセージ */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          ⚠ {error}
        </div>
      )}
      {savedMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-zinc-900 text-white rounded-lg shadow-lg text-xs font-bold whitespace-nowrap transition-opacity duration-300 ${
            savedMessageVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-[#7ad6c8] mr-1">✓</span>
          {savedMessage}
        </div>
      )}

      {/* 保存バー (= 「送信して添削を依頼」 のみ ・ 下書きは自動保存に移行) */}
      <div className="bg-[#fffdf8] border-t border-[#e7dcc9] px-4 py-3 sticky bottom-[calc(64px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="w-full px-3 py-3 bg-[#4a875b] hover:bg-[#34603f] text-white rounded-2xl text-sm font-bold disabled:opacity-50 transition-colors"
        >
          {isPending ? "送信中..." : reviewButtonLabel}
        </button>
        <p className="text-[10px] text-[#a59b8c] text-center mt-2">
          編集内容は自動保存されています ・ 添削を依頼する時にこのボタンを押してください
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// 子コンポーネント
// =====================================================================

function SectionWrapper({
  sectionKey,
  filled,
  children,
}: {
  sectionKey: SectionKey;
  filled: boolean;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[sectionKey];
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e7dcc9] flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-zinc-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
          {meta.num}
        </div>
        <div className="flex-1 text-[13px] font-bold text-[#2b2620]">{meta.title}</div>
        <div
          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            filled
              ? "border border-[#4a875b] text-[#34603f] bg-[#fffdf8]"
              : "border border-zinc-300 text-[#6a6256] bg-[#fffdf8]"
          }`}
        >
          {filled ? "✓ 記入済" : "未記入"}
        </div>
      </div>
      <div className="p-4 space-y-3.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  autoTag,
  audit,
  children,
}: {
  label: string;
  required?: boolean;
  autoTag?: string;
  audit?: AuditComment;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#6a6256] mb-1.5 gap-1.5">
        <span>
          {label}
          {required && <span className="text-red-500 ml-1">★</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {autoTag && (
            <span className="text-[9px] text-[#6a6256] bg-[#f8f9fa] border border-[#e7dcc9] px-1.5 py-0.5 rounded font-medium">
              {autoTag}
            </span>
          )}
          {audit && (
            <span className="text-[10px] text-[#b8860b] bg-[rgba(255,235,59,0.12)] border border-[rgba(255,235,59,0.55)] px-2 py-0.5 rounded-full font-bold">
              💬 1
            </span>
          )}
        </div>
      </div>
      {children}
      {audit && (
        <div className="mt-1.5 bg-[rgba(255,235,59,0.12)] border-l-2 border-[rgba(255,235,59,0.55)] px-2.5 py-2 rounded-r-md text-[11px] text-zinc-700 leading-relaxed">
          <div className="text-[10px] text-[#b8860b] font-bold mb-1">{audit.who}</div>
          {audit.text}
        </div>
      )}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  unit,
  readOnly,
  step = 0.1,
  min,
  max,
  placeholder,
  decimals = 1,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  readOnly?: boolean;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  decimals?: number;
}) {
  // 表示用の文字列 state (フォーカス中は生の入力値、フォーカス外で整形値)
  const [display, setDisplay] = useState(
    value !== undefined ? value.toFixed(decimals) : ""
  );
  // フォーカス中フラグ (入力中は外部 value 変化を反映しない、入力を邪魔しないため)
  const [isFocused, setIsFocused] = useState(false);

  // 外部から value が変わった時、フォーカス外でだけ display 同期 (リセット/保存後など)
  useEffect(() => {
    if (isFocused) return;
    setDisplay(value !== undefined ? value.toFixed(decimals) : "");
  }, [value, decimals, isFocused]);

  return (
    <div className="flex gap-1.5 items-center">
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9.]*"
        value={display}
        placeholder={placeholder}
        readOnly={readOnly}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          // 全角→半角に自動正規化 + 不正文字除去
          const normalized = normalizeNumberInput(e.target.value);
          setDisplay(normalized);
          onChange(normalized === "" ? undefined : parseFloat(normalized));
        }}
        onBlur={() => {
          setIsFocused(false);
          // フォーカス外れた瞬間に小数桁を整形 (例: 75 → 75.0)
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
        className={`flex-1 px-3 py-2.5 text-[13px] border border-[#e7dcc9] rounded-lg bg-[#fffdf8] text-[#2b2620] ${
          readOnly ? "bg-[#f8f9fa] font-bold" : ""
        }`}
      />
      {unit && <span className="text-[11px] text-[#6a6256]">{unit}</span>}
      {/* step / min / max はキーボードショートカット用に保持 (text input なので step 機能はないが、設定値として将来用) */}
      <input type="hidden" data-step={step} data-min={min} data-max={max} />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 text-[13px] border border-[#e7dcc9] rounded-lg bg-[#fffdf8] text-[#2b2620] ${
        readOnly ? "bg-[#f8f9fa] font-bold" : ""
      }`}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full px-3 py-2.5 text-[13px] border border-[#e7dcc9] rounded-lg bg-[#fffdf8] text-[#2b2620] resize-none"
    />
  );
}

function SliderWithValue({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  // null = 未記入。 サムは中央 (5) 位置で薄表示 ・ ラベルは "— 未記入"
  // 受講生が触ると onChange で数値が入って通常表示に切替
  const isUnset = value === null;
  return (
    <div>
      <input
        type="range"
        min={0}
        max={10}
        value={isUnset ? 5 : value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={`w-full accent-[#4a875b] ${isUnset ? "opacity-30" : ""}`}
      />
      <div
        className={`text-center text-[13px] font-mono ${
          isUnset ? "text-[#a59b8c] font-normal" : "text-[#34603f] font-bold"
        }`}
      >
        {isUnset ? "— 未記入" : value}
      </div>
    </div>
  );
}

// セクション 5 ・ 項目別の評価軸ヒント (D 提案 ・ 6 番と 7 番の意味曖昧さの補強)
const SELF_IMAGE_HINTS: Record<string, string> = {
  item_6: "ボディイメージの仕組みを理解できているか",
  item_7: "ネガティブを書き出す習慣ができているか",
};

/**
 * ③ 栄養設計セクションの視覚的表現
 * モック goal_sheet_v3.html 準拠: 目標カード + PFC 3 カード + 合計 + 公式 + 結果の読み方
 */
function NutritionVisualization({ nutrition }: { nutrition?: Nutrition }) {
  const targetCal = nutrition?.target_calorie;
  const p = nutrition?.pfc?.p;
  const f = nutrition?.pfc?.f;
  const c = nutrition?.pfc?.c;
  const pKcal = p ? p * 4 : 0;
  const fKcal = f ? f * 9 : 0;
  const cKcal = c ? c * 4 : 0;
  const totalKcal = pKcal + fKcal + cKcal;

  // ツール未反映 (値が空) の時は空状態表示
  if (!p || !f || !c) {
    return (
      <div className="bg-[#f8f9fa] border border-dashed border-[#e7dcc9] rounded-lg px-4 py-6 text-center">
        <svg className="w-8 h-8 mx-auto mb-2 text-[#a59b8c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <div className="text-[12px] text-zinc-600 mb-1 font-bold">栄養設計はこれから</div>
        <div className="text-[11px] text-[#6a6256] leading-relaxed">
          下の「PFC・カーボサイクル設定」ツールで計算 →<br />
          結果がここに反映されます
        </div>
      </div>
    );
  }

  const pPct = totalKcal > 0 ? Math.round((pKcal / totalKcal) * 100) : 0;
  const fPct = totalKcal > 0 ? Math.round((fKcal / totalKcal) * 100) : 0;
  const cPct = totalKcal > 0 ? Math.round((cKcal / totalKcal) * 100) : 0;
  const displayCal = targetCal ?? totalKcal;

  return (
    <div className="space-y-3">
      {/* 目標カード (深緑→緑グラデ) */}
      <div className="bg-gradient-to-br from-[#004d40] to-[#4a875b] text-white rounded-2xl px-4 py-4">
        <div className="text-[11px] opacity-90 mb-2.5 font-semibold tracking-wider flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          私が目指す 1 日の数字
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#fffdf8]/15 px-2.5 py-2 rounded-md">
            <div className="text-[9px] opacity-85 mb-0.5">カロリー</div>
            <div className="text-base font-bold font-mono">
              {displayCal.toLocaleString()} <span className="text-[11px] font-normal opacity-90">kcal</span>
            </div>
          </div>
          <div className="bg-[#fffdf8]/15 px-2.5 py-2 rounded-md">
            <div className="text-[9px] opacity-85 mb-0.5">P (たんぱく質)</div>
            <div className="text-base font-bold font-mono">
              {p} <span className="text-[11px] font-normal opacity-90">g</span>
            </div>
          </div>
          <div className="bg-[#fffdf8]/15 px-2.5 py-2 rounded-md">
            <div className="text-[9px] opacity-85 mb-0.5">F (脂質)</div>
            <div className="text-base font-bold font-mono">
              {f} <span className="text-[11px] font-normal opacity-90">g</span>
            </div>
          </div>
          <div className="bg-[#fffdf8]/15 px-2.5 py-2 rounded-md">
            <div className="text-[9px] opacity-85 mb-0.5">C (糖質)</div>
            <div className="text-base font-bold font-mono">
              {c} <span className="text-[11px] font-normal opacity-90">g</span>
            </div>
          </div>
        </div>
      </div>

      {/* PFC 3 カード */}
      <div className="space-y-2">
        <PfcCard label="たんぱく質 (P)" g={p} kcal={pKcal} pct={pPct} />
        <PfcCard label="脂質 (F)" g={f} kcal={fKcal} pct={fPct} />
        <PfcCard label="糖質 (C)" g={c} kcal={cKcal} pct={cPct} />
      </div>

      {/* 合計カロリー */}
      <div className="bg-[#f8f9fa] border border-[#e7dcc9] rounded-lg px-3.5 py-3 flex justify-between items-center">
        <div className="text-[11px] text-[#6a6256] font-semibold">合計カロリー</div>
        <div className="text-base font-bold text-[#2b2620] font-mono">
          {totalKcal.toLocaleString()} kcal
        </div>
      </div>

      {/* PFC 公式 */}
      <div className="text-[10px] text-[#6a6256] text-center font-mono">
        P = 4 kcal/g  /  F = 9 kcal/g  /  C = 4 kcal/g
      </div>

      {/* 結果の読み方 */}
      <div className="bg-[#f8f9fa] border border-dashed border-[#e7dcc9] rounded-lg px-3.5 py-3">
        <div className="text-[#2b2620] font-bold mb-2 text-xs flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
          </svg>
          結果の読み方
        </div>
        <div className="text-[13px] text-zinc-700 text-center">
          あなたは 1 日に{" "}
          <b className="text-[#34603f] text-2xl font-bold font-mono px-1 align-middle">
            C = {c}g
          </b>{" "}
          の糖質が必要です。
        </div>
      </div>
    </div>
  );
}

function PfcCard({
  label,
  g,
  kcal,
  pct,
}: {
  label: string;
  g: number;
  kcal: number;
  pct: number;
}) {
  return (
    <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-lg px-3.5 py-3 grid grid-cols-[12px_1fr_auto] gap-2.5 items-center">
      <div className="w-2.5 h-2.5 rounded-full bg-[#4a875b]" />
      <div>
        <div className="text-[11px] text-[#6a6256]">{label}</div>
        <div className="text-base font-bold text-[#2b2620] font-mono">{g} g</div>
      </div>
      <div className="text-right text-[11px] text-[#6a6256] leading-tight">
        <div className="font-semibold text-[#2b2620]">{kcal.toLocaleString()} kcal</div>
        <div className="text-[#34603f] font-bold font-mono">{pct} %</div>
      </div>
    </div>
  );
}

function ToolButton({
  href,
  label,
  applied,
}: {
  href: string;
  label: string;
  applied?: boolean;
}) {
  return (
    <Link
      href={href}
      className="w-full bg-[#4a875b] hover:bg-[#34603f] text-white px-3.5 py-3 rounded-md text-xs font-bold mt-2.5 flex justify-between items-center tracking-wide transition-colors"
    >
      <span>{label}</span>
      {applied && (
        <span className="text-[9px] bg-[#fffdf8]/25 px-1.5 py-0.5 rounded font-semibold">
          反映済
        </span>
      )}
    </Link>
  );
}

function SectionAudit({ audit }: { audit: AuditComment }) {
  return (
    <div className="bg-[rgba(255,235,59,0.12)] border border-[rgba(255,235,59,0.55)] rounded-lg p-3 mt-3.5 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[11px] font-bold text-[#b8860b]">のりfitness の添削</div>
        <div className="ml-auto text-[10px] text-[#6a6256] font-mono">{audit.date}</div>
      </div>
      <div className="text-[#2b2620] leading-relaxed">{audit.text}</div>
    </div>
  );
}
