"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 試験提出 (server-side 採点) (2026-06-17 線① 試験機能 新設)
 *
 * クライアントから { questionId: selectedChoiceId } を受け取り、
 * server 側で answer と照合 → score 計算 → exam_attempts insert。
 *
 * 採点を server で行うことで、 クライアント側で answer を書き換えても無意味になる。
 */

export type SubmitResult =
  | { ok: true; attemptId: string; scorePercent: number; passed: boolean }
  | { ok: false; error: string };

export async function submitExamAttempt(
  examId: string,
  answers: { question_id: string; selected_choice_id: string | null }[]
): Promise<SubmitResult> {
  if (!examId) return { ok: false, error: "examId が指定されていません" };
  if (!Array.isArray(answers))
    return { ok: false, error: "answers が配列ではありません" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  // exam + 正解 fetch
  const { data: exam } = await supabase
    .from("exams")
    .select("id, lesson_id, passing_score, total_questions")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return { ok: false, error: "試験が見つかりません" };

  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id, correct_choice_id")
    .eq("exam_id", examId);
  if (!questions || questions.length === 0)
    return { ok: false, error: "問題が見つかりません" };

  // 採点
  const correctMap = new Map(questions.map((q) => [q.id, q.correct_choice_id]));
  const enrichedAnswers = answers.map((a) => ({
    question_id: a.question_id,
    selected_choice_id: a.selected_choice_id,
    is_correct: correctMap.get(a.question_id) === a.selected_choice_id,
  }));
  const correctCount = enrichedAnswers.filter((a) => a.is_correct).length;
  const scorePercent = Math.round((correctCount / questions.length) * 100);
  const passed = scorePercent >= exam.passing_score;

  // insert
  const { data: attempt, error: insErr } = await supabase
    .from("exam_attempts")
    .insert({
      user_id: user.id,
      exam_id: examId,
      score_percent: scorePercent,
      passed,
      answers: enrichedAnswers,
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/");
  // 章詳細ページ再検証 (lesson_id 経由で章を引いてキャッシュ更新)
  revalidatePath("/courses");

  return {
    ok: true,
    attemptId: attempt.id,
    scorePercent,
    passed,
  };
}
