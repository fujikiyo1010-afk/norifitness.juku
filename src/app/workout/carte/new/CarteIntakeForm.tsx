"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMyCarte, type MyCarteInput } from "@/lib/workout/actions";
import type {
  Gender,
  Environment,
  Frequency,
  BodyPartGroup,
  Purpose,
  Experience,
  MedicalLimit,
  IdealBody,
} from "@/lib/workout/types";

// =====================================================================
// 選択肢定義
// =====================================================================

const GENDER_OPTIONS: Gender[] = ["男", "女", "その他"];
const ENV_OPTIONS: Environment[] = [
  "何もない",
  "ダンベル",
  "ベンチ",
  "懸垂機",
  "ジム",
  "家トレ",
];
const FREQUENCY_OPTIONS: Frequency[] = [
  "毎日コツコツ",
  "毎日",
  "週6",
  "週5",
  "週4",
  "週3-4",
  "週3",
  "週2-3",
  "週2",
  "週1",
  "任せる",
];
const BODY_PART_OPTIONS: BodyPartGroup[] = [
  "全身バランス",
  "腕",
  "胸",
  "背中",
  "脚",
  "腹筋",
  "肩",
];
const PURPOSE_OPTIONS: Purpose[] = [
  "ダイエット",
  "筋肉増",
  "健康維持",
  "体力向上",
  "見た目改善",
];
const EXPERIENCE_OPTIONS: Experience[] = ["全くない", "たまに", "週次", "毎日"];
const MEDICAL_OPTIONS: MedicalLimit[] = [
  "腰痛",
  "膝痛",
  "心臓",
  "高血圧",
  "その他",
];
const IDEAL_BODY_OPTIONS: IdealBody[] = [
  "健康+適度に筋肉",
  "細マッチョ",
  "マッチョ",
  "曲線美",
  "モデル体型",
];

const DRAFT_KEY = "workout_carte_draft_v1";

// =====================================================================
// 質問定義 (UI 表示順 + 項目番号)
// =====================================================================

type SectionKey = "you" | "ref";

const CARTE_SECTIONS: Record<
  SectionKey,
  { label: string; count: number; order: number }
> = {
  you: { label: "あなたについて", count: 5, order: 1 },
  ref: { label: "のりfitness への参考情報", count: 4, order: 2 },
};

const TOTAL_QUESTIONS = 9;

type CarteQuestion = {
  key: keyof DraftState;
  num: number;
  section: SectionKey;
  label: string;
  required: boolean;
  helper?: string;
  options: readonly string[];
  multi: boolean;
};

// 注: 生年月日 (Q1) は date 入力なので CARTE_QUESTIONS には含めず、
//     BirthdayCard で独立に描画する。 num は 1 を予約し、 既存 8 項目は 2..9 に振る。
const CARTE_QUESTIONS: readonly CarteQuestion[] = [
  { key: "gender", num: 2, section: "you", label: "性別", required: true, options: GENDER_OPTIONS, multi: false },
  { key: "environments", num: 3, section: "you", label: "使える環境", required: true, helper: "複数選んでください", options: ENV_OPTIONS, multi: true },
  { key: "frequency_wish", num: 4, section: "you", label: "理想の頻度", required: true, options: FREQUENCY_OPTIONS, multi: false },
  { key: "focus_body_parts", num: 5, section: "you", label: "鍛えたい部位", required: true, helper: "複数選んでください", options: BODY_PART_OPTIONS, multi: true },
  { key: "purposes", num: 6, section: "ref", label: "目的", required: false, helper: "複数選んでも OK", options: PURPOSE_OPTIONS, multi: true },
  { key: "experience", num: 7, section: "ref", label: "今までの運動経験", required: false, options: EXPERIENCE_OPTIONS, multi: false },
  { key: "medical_limits", num: 8, section: "ref", label: "気になる体の不調", required: false, helper: "ない場合は何も選ばずに OK", options: MEDICAL_OPTIONS, multi: true },
  { key: "ideal_body", num: 9, section: "ref", label: "目指す身体像", required: false, options: IDEAL_BODY_OPTIONS, multi: false },
];

// =====================================================================
// 下書きの型
// =====================================================================

type DraftState = {
  birthday: string | null; // YYYY-MM-DD (Q1, 必須)
  gender: Gender;
  environments: Environment[];
  frequency_wish: Frequency | null;
  focus_body_parts: BodyPartGroup[];
  purposes: Purpose[];
  experience: Experience | null;
  medical_limits: MedicalLimit[];
  ideal_body: IdealBody | null;
};

