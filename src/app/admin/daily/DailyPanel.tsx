"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DailyDetail } from "@/lib/admin/daily";
import {
  CONDITION_LABEL,
  BOWEL_LABEL,
  ALCOHOL_LABEL,
} from "@/lib/conditions/types";
import {
  sendDailyFeedback,
  skipDailyFeedback,
} from "@/lib/daily-feedbacks/actions";
import {
  ScaleIcon,
  DumbbellIcon,
  MealIcon,
  BookOpenIcon,
  MoonIcon,
  TrendingUpIcon,
  TargetIcon,
  DocIcon,
  ChatIcon,
} from "@/components/icons";
import type { ReactNode } from "react";
import { PhotoLightbox } from "@/components/PhotoLightbox";

/**
 * デイリー添削 パネル（P2a v1）。モックM2準拠。
 * 実データ: 今のからだ / 今日の学習 / 計画・カルテ / 学び / これまでの言葉 / 目標シート / 日次FB。
 * プレースホルダ: 今日のトレ(P5) / 今日の食事(P4) / 生活(P6)。
 */

const TEAL = "#00897b";
const TEAL_DARK = "#00695c";

function fmtNum(n: number | null | undefined, d = 1): string {
  return n == null ? "—" : n.toFixed(d);
}
function mdLabel(iso: string | null): string {
  if (!iso) return "—";
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

type Tab = "today" | "plan" | "learn" | "words";

export function DailyPanel({
  detail,
  date,
  remaining,
  nextUserId,
}: {
  detail: DailyDetail;
  date: string;
  remaining: number;
  nextUserId: string | null;
}) {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex-1 min-w-0 px-6 py-5 pb-4">
        <PanelHead detail={detail} />
        <FourCards detail={detail} />

        {/* タブ */}
        <div className="flex items-center border-b-2 border-[#e8ebe9] mb-4">
          <div className="flex gap-0.5 flex-1">
            {(
              [
                { key: "today", label: "今日" },
                { key: "plan", label: "計画・カルテ" },
                { key: "learn", label: "学び" },
                { key: "words", label: "これまでの言葉" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative text-[12.5px] font-bold px-4 py-2.5 -mb-0.5 border-b-2 transition-colors ${
                  tab === t.key
                    ? "text-[#00695c] border-[#00897b]"
                    : "text-zinc-500 border-transparent hover:text-zinc-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "today" && <TodayTab detail={detail} />}
        {tab === "plan" && <PlanTab detail={detail} />}
        {tab === "learn" && <LearnTab detail={detail} />}
        {tab === "words" && <WordsTab detail={detail} />}
      </div>

      <FbBar
        detail={detail}
        date={date}
        remaining={remaining}
        nextUserId={nextUserId}
      />
    </div>
  );
}

// =====================================================================
// ヘッダ
// =====================================================================

function PanelHead({ detail }: { detail: DailyDetail }) {
  const { body, goal } = detail;
  const joined = detail.joinedAt ? mdLabel(detail.joinedAt) : "—";
  return (
    <div className="bg-white border border-[#e8ebe9] rounded-xl px-[18px] py-3.5 mb-3">
      <div className="flex items-center gap-3">
        <div
          className="w-[42px] h-[42px] rounded-full text-white flex items-center justify-center font-bold text-[15px] flex-shrink-0"
          style={{ background: TEAL }}
        >
          {detail.initial}
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold text-zinc-900">{detail.name}</div>
          <div className="text-[10.5px] text-zinc-500 mt-px">
            入会 {joined}
            {body.targetWeightKg != null && (
              <>
                {" ・ "}目標 {fmtNum(body.targetWeightKg)}kg
                {body.weightKg != null && (
                  <>
                    （今 {fmtNum(body.weightKg)}kg
                    {body.remainingKg != null && ` ・ あと${fmtNum(body.remainingKg)}kg`}）
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-1.5 items-center">
          <Link
            href={`/admin/users/${detail.userId}`}
            className="text-[11px] font-semibold text-[#00695c] border border-[#e8ebe9] rounded-md px-2.5 py-1 bg-white hover:bg-zinc-50"
          >
            受講生ハブ
          </Link>
          <Link
            href={`/admin/messages`}
            className="text-[11px] font-semibold text-[#00695c] border border-[#e8ebe9] rounded-md px-2.5 py-1 bg-white hover:bg-zinc-50"
          >
            チャット
          </Link>
        </div>
      </div>

      {(goal.shortTerm || goal.longTerm) && (
        <div className="flex items-center gap-2 mt-2.5 px-3 py-2 bg-[#f7faf9] border border-[#e3edea] rounded-[9px] text-[12px] text-[#2d4a45]">
          <span className="text-[9.5px] font-bold text-[#00695c] flex-shrink-0 tracking-wide">
            この人の目標
          </span>
          <span className="min-w-0">
            「{goal.longTerm || goal.shortTerm}」
            {goal.targetWeightKg != null && (
              <span className="text-zinc-500">（目標シートより）</span>
            )}
          </span>
        </div>
      )}

      {detail.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {detail.tags.map((t, i) => (
            <span
              key={i}
              className={`text-[10.5px] font-bold rounded-full px-2.5 py-[3px] border ${
                t.severity === "urgent"
                  ? "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                  : "bg-[#fff4e6] text-[#c2600f] border-[#fcd9ad]"
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 4カード
// =====================================================================

function FourCards({ detail }: { detail: DailyDetail }) {
  const { body, learning, workout, meals, isBeta } = detail;
  // 管1: 非ベータはトレクラ管理の人語・ベータは実状態(既存detailデータ・新規取得なし)
  const workoutValue = !isBeta
    ? "トレクラで記録中"
    : workout
      ? workout.status === "skipped"
        ? "お休み"
        : "完了"
      : "記録なし";
  const mealValue = !isBeta
    ? "トレクラで記録中"
    : meals.length > 0
      ? `${meals.length}件 記録`
      : "記録なし";
  return (
    <div className="grid grid-cols-4 gap-2.5 mb-3">
      {/* 今のからだ（実データ） */}
      <Card>
        <CardHead icon={<ScaleIcon size={14} />} title="今のからだ" />
        <div className="text-[20px] font-bold leading-none font-mono">
          {fmtNum(body.weightKg)}
          <small className="text-[10.5px] text-zinc-500 font-sans font-medium"> kg</small>
        </div>
        <div className="text-[10.5px] text-zinc-700 mt-1.5 leading-snug">
          {body.remainingKg != null ? (
            <>
              あと <b>{fmtNum(body.remainingKg)}kg</b>
            </>
          ) : (
            "目標未設定"
          )}
          {body.waistCm != null && ` ・ ウエスト ${fmtNum(body.waistCm)}cm`}
        </div>
        <div className="text-[10px] text-zinc-400 mt-0.5">
          {body.recordedAt
            ? `記録 ${mdLabel(body.recordedAt)}`
            : "記録なし"}
          {body.weightDelta7d != null &&
            ` ・ 7日 ${body.weightDelta7d > 0 ? "+" : ""}${fmtNum(body.weightDelta7d)}kg`}
        </div>
      </Card>

      {/* 今日のトレ（実状態 or トレクラ管理） */}
      <MiniCard icon={<DumbbellIcon size={14} />} title="今日のトレ" value={workoutValue} />

      {/* 今日の食事（実状態 or トレクラ管理） */}
      <MiniCard icon={<MealIcon size={14} />} title="今日の食事" value={mealValue} />

      {/* 今日の学習（実データ） */}
      <Card dim={!learning.latestTitle}>
        <CardHead icon={<BookOpenIcon size={14} />} title="今日の学習" />
        <div className="text-[14px] font-bold pt-0.5 leading-tight">
          {learning.percent != null ? `全体 ${learning.percent}%` : "—"}
          <span className="text-[10.5px] text-zinc-500 font-medium">
            {" "}
            （{learning.completedCount}/{learning.totalCount}）
          </span>
        </div>
        <div className="text-[10.5px] text-zinc-700 mt-1.5 leading-snug">
          {learning.latestTitle
            ? `直近: ${learning.latestTitle}`
            : "まだ学習記録がありません"}
        </div>
        <div className="text-[10px] text-zinc-400 mt-0.5">
          {learning.latestAt ? `${mdLabel(learning.latestAt)} 完了` : ""}
        </div>
      </Card>
    </div>
  );
}

function Card({
  children,
  dim,
}: {
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={`border border-[#e8ebe9] rounded-xl px-3 py-3 ${dim ? "bg-[#fbfcfb]" : "bg-white"}`}
    >
      {children}
    </div>
  );
}

function CardHead({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-[#00897b] flex-shrink-0">{icon}</span>
      <span className="text-[10.5px] font-bold text-zinc-500 tracking-wide">
        {title}
      </span>
    </div>
  );
}

/** 管1: 4カードのミニ表示（非ベータは人語1行・ベータは実状態） */
function MiniCard({
  icon,
  title,
  value,
  sub,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-dashed border-[#e0e4e2] rounded-xl px-3 py-3 bg-[#fbfcfb]">
      <CardHead icon={icon} title={title} />
      <div className="text-[12px] font-bold text-zinc-500 pt-0.5 leading-snug">
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-400 mt-1 leading-snug">{sub}</div>}
    </div>
  );
}

// =====================================================================
// タブ0: 今日（食事/トレ/生活はプレースホルダ）
// =====================================================================

const MEAL_LABEL_ADMIN: Record<string, string> = {
  朝: "朝食",
  昼: "昼食",
  夕: "夕食",
  間: "間食",
};

function mealTime(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

function TodayTab({ detail }: { detail: DailyDetail }) {
  // 件1: 食事写真ライトボックス(タップした食事の全写真を中央拡大・左右送り)
  const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null);
  return (
    <div className="space-y-3">
      {lightboxPhotos && (
        <PhotoLightbox photos={lightboxPhotos} onClose={() => setLightboxPhotos(null)} />
      )}
      <SectionCard title="今日の食事" icon={<MealIcon size={15} />}>
        {!detail.isBeta ? (
          <PlaceholderBody text="この受講生はまだ食事機能の対象外です（ベータ公開後に表示されます）。" />
        ) : detail.meals.length === 0 ? (
          <PlaceholderBody text="今日の食事の記録はまだありません。写真から判断してコメントする場合は、この下のFB欄へ。" />
        ) : (
          <div className="space-y-2">
            {detail.meals.map((m, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-2.5"
              >
                {m.photoUrls[0] ? (
                  // 件1: タップでライトボックス(この食事の全写真)。サムネイルの大きさ・配置は不変。
                  <button
                    type="button"
                    onClick={() => setLightboxPhotos(m.photoUrls)}
                    className="relative h-14 w-14 flex-shrink-0 cursor-zoom-in overflow-hidden rounded"
                    aria-label="写真を拡大"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photoUrls[0]} alt="" className="h-full w-full object-cover" />
                    {m.photoUrls.length > 1 && (
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/55 px-1 text-[9px] font-bold text-white">
                        {m.photoUrls.length}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400">
                    写真なし
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold text-zinc-900">
                      {MEAL_LABEL_ADMIN[m.mealType] ?? m.mealType}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {mealTime(m.postedAt)}
                    </span>
                  </div>
                  {m.items.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-zinc-600">
                      {m.items.join("、")}
                    </div>
                  )}
                  {m.memo && (
                    <div className="mt-0.5 text-[11px] italic text-zinc-400">
                      {m.memo}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title="今日のトレーニング" icon={<DumbbellIcon size={15} />}>
        {!detail.isBeta ? (
          <PlaceholderBody text="この受講生はまだトレ実施記録の対象外です（ベータ公開後に表示されます）。" />
        ) : !detail.workout ? (
          <PlaceholderBody text="今日のトレーニング記録はまだありません。" />
        ) : (
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  detail.workout.status === "skipped"
                    ? "bg-[#fdece0] text-[#b0640f]"
                    : detail.workout.status === "rest_done"
                      ? "bg-[#e8f0fa] text-[#3a6ea5]"
                      : "bg-[#eef5f0] text-[#34603f]"
                }`}
              >
                {detail.workout.status === "skipped"
                  ? "未実施"
                  : detail.workout.status === "rest_done"
                    ? "休養完了"
                    : "完了"}
              </span>
              <span className="font-bold text-zinc-900">{detail.workout.dayLabel}</span>
              <span className="text-[10px] text-zinc-400">
                {detail.workout.intensity}強度
              </span>
            </div>
            {detail.workout.doneNames.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-[#34603f]">やった：</span>
                <span className="text-zinc-700">{detail.workout.doneNames.join("、")}</span>
              </div>
            )}
            {detail.workout.notDoneNames.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-[#b0640f]">やらなかった：</span>
                <span className="text-zinc-400 line-through">
                  {detail.workout.notDoneNames.join("、")}
                </span>
              </div>
            )}
            {detail.workout.addedNames.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-[#4a875b]">＋追加：</span>
                <span className="text-zinc-700">{detail.workout.addedNames.join("、")}</span>
              </div>
            )}
            {detail.workout.memo && (
              <div className="rounded bg-[#faf7f0] px-2 py-1 text-[11px] italic text-zinc-500">
                {detail.workout.memo}
              </div>
            )}
          </div>
        )}
      </SectionCard>
      <SectionCard title="今日の生活" icon={<MoonIcon size={15} />}>
        {!detail.isBeta ? (
          <PlaceholderBody text="この受講生はまだ生活記録の対象外です（ベータ公開後に表示されます）。" />
        ) : !detail.condition ||
          (detail.condition.sleepHours == null &&
            !detail.condition.condition &&
            !detail.condition.bowel &&
            !detail.condition.alcohol) ? (
          <PlaceholderBody text="今日の生活記録はまだありません（未入力またはスキップ）。" />
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-800">
            {detail.condition.sleepHours != null && (
              <span>
                睡眠 <b>{detail.condition.sleepHours}h</b>
              </span>
            )}
            {detail.condition.condition && (
              <span>
                体調 <b>{CONDITION_LABEL[detail.condition.condition]}</b>
              </span>
            )}
            {detail.condition.bowel && (
              <span>
                お通じ <b>{BOWEL_LABEL[detail.condition.bowel]}</b>
              </span>
            )}
            {detail.condition.alcohol && (
              <span>
                お酒 <b>{ALCOHOL_LABEL[detail.condition.alcohol]}</b>
              </span>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PlaceholderBody({ text }: { text: string }) {
  return (
    <div className="text-[11.5px] text-zinc-400 leading-relaxed">{text}</div>
  );
}

// =====================================================================
// タブ1: 計画・カルテ（実データ）
// =====================================================================

function PlanTab({ detail }: { detail: DailyDetail }) {
  const c = detail.carte;
  return (
    <div className="space-y-3">
      <SectionCard title="カルテ" icon={<DocIcon size={15} />}>
        {c ? (
          <div className="grid grid-cols-2 gap-x-[18px] gap-y-2">
            <CarteRow label="環境" value={c.environments} />
            <CarteRow label="重点部位" value={c.focusBodyParts} />
            <CarteRow label="頻度希望" value={c.frequencyWish} />
            <CarteRow label="目的" value={c.purposes} />
            <CarteRow label="経験" value={c.experience} />
            <CarteRow label="なりたい体" value={c.idealBody} />
            <CarteRow label="気をつける点" value={c.medicalLimits} attn />
          </div>
        ) : (
          <PlaceholderBody text="カルテ未提出です。" />
        )}
      </SectionCard>
      <SectionCard title="筋トレ原本 / 1週間メニュー" icon={<DumbbellIcon size={15} />}>
        <div className="text-[11.5px] text-zinc-500 leading-relaxed">
          原本メニュー・1週間メニューは
          <Link
            href={`/admin/users/${detail.userId}/menu/new?from_current=1`}
            className="font-bold text-[#00695c] underline mx-1"
          >
            配布画面
          </Link>
          から確認・変更できます。
        </div>
      </SectionCard>
    </div>
  );
}

function CarteRow({
  label,
  value,
  attn,
}: {
  label: string;
  value: string | null;
  attn?: boolean;
}) {
  return (
    <div className="flex gap-2 text-[11.5px] py-1 border-b border-dashed border-[#f4f6f5]">
      <span className="w-[86px] flex-shrink-0 text-[10px] text-zinc-500 font-bold pt-0.5">
        {label}
      </span>
      <span
        className={`leading-snug ${attn ? "text-[#b45309] font-semibold" : "text-zinc-700"}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// =====================================================================
// タブ2: 学び（実データ）
// =====================================================================

function LearnTab({ detail }: { detail: DailyDetail }) {
  const l = detail.learning;
  return (
    <div className="space-y-3">
      <SectionCard title="直近の学習" icon={<BookOpenIcon size={15} />}>
        {l.latestTitle ? (
          <>
            <div className="text-[12px] font-bold">
              直近完了: {l.latestTitle}
              {l.latestAt && (
                <span className="text-zinc-400 font-normal">
                  {" "}
                  （{mdLabel(l.latestAt)}）
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-zinc-500 mt-2">
              全体進捗 {l.percent}%（{l.completedCount}/{l.totalCount}）
            </div>
          </>
        ) : (
          <PlaceholderBody text="まだ学習記録がありません。" />
        )}
      </SectionCard>
      <SectionCard title="実践宣言と行動のつながり" icon={<TrendingUpIcon size={15} />}>
        <PlaceholderBody text="実践宣言と食事・トレのつながりは、今後ここに表示されます。" />
      </SectionCard>
    </div>
  );
}

// =====================================================================
// タブ3: これまでの言葉（実データ）
// =====================================================================

function WordsTab({ detail }: { detail: DailyDetail }) {
  const { recentWords, goal } = detail;
  return (
    <div className="space-y-3">
      <SectionCard title="のりが伝えてきたこと（直近）" icon={<ChatIcon size={15} />}>
        {recentWords.length > 0 ? (
          <div>
            {recentWords.map((w, i) => (
              <div
                key={i}
                className="flex gap-2.5 py-2.5 border-b border-dashed border-[#f1f3f2] last:border-none"
              >
                <span className="w-16 flex-shrink-0 text-[10px] text-zinc-500 font-mono pt-0.5">
                  {mdLabel(w.date)}
                </span>
                <span className="text-[12px] text-zinc-700 leading-relaxed flex-1">
                  <span
                    className="text-[9px] font-bold rounded px-1.5 py-px mr-1.5"
                    style={{ background: "#e0f2f1", color: TEAL_DARK }}
                  >
                    日次
                  </span>
                  {w.body}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <PlaceholderBody text="まだ日次フィードバックの履歴がありません。最初のFBを下のバーから送りましょう。" />
        )}
      </SectionCard>

      <SectionCard title="目標シートの言葉" icon={<TargetIcon size={15} />}>
        {goal.shortTerm || goal.longTerm || goal.selfImage || goal.adminNotes ? (
          <div className="space-y-2.5">
            {goal.longTerm && <WordLine tag="長期目標" text={goal.longTerm} />}
            {goal.shortTerm && <WordLine tag="短期目標" text={goal.shortTerm} />}
            {goal.process && <WordLine tag="プロセス" text={goal.process} />}
            {goal.selfImage && (
              <WordLine tag="なりたい姿" text={goal.selfImage} />
            )}
            {goal.adminNotes && (
              <WordLine tag="のりメモ" text={goal.adminNotes} accent />
            )}
            <Link
              href={`/admin/users/${detail.userId}/goal-sheet`}
              className="inline-block text-[10px] font-bold text-[#00695c] underline mt-1"
            >
              目標シート原文を開く →
            </Link>
          </div>
        ) : (
          <PlaceholderBody text="目標シートはまだ作成されていません。" />
        )}
      </SectionCard>
    </div>
  );
}

function WordLine({
  tag,
  text,
  accent,
}: {
  tag: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        className={`text-[9px] font-bold rounded px-1.5 py-px h-fit mt-0.5 flex-shrink-0 ${
          accent
            ? "bg-[#fffbeb] text-[#92700c] border border-[#f5e6a8]"
            : "bg-[#eef2ff] text-[#4338ca]"
        }`}
      >
        {tag}
      </span>
      <span className="text-[12px] text-zinc-700 leading-relaxed">{text}</span>
    </div>
  );
}

// =====================================================================
// 共通: セクションカード
// =====================================================================

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e8ebe9] rounded-[11px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#f1f3f2] text-[12.5px] font-bold bg-[#fafbfa]">
        {icon && <span className="text-[#00897b] flex-shrink-0">{icon}</span>}
        {title}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </div>
  );
}

// =====================================================================
// 状態ストリップ（件4・M22案1）: FB記入時に「からだの状態」を1行で
//   数値は DailyDetail の既存fetchのみ。符号は付けず「増/減」の語(ルール3)。
//   7日/30日=実測差・目標まで=距離。今日の記録ピル=食事/トレ/生活/体組成。
// =====================================================================
function StateStrip({ detail, date }: { detail: DailyDetail; date: string }) {
  const b = detail.body;

  // 差分1つ分（例: 「7日で 0.7kg増」）。null は「7日 —」。0は「変わらず」。
  const Delta = ({ label, v }: { label: string; v: number | null }) => {
    if (v == null)
      return (
        <span className="text-zinc-400">
          {label} —
        </span>
      );
    if (v === 0)
      return (
        <span>
          {label}で <span className="font-bold text-zinc-500">変わらず</span>
        </span>
      );
    const up = v > 0; // 増=コーラル / 減=緑
    return (
      <span>
        {label}で{" "}
        <span className={`font-bold ${up ? "text-[#c2693f]" : "text-[#34603f]"}`}>
          {Math.abs(v)}kg{up ? "増" : "減"}
        </span>
      </span>
    );
  };

  // 今日の記録ピル（記録あり=緑・✓ / 記録なし=グレー）。体組成は当日の記録日付一致で判定。
  const pills: { label: string; on: boolean }[] = [
    { label: "食事", on: detail.meals.length > 0 },
    { label: "トレ", on: detail.workout != null },
    { label: "生活", on: detail.condition != null },
    { label: "体組成", on: b.recordedAt === date },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg border border-[#e8ede4] bg-[#f6f8f4] px-3 py-1.5 text-[12px] text-zinc-600">
      {b.weightKg != null ? (
        <b className="text-[14px] text-zinc-900">{b.weightKg}kg</b>
      ) : (
        <span className="text-[13px] font-semibold text-zinc-400">記録なし</span>
      )}
      <Delta label="7日" v={b.weightDelta7d} />
      <Delta label="30日" v={b.weightDelta30d} />
      {b.remainingKg != null && (
        <span className="font-bold text-[#8a6d10]">目標まで {b.remainingKg}kg</span>
      )}
      <span className="ml-auto flex flex-wrap items-center gap-1">
        {pills.map((p) => (
          <span
            key={p.label}
            className={
              p.on
                ? "rounded-full bg-[#eaf3ec] px-2 py-0.5 text-[10.5px] font-extrabold text-[#34603f]"
                : "rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[10.5px] font-bold text-[#c9c9ce]"
            }
          >
            {p.on ? "✓" : ""}
            {p.label}
          </span>
        ))}
      </span>
    </div>
  );
}

// =====================================================================
// FBバー（下部固定・sticky）
// =====================================================================

function FbBar({
  detail,
  date,
  remaining,
  nextUserId,
}: {
  detail: DailyDetail;
  date: string;
  remaining: number;
  nextUserId: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState(detail.todayFeedback?.body ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const alreadySent = detail.todayFeedback?.status === "sent";

  const advance = () => {
    if (nextUserId) {
      router.push(`/admin/daily?user=${nextUserId}&date=${date}`);
    } else {
      router.refresh();
    }
  };

  const send = () =>
    startTransition(async () => {
      setError(null);
      const r = await sendDailyFeedback({ userId: detail.userId, date, body });
      if (!r.ok) return setError(r.message);
      advance();
    });

  const skip = () =>
    startTransition(async () => {
      setError(null);
      const r = await skipDailyFeedback({ userId: detail.userId, date });
      if (!r.ok) return setError(r.message);
      advance();
    });

  return (
    <div className="sticky bottom-0 bg-white border-t border-[#e8ebe9] shadow-[0_-8px_24px_rgba(0,0,0,0.06)] px-6 py-3 flex gap-3.5 items-stretch z-40">
      <div className="w-[240px] flex-shrink-0 bg-[#f8faf9] border border-[#e8ebe9] rounded-[9px] px-3 py-2 text-[11px] text-zinc-600 leading-relaxed overflow-y-auto max-h-[92px]">
        <b className="text-[9.5px] text-zinc-500 block mb-0.5">
          前回のフィードバック
          {detail.prevFeedback && `（${mdLabel(detail.prevFeedback.date)}）`}
        </b>
        {detail.prevFeedback ? detail.prevFeedback.body : "まだありません"}
      </div>

      <div className="flex-1 flex flex-col gap-1">
        {/* 件4(2026-07-13): 状態ストリップ(M22案1)。からだの状態を入力欄の真上に1行で。
            数値は既存fetchのみ・符号なし(増/減の語)・目標までは距離。 */}
        <StateStrip detail={detail} date={date} />
        {/* 件3(2026-07-13): 題材ガード枠は撤去（食事・トレ・生活すべて実データが揃い、
            話題を限定する必要がなくなったため。beta/非beta とも完全撤去）。 */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="今日のひとことを書く…"
          className="w-full min-h-[84px] max-h-[140px] border border-[#e8ebe9] rounded-[9px] px-3 py-2 text-[12.5px] leading-relaxed resize-none focus:outline focus:outline-2 focus:outline-[#00897b]/35 focus:border-[#00897b]"
        />
        {error && <div className="text-[11px] text-red-600">⚠ {error}</div>}
      </div>

      <div className="flex flex-col justify-between items-end gap-2 flex-shrink-0">
        <span className="text-[10.5px] text-zinc-500 font-semibold whitespace-nowrap">
          {alreadySent ? "送信済み（上書き可）" : `残り ${remaining} 人`}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={skip}
            disabled={pending}
            className="text-[12px] font-semibold text-zinc-500 bg-white border border-[#e8ebe9] rounded-lg px-3.5 py-2 disabled:opacity-50"
          >
            スキップ
          </button>
          <button
            type="button"
            onClick={send}
            disabled={pending || !body.trim()}
            className="text-[12px] font-bold text-white rounded-lg px-3.5 py-2 disabled:opacity-50"
            style={{ background: TEAL }}
          >
            {pending ? "送信中…" : "➤ 送信して次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}
