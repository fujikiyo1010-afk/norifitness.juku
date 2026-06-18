"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExamFull, ExamAttemptSummary } from "@/lib/exams/queries";
import { submitExamAttempt } from "@/lib/exams/actions";

/**
 * 試験 受講生 UI (intro / question / result の 3 状態)
 *
 * 状態遷移:
 *   intro → 「開始する」 → question (1/N)
 *   question (N/N) → 「採点する」 → submitExamAttempt → result
 *   result → 「もう一度受ける」 → intro / 「章に戻る」 → /courses/[id]
 *
 * 採点は server-side。 クライアントは選択した choice_id を送るだけ。
 */
export function ExamView({
  exam,
  latestAttempt,
  courseId,
  chapterId,
}: {
  exam: ExamFull;
  latestAttempt: ExamAttemptSummary | null;
  courseId: string;
  chapterId: string;
}) {
  const [phase, setPhase] = useState<"intro" | "questions" | "results">("intro");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resultScore, setResultScore] = useState<{
    scorePercent: number;
    passed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = exam.questions.length;
  const currentQuestion = exam.questions[currentIdx];
  const currentAnswer = answers[currentQuestion?.id ?? ""] ?? null;

  function start() {
    setPhase("questions");
    setCurrentIdx(0);
    setAnswers({});
    setResultScore(null);
    setError(null);
  }

  function selectAnswer(choiceId: string) {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: choiceId }));
  }

  function goNext() {
    if (currentIdx + 1 < total) {
      setCurrentIdx(currentIdx + 1);
    }
  }

  function goPrev() {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }

  function submitAll() {
    if (pending) return;
    setError(null);
    const payload = exam.questions.map((q) => ({
      question_id: q.id,
      selected_choice_id: answers[q.id] ?? null,
    }));
    startTransition(async () => {
      const res = await submitExamAttempt(exam.id, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResultScore({ scorePercent: res.scorePercent, passed: res.passed });
      setPhase("results");
    });
  }

  // ===================================================================
  // INTRO 画面
  // ===================================================================
  if (phase === "intro") {
    return (
      <div className="px-4 pt-6 pb-8 space-y-5">
        <div className="bg-[#e0f2f1] border border-[#b2dfdb] rounded-2xl px-5 py-4">
          <div className="text-[10px] font-bold text-[#34603f] tracking-widest mb-1.5">
            テスト
          </div>
          <h1 className="text-[18px] font-bold text-[#2b2620] leading-tight">
            {exam.name}
          </h1>
        </div>

        <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-5 py-4 space-y-2">
          <Row label="問題数" value={`${total} 問`} />
          <Row label="合格ライン" value={`${exam.passing_score} %`} />
          <Row label="制限時間" value="なし" />
        </div>

        {latestAttempt ? (
          <div
            className={`border rounded-2xl px-5 py-4 ${
              latestAttempt.passed
                ? "bg-[#e8f5e9] border-[#a5d6a7]"
                : "bg-[#fff8e1] border-[#ffe082]"
            }`}
          >
            <div className="text-[10px] font-bold tracking-widest mb-1">
              前回の結果
            </div>
            <div className="text-[14px] font-bold text-[#2b2620]">
              {latestAttempt.passed ? "✓ 合格" : "△ 不合格"} ・ {latestAttempt.score_percent} 点
            </div>
            <div className="text-[10px] text-[#6a6256] font-mono mt-1">
              {new Date(latestAttempt.finished_at).toLocaleString("ja-JP")}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={start}
          className="w-full bg-[#4a875b] text-white rounded-2xl px-4 py-3.5 text-[14px] font-bold hover:bg-[#34603f] transition-colors"
        >
          {latestAttempt ? "もう一度 受ける" : "開始する"}
        </button>

        <Link
          href={`/courses/${courseId}`}
          className="block text-center text-[12px] text-[#6a6256] hover:underline"
        >
          ← 章に戻る
        </Link>
      </div>
    );
  }

  // ===================================================================
  // QUESTIONS 画面 (1/N 進捗 + 問題 + 選択肢)
  // ===================================================================
  if (phase === "questions" && currentQuestion) {
    const isLast = currentIdx + 1 === total;
    const answeredCount = Object.keys(answers).length;
    const canSubmit = answeredCount === total;

    return (
      <div className="px-4 pt-5 pb-8 space-y-5">
        {/* 進捗バー */}
        <div>
          <div className="flex justify-between items-baseline text-[11px] text-[#6a6256] mb-1.5">
            <span className="font-mono">
              問題 {currentIdx + 1} / {total}
            </span>
            <span className="text-[10px]">回答済 {answeredCount} / {total}</span>
          </div>
          <div className="h-[5px] rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-[#4a875b] rounded-full transition-[width] duration-300"
              style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* 問題文 */}
        <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-5 py-4">
          <p className="text-[14px] text-[#2b2620] leading-[1.7] whitespace-pre-wrap">
            {currentQuestion.question_text}
          </p>
        </div>

        {/* 選択肢 */}
        <div className="space-y-2.5">
          {currentQuestion.choices.map((c, idx) => {
            const selected = currentAnswer === c.id;
            const labelLetter = String.fromCharCode("A".charCodeAt(0) + idx);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => selectAnswer(c.id)}
                className={`w-full text-left flex items-center gap-3 rounded-2xl px-4 py-3 border transition-colors ${
                  selected
                    ? "bg-[#e0f2f1] border-[#4a875b]"
                    : "bg-[#fffdf8] border-[#e7dcc9] hover:bg-[#f9f5ed]"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
                    selected
                      ? "bg-[#4a875b] text-white"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {labelLetter}
                </span>
                <span className="text-[13px] text-[#2b2620] leading-[1.6]">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}

        {/* ナビゲーション */}
        <div className="flex gap-2 pt-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIdx === 0 || pending}
            className="flex-1 bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3 text-[13px] font-bold text-zinc-700 hover:bg-[#f9f5ed] transition-colors disabled:opacity-40"
          >
            ← 前へ
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={submitAll}
              disabled={!canSubmit || pending}
              className="flex-1 bg-[#4a875b] text-white rounded-2xl px-4 py-3 text-[13px] font-bold hover:bg-[#34603f] transition-colors disabled:opacity-50"
            >
              {pending ? "採点中..." : "採点する"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!currentAnswer || pending}
              className="flex-1 bg-[#4a875b] text-white rounded-2xl px-4 py-3 text-[13px] font-bold hover:bg-[#34603f] transition-colors disabled:opacity-50"
            >
              次へ →
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-[#a59b8c] font-mono">
          全 {total} 問 ・ 全問回答後に採点
        </p>
      </div>
    );
  }

  // ===================================================================
  // RESULTS 画面
  // ===================================================================
  if (phase === "results" && resultScore) {
    return (
      <ResultsView
        exam={exam}
        answers={answers}
        scorePercent={resultScore.scorePercent}
        passed={resultScore.passed}
        courseId={courseId}
        chapterId={chapterId}
        onRetry={start}
      />
    );
  }

  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#6a6256]">{label}</span>
      <span className="text-[14px] font-bold text-[#2b2620] font-mono">
        {value}
      </span>
    </div>
  );
}

// =====================================================================
// 結果画面 (スコア + 合否 + 全問正誤 + 解説)
// =====================================================================

function ResultsView({
  exam,
  answers,
  scorePercent,
  passed,
  courseId,
  onRetry,
}: {
  exam: ExamFull;
  answers: Record<string, string>;
  scorePercent: number;
  passed: boolean;
  courseId: string;
  chapterId: string;
  onRetry: () => void;
}) {
  const router = useRouter();

  // 正誤判定 (correct_choice_id がクライアントに来ているので Light 計算)
  const detailed = useMemo(() => {
    return exam.questions.map((q) => {
      const selected = answers[q.id] ?? null;
      const correct = q.correct_choice_id;
      return {
        question: q,
        selectedChoiceId: selected,
        isCorrect: selected !== null && selected === correct,
      };
    });
  }, [exam.questions, answers]);

  return (
    <div className="px-4 pt-5 pb-8 space-y-5">
      {/* スコアカード */}
      <div
        className={`border rounded-2xl px-5 py-6 text-center ${
          passed
            ? "bg-[#e8f5e9] border-[#a5d6a7]"
            : "bg-[#fff8e1] border-[#ffe082]"
        }`}
      >
        <div className="text-[10px] font-bold tracking-widest mb-1.5">
          {passed ? "✓ 合格" : "△ 不合格"}
        </div>
        <div className="text-[36px] font-bold text-[#2b2620] font-mono leading-none mb-1">
          {scorePercent}
        </div>
        <div className="text-[10px] text-[#6a6256] font-mono">/ 100 点</div>
        <div className="text-[11px] text-zinc-600 mt-2">
          合格ライン {exam.passing_score} 点
        </div>
      </div>

      {/* 振り返り */}
      <div>
        <h2 className="text-[13px] font-bold text-[#2b2620] mb-2.5">
          振り返り
        </h2>
        <div className="space-y-3">
          {detailed.map((d, idx) => (
            <div
              key={d.question.id}
              className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3.5"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    d.isCorrect
                      ? "bg-[#4a875b] text-white"
                      : "bg-rose-500 text-white"
                  }`}
                >
                  {d.isCorrect ? "✓" : "×"}
                </span>
                <span className="text-[11px] font-bold text-[#6a6256] font-mono">
                  問題 {idx + 1}
                </span>
              </div>
              <p className="text-[13px] text-[#2b2620] leading-[1.6] mb-2 whitespace-pre-wrap">
                {d.question.question_text}
              </p>
              <ChoicesReview
                question={d.question}
                selectedChoiceId={d.selectedChoiceId}
              />
              {d.question.explanation ? (
                <div className="mt-2.5 bg-[#f8f9fa] border-l-2 border-[#4a875b] px-3 py-2 rounded-r">
                  <div className="text-[10px] font-bold text-[#34603f] tracking-widest mb-0.5">
                    解説
                  </div>
                  <p className="text-[12px] text-zinc-700 leading-[1.7] whitespace-pre-wrap">
                    {d.question.explanation}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-2 pt-3">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3 text-[13px] font-bold text-zinc-700 hover:bg-[#f9f5ed] transition-colors"
        >
          もう一度 受ける
        </button>
        <button
          type="button"
          onClick={() => router.push(`/courses/${courseId}`)}
          className="flex-1 bg-[#4a875b] text-white rounded-2xl px-4 py-3 text-[13px] font-bold hover:bg-[#34603f] transition-colors"
        >
          章に戻る
        </button>
      </div>
    </div>
  );
}

function ChoicesReview({
  question,
  selectedChoiceId,
}: {
  question: ExamFull["questions"][number];
  selectedChoiceId: string | null;
}) {
  return (
    <ul className="space-y-1.5">
      {question.choices.map((c, idx) => {
        const letter = String.fromCharCode("A".charCodeAt(0) + idx);
        const isSelected = selectedChoiceId === c.id;
        const isCorrect = question.correct_choice_id === c.id;
        let bg = "bg-[#fffdf8] border-zinc-200";
        if (isCorrect) bg = "bg-[#e0f2f1] border-[#4a875b]";
        else if (isSelected) bg = "bg-rose-50 border-rose-300";

        return (
          <li
            key={c.id}
            className={`flex items-start gap-2 rounded-xl px-3 py-2 border ${bg}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                isCorrect
                  ? "bg-[#4a875b] text-white"
                  : isSelected
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-100 text-[#6a6256]"
              }`}
            >
              {letter}
            </span>
            <span className="text-[12px] text-zinc-700 leading-[1.5] flex-1">
              {c.label}
            </span>
            {isCorrect ? (
              <span className="text-[10px] font-bold text-[#4a875b] flex-shrink-0">
                正解
              </span>
            ) : isSelected ? (
              <span className="text-[10px] font-bold text-rose-600 flex-shrink-0">
                あなた
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