const INITIAL_DRAFT: DraftState = {
  birthday: null,
  gender: "男",
  environments: [],
  frequency_wish: null,
  focus_body_parts: [],
  purposes: [],
  experience: null,
  medical_limits: [],
  ideal_body: null,
};

// 生年月日入力の許容範囲 (未来日付・100 歳超 を弾く)
function getBirthdayRange() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const minYear = today.getFullYear() - 100;
  const minStr = `${minYear}-01-01`;
  return { todayStr, minStr };
}

// =====================================================================
// コンポーネント
// =====================================================================

export function CarteIntakeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"form" | "preview">("form");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<Set<string>>(new Set());

  // フォーム state
  const [draft, setDraft] = useState<DraftState>(INITIAL_DRAFT);

  // 初回マウント時に localStorage から下書き復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DraftState & { _savedAt?: string };
        setDraft({
          birthday: parsed.birthday ?? null,
          gender: parsed.gender ?? "男",
          environments: parsed.environments ?? [],
          frequency_wish: parsed.frequency_wish ?? null,
          focus_body_parts: parsed.focus_body_parts ?? [],
          purposes: parsed.purposes ?? [],
          experience: parsed.experience ?? null,
          medical_limits: parsed.medical_limits ?? [],
          ideal_body: parsed.ideal_body ?? null,
        });
        if (parsed._savedAt) setDraftSavedAt(parsed._savedAt);
      }
    } catch {
      // localStorage が壊れていても無視
    }
    setHydrated(true);
  }, []);

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    // 必須項目が埋まったらエラー解除
    setMissingKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggle<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  // 下書き保存
  function handleSaveDraft() {
    setError(null);
    setSavedMessage(null);
    try {
      const now = new Date().toISOString();
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...draft, _savedAt: now })
      );
      setDraftSavedAt(now);
      setSavedMessage("下書きを保存しました");
    } catch {
      setError("下書き保存に失敗しました");
    }
  }

  // プレビュー前バリデーション
  function handlePreview() {
    setError(null);
    setSavedMessage(null);
    const missing = new Set<string>();
    if (!draft.birthday) missing.add("birthday");
    if (draft.environments.length === 0) missing.add("environments");
    if (!draft.frequency_wish) missing.add("frequency_wish");
    if (draft.focus_body_parts.length === 0) missing.add("focus_body_parts");
    if (missing.size > 0) {
      setMissingKeys(missing);
      setError(`未記入の必須項目が ${missing.size} 個あります`);
      return;
    }
    setMissingKeys(new Set());
    setMode("preview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 提出
  function handleSubmit() {
    setError(null);
    const input: MyCarteInput = { ...draft };
    startTransition(async () => {
      const result = await createMyCarte(input);
      if (result.ok) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        router.push("/workout/carte/complete");
      } else {
        setError(result.message);
        setMode("form");
      }
    });
  }

  // 進捗 (性別は常にデフォルト値あり = 記入済扱い)
  const filledCount =
    (draft.birthday ? 1 : 0) +
    1 + // gender
    (draft.environments.length > 0 ? 1 : 0) +
    (draft.frequency_wish ? 1 : 0) +
    (draft.focus_body_parts.length > 0 ? 1 : 0) +
    (draft.purposes.length > 0 ? 1 : 0) +
    (draft.experience ? 1 : 0) +
    (draft.medical_limits.length > 0 ? 1 : 0) +
    (draft.ideal_body ? 1 : 0);

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-[460px] px-4 py-6">
      <div className="bg-white border border-[#e8ebe9] rounded-2xl overflow-hidden">
        {/* ヘッダー */}
        <div className="px-4 py-3 border-b border-[#e8ebe9] flex items-center gap-2">
          <Link href="/" className="text-zinc-900">
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
            筋トレカルテ
          </div>
          <div className="w-5 h-5" />
        </div>

        {mode === "form" ? (
          <>
            {/* 温かいグラデ説明ブロック */}
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                のりfitness の筋トレカルテ
              </div>
              <div className="text-2xl font-bold text-zinc-900 mb-2 tracking-wide leading-tight">
                あなたのカルテ
              </div>
              <div className="text-xs text-zinc-700 mb-3">
                オリジナルメニューを作るための、はじめの 1 歩。
              </div>
              <div className="text-[11px] text-zinc-500 leading-relaxed pt-2.5 border-t border-[#e8ebe9]">
                記入後、のりfitness が確認してメニューを作成します。
                <br />
                提出後は変更できないので、慎重にお選びください。
              </div>
            </div>

            {/* 進捗バー */}
            <div className="px-4 py-3 bg-[#f8f9fa] border-b border-[#e8ebe9]">
              <div className="flex justify-between text-[11px] text-zinc-500 mb-1.5">
                <span>記入状況</span>
                <span className="font-bold text-zinc-900 font-mono">
                  {filledCount} / {TOTAL_QUESTIONS} 項目
                </span>
              </div>
              <div className="h-1.5 bg-white border border-[#e8ebe9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00897b] transition-all"
                  style={{ width: `${(filledCount / TOTAL_QUESTIONS) * 100}%` }}
                />
              </div>
            </div>

            {/* 下書き保存通知 */}
            {draftSavedAt && (
              <div className="px-4 py-2.5 bg-[#f8f9fa] text-[10px] text-zinc-500 text-center border-b border-[#e8ebe9]">
                下書きを保存しました ・{" "}
                {new Date(draftSavedAt).toLocaleString("ja-JP", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}

            {/* セクション別 8 項目 */}
            <div className="bg-white">
              {(Object.keys(CARTE_SECTIONS) as SectionKey[])
                .sort(
                  (a, b) => CARTE_SECTIONS[a].order - CARTE_SECTIONS[b].order
                )
                .map((secKey) => {
                  const sec = CARTE_SECTIONS[secKey];
                  const questions = CARTE_QUESTIONS.filter(
                    (q) => q.section === secKey
                  );
                  return (
                    <div key={secKey}>
                      <CategoryBand label={sec.label} count={sec.count} />
                      {secKey === "you" && (
                        <BirthdayCard
                          value={draft.birthday}
                          onChange={(v) => update("birthday", v)}
                          missing={missingKeys.has("birthday")}
                        />
                      )}
                      {questions.map((q) => (
                        <ItemCard
                          key={q.key}
                          question={q}
                          draft={draft}
                          onUpdate={update}
                          onToggle={(value) => {
                            if (q.key === "environments") {
                              update("environments", toggle(draft.environments, value as Environment));
                            } else if (q.key === "focus_body_parts") {
                              update("focus_body_parts", toggle(draft.focus_body_parts, value as BodyPartGroup));
                            } else if (q.key === "purposes") {
                              update("purposes", toggle(draft.purposes, value as Purpose));
                            } else if (q.key === "medical_limits") {
                              update("medical_limits", toggle(draft.medical_limits, value as MedicalLimit));
                            }
                          }}
                          missing={missingKeys.has(q.key)}
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

            {/* 保存バー */}
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
            draft={draft}
            onEdit={() => setMode("form")}
            onSubmit={handleSubmit}
            isPending={isPending}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

// =====================================================================
// プレビュー画面 (送信前の確認)
// =====================================================================

function PreviewView({
  draft,
  onEdit,
  onSubmit,
  isPending,
  error,
}: {
  draft: DraftState;
  onEdit: () => void;
  onSubmit: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <>
      <div className="px-4 py-4 bg-gradient-to-br from-[#e0f2f1] to-[#fffbe6] border-b border-[#e8ebe9] text-center">
        <div className="text-xs font-bold text-[#00695c] mb-2 tracking-wide">
          プレビュー (送信前の確認)
        </div>
        <div className="text-xl font-bold text-zinc-900 mb-1 tracking-wide">
          このカルテで提出します
        </div>
        <div className="text-[11px] text-zinc-600 leading-relaxed mt-2">
          内容を確認してから送信してください。
          <br />
          送信後は変更できません。
        </div>
      </div>

      <div className="bg-white">
        {(Object.keys(CARTE_SECTIONS) as SectionKey[])
          .sort((a, b) => CARTE_SECTIONS[a].order - CARTE_SECTIONS[b].order)
          .map((secKey) => {
            const sec = CARTE_SECTIONS[secKey];
            const questions = CARTE_QUESTIONS.filter(
              (q) => q.section === secKey
            );
            return (
              <div key={secKey}>
                <CategoryBand label={sec.label} count={sec.count} />
                {secKey === "you" && <BirthdayPreviewItem value={draft.birthday} />}
                {questions.map((q) => (
                  <PreviewItem key={q.key} question={q} draft={draft} />
                ))}
              </div>
            );
          })}
      </div>

      {error && (
        <div className="mx-4 my-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          ⚠ {error}
        </div>
      )}

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
  draft,
  onUpdate,
  onToggle,
  missing,
}: {
  question: CarteQuestion;
  draft: DraftState;
  onUpdate: <K extends keyof DraftState>(key: K, value: DraftState[K]) => void;
  onToggle: (value: string) => void;
  missing: boolean;
}) {
  // 現在値取得
  const value = draft[question.key];

  return (
    <div
      className={`p-4 border-b border-[#e8ebe9] ${
        missing ? "bg-red-50" : ""
      }`}
    >
      <div className="text-[11px] text-zinc-500 font-bold font-mono mb-1">
        Q{question.num} / 8
      </div>
      <div className="text-[13px] font-bold text-zinc-900 leading-snug mb-2.5 flex justify-between items-start gap-2">
        <span>
          {question.label}
          {question.helper && (
            <span className="ml-2 text-[10px] text-zinc-500 font-normal">
              {question.helper}
            </span>
          )}
        </span>
        {question.required ? (
          <span className="text-red-500 text-[11px] flex-shrink-0">★</span>
        ) : (
          <span className="text-zinc-300 text-[10px] font-medium flex-shrink-0">
            (任意)
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => {
          const selected = question.multi
            ? Array.isArray(value) && (value as string[]).includes(opt)
            : value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (question.multi) {
                  onToggle(opt);
                } else {
                  // 単一選択: そのキーの型に合わせて代入
                  onUpdate(
                    question.key,
                    opt as DraftState[typeof question.key]
                  );
                }
              }}
              className={`rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
                selected
                  ? "border-[#00897b] bg-[rgba(0,137,123,0.08)] text-[#00695c]"
                  : "border-[#e8ebe9] bg-white text-zinc-700 hover:border-[#00897b]"
              }`}
            >
              {selected && question.multi && (
                <span className="mr-1">✓</span>
              )}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 生年月日カード (Q1 専用、 date 入力)
function BirthdayCard({
  value,
  onChange,
  missing,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  missing: boolean;
}) {
  const { todayStr, minStr } = getBirthdayRange();
  return (
    <div
      className={`p-4 border-b border-[#e8ebe9] ${missing ? "bg-red-50" : ""}`}
    >
      <div className="text-[11px] text-zinc-500 font-bold font-mono mb-1">
        Q1 / {TOTAL_QUESTIONS}
      </div>
      <div className="text-[13px] font-bold text-zinc-900 leading-snug mb-2.5 flex justify-between items-start gap-2">
        <span>
          生年月日
          <span className="ml-2 text-[10px] text-zinc-500 font-normal">
            年齢層からメニュー最適化に使います
          </span>
        </span>
        <span className="text-red-500 text-[11px] flex-shrink-0">★</span>
      </div>
      <input
        type="date"
        value={value ?? ""}
        max={todayStr}
        min={minStr}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-[#e8ebe9] bg-white text-zinc-900 px-3 py-2 text-sm font-bold focus:border-[#00897b] focus:outline-none"
      />
    </div>
  );
}

function BirthdayPreviewItem({ value }: { value: string | null }) {
  const display = value
    ? new Date(value).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "(未記入)";
  return (
    <div className="p-4 border-b border-[#e8ebe9]">
      <div className="text-[11px] text-zinc-500 font-bold font-mono mb-1">
        Q1 / {TOTAL_QUESTIONS}
      </div>
      <div className="text-[13px] font-bold text-zinc-900 leading-snug mb-2.5">
        生年月日
      </div>
      <div className="text-[13px] text-zinc-900 leading-relaxed bg-[#f8f9fa] rounded-md px-3 py-2">
        {display}
      </div>
    </div>
  );
}

function PreviewItem({
  question,
  draft,
}: {
  question: CarteQuestion;
  draft: DraftState;
}) {
  const value = draft[question.key];

  // 表示用文字列に変換
  let display: string;
  if (Array.isArray(value)) {
    display = value.length > 0 ? value.join(" ・ ") : "(なし)";
  } else if (value === null || value === undefined) {
    display = "(未記入)";
  } else {
    display = String(value);
  }

  return (
    <div className="p-4 border-b border-[#e8ebe9]">
      <div className="text-[11px] text-zinc-500 font-bold font-mono mb-1">
        Q{question.num} / 8
      </div>
      <div className="text-[13px] font-bold text-zinc-900 leading-snug mb-2.5">
        {question.label}
      </div>
      <div className="text-[13px] text-zinc-900 leading-relaxed bg-[#f8f9fa] rounded-md px-3 py-2">
        {display}
      </div>
    </div>
  );
}
