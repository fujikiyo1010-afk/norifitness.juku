"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveCarteAsAdmin,
  clearMenuReviewFlag,
  type CarteInput,
} from "@/lib/workout/actions";
import { LoadingSpinner } from "@/components/LoadingSpinner";
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
import type { CarteWithAgeBand } from "@/lib/workout/queries";

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
  "胸",
  "背中",
  "肩",
  "腕",
  "脚",
  "お尻",
  "腹筋",
  "全身",
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

// =====================================================================
// コンポーネント
// =====================================================================

export function CarteEditor({
  userId,
  userName,
  initialCarte,
  fromRequest = false,
  requestId = null,
}: {
  userId: string;
  userName: string;
  initialCarte: CarteWithAgeBand | null;
  fromRequest?: boolean;
  requestId?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  // フォーム state (initialCarte があれば既存値、なければデフォルト)
  const [gender, setGender] = useState<Gender>(initialCarte?.gender ?? "男");
  const [environments, setEnvironments] = useState<Environment[]>(
    initialCarte?.environments ?? []
  );
  const [frequencyWish, setFrequencyWish] = useState<Frequency | null>(
    (initialCarte?.frequency_wish as Frequency | null) ?? null
  );
  const [focusBodyParts, setFocusBodyParts] = useState<BodyPartGroup[]>(
    initialCarte?.focus_body_parts ?? []
  );
  const [purposes, setPurposes] = useState<Purpose[]>(
    initialCarte?.purposes ?? []
  );
  const [experience, setExperience] = useState<Experience | null>(
    initialCarte?.experience ?? null
  );
  const [medicalLimits, setMedicalLimits] = useState<MedicalLimit[]>(
    initialCarte?.medical_limits ?? []
  );
  const [idealBody, setIdealBody] = useState<IdealBody | null>(
    initialCarte?.ideal_body ?? null
  );

  // トグル関数 (配列の add/remove)
  function toggle<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  // 保存
  function handleSave() {
    setMessage(null);
    const input: CarteInput = {
      user_id: userId,
      gender,
      environments,
      frequency_wish: frequencyWish,
      focus_body_parts: focusBodyParts,
      purposes,
      experience,
      medical_limits: medicalLimits,
      ideal_body: idealBody,
    };
    startTransition(async () => {
      const result = await saveCarteAsAdmin(input);
      if (result.ok) {
        setMessage({ type: "ok", text: "保存しました" });
        // リクエスト経由なら 返信フォームへ自動で戻す (= /admin/requests 右ペイン展開)
        if (fromRequest && requestId) {
          router.push(`/admin/requests?id=${requestId}&type=carte`);
          router.refresh();
          return;
        }
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.message });
      }
    });
  }

  // メニュー見直しフラグクリア
  function handleClearFlag() {
    startTransition(async () => {
      const result = await clearMenuReviewFlag(userId);
      if (result.ok) {
        setMessage({ type: "ok", text: "メニュー見直しフラグをクリアしました" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.message });
      }
    });
  }

  // 機械マッチング 4 項目が完成しているか (検索可能か)
  const isMachineReady =
    environments.length > 0 && !!frequencyWish && focusBodyParts.length > 0;

  return (
    <div className="space-y-6">
      {/* メッセージ */}
      {message && (
        <div
          className={`rounded-[14px] border p-3 text-sm ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* セクション 1: 機械マッチング (4 項目) */}
      <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-[#00897b]" />
          <h2 className="text-sm font-semibold text-zinc-900">
            機械マッチング項目 (4 項目)
          </h2>
        </div>
        <p className="mb-5 text-xs text-zinc-600">
          ここを変更すると、メニュー見直し推奨フラグが立ちます。
        </p>

        {/* 性別 */}
        <Field label="性別" required>
          <RadioGroup
            options={GENDER_OPTIONS}
            value={gender}
            onChange={setGender}
          />
        </Field>

        {/* 環境 (複数) */}
        <Field label="利用可能な環境" required helper="複数選択可">
          <CheckGroup
            options={ENV_OPTIONS}
            values={environments}
            onChange={(v) => setEnvironments(toggle(environments, v))}
          />
        </Field>

        {/* 頻度希望 */}
        <Field label="理想の頻度" required>
          <RadioGroup
            options={FREQUENCY_OPTIONS}
            value={frequencyWish}
            onChange={setFrequencyWish}
            allowNull
          />
        </Field>

        {/* 重点部位 (複数) */}
        <Field label="重点部位" required helper="複数選択可">
          <CheckGroup
            options={BODY_PART_OPTIONS}
            values={focusBodyParts}
            onChange={(v) => setFocusBodyParts(toggle(focusBodyParts, v))}
          />
        </Field>

        <div className="mt-4 text-xs">
          {isMachineReady ? (
            <span className="text-emerald-700">
              ✓ マッチング検索に必要な項目が揃っています
            </span>
          ) : (
            <span className="text-zinc-500">
              マッチング検索には環境 / 頻度 / 重点部位 の入力が必要です
            </span>
          )}
        </div>
      </section>

      {/* セクション 2: 判断補助 (4 項目) */}
      <section className="rounded-[14px] border border-[#e8ebe9] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-900">
            判断補助項目 (4 項目)
          </h2>
        </div>
        <p className="mb-5 text-xs text-zinc-600">
          のり氏が候補選定時に参考にする項目 (機械マッチングには使いません)
        </p>

        {/* 目的 (複数) */}
        <Field label="目的" helper="複数選択可">
          <CheckGroup
            options={PURPOSE_OPTIONS}
            values={purposes}
            onChange={(v) => setPurposes(toggle(purposes, v))}
          />
        </Field>

        {/* 運動経験 */}
        <Field label="運動経験">
          <RadioGroup
            options={EXPERIENCE_OPTIONS}
            value={experience}
            onChange={setExperience}
            allowNull
          />
        </Field>

        {/* 医師制限 (複数) */}
        <Field label="医師制限" helper="該当なしの場合は何も選択しない">
          <CheckGroup
            options={MEDICAL_OPTIONS}
            values={medicalLimits}
            onChange={(v) => setMedicalLimits(toggle(medicalLimits, v))}
          />
        </Field>

        {/* 目指す身体像 */}
        <Field label="目指す身体像">
          <RadioGroup
            options={IDEAL_BODY_OPTIONS}
            value={idealBody}
            onChange={setIdealBody}
            allowNull
          />
        </Field>
      </section>

      {/* メニュー見直しフラグクリア */}
      {initialCarte?.menu_review_needed && (
        <section className="rounded-[14px] border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">
            カルテ変更あり / メニュー要確認
          </h3>
          <p className="mb-3 text-xs text-amber-800">
            自分でカルテの機械マッチング項目を変更しました
            {initialCarte.last_machine_field_changed_at && (
              <>
                {" "}({formatDate(initialCarte.last_machine_field_changed_at)})
              </>
            )}
            。今のメニューが新カルテと合っているか確認し、必要なら再配布してください。確認が済んだらこのフラグをクリアできます。
          </p>
          <button
            type="button"
            onClick={handleClearFlag}
            disabled={isPending}
            className="rounded-[4px] border border-amber-300 bg-white px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            確認済みにする
          </button>
        </section>
      )}

      {/* 保存ボタン (フッタ固定) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#e8ebe9] bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="text-xs text-zinc-600">
            {userName} さんのカルテ
            {initialCarte ? " (編集)" : " (新規作成)"}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-[4px] bg-[#00897b] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#00695c] disabled:opacity-50"
          >
            {isPending ? (
              <>
                <LoadingSpinner /> 保存中…
              </>
            ) : fromRequest ? (
              "保存して 返信フォームへ →"
            ) : (
              "保存"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 小コンポーネント
// =====================================================================

function Field({
  label,
  required,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 flex items-baseline gap-2">
        <label className="text-sm font-medium text-zinc-900">{label}</label>
        {required && (
          <span className="text-[10px] font-medium text-rose-600">必須</span>
        )}
        {helper && <span className="text-xs text-zinc-500">{helper}</span>}
      </div>
      {children}
    </div>
  );
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  allowNull,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  allowNull?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (allowNull && selected) {
                // null 化したい場合は再度同じボタン押下で解除する選択肢もあるが、
                // 現状は別の選択肢を押すか保存しないと null に戻せない仕様
                return;
              }
              onChange(opt);
            }}
            className={`rounded-[4px] border px-3 py-2 text-xs font-medium transition ${
              selected
                ? "border-[#00897b] bg-[#00897b]/5 text-[#00695c]"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function CheckGroup<T extends string>({
  options,
  values,
  onChange,
}: {
  options: readonly T[];
  values: T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = values.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-[4px] border px-3 py-2 text-xs font-medium transition ${
              selected
                ? "border-[#00897b] bg-[#00897b]/5 text-[#00695c]"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
            }`}
          >
            {selected && <span className="mr-1">✓</span>}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
