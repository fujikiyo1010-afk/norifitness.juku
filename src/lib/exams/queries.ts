import { createClient } from "@/lib/supabase/server";

/**
 * 試験 (exams) 関連クエリ (2026-06-17 線① 試験機能 新設)
 *
 * Saipon /site_api/exam? から ETL した試験データ。
 * exam は lesson_id 経由で chapter に紐付く (= 章ごとに最大 1 試験)。
 */

export type ExamChoice = {
  id: string;
  label: string;
  sort_order: number;
};

export type ExamQuestion = {
  id: string;
  question_text: string;
  explanation: string | null;
  correct_choice_id: string | null;
  sort_order: number;
  choices: ExamChoice[];
};

export type ExamFull = {
  id: string;
  lesson_id: string;
  name: string;
  passing_score: number;
  total_questions: number;
  questions: ExamQuestion[];
};

export type ExamAttemptSummary = {
  id: string;
  score_percent: number;
  passed: boolean;
  finished_at: string;
};

/**
 * 章 ID から、 その章のいずれかの lesson に紐付く試験を 1 つ取得。
 * 章には最大 1 試験 (unique constraint on exams.lesson_id + chapter には 1 lesson 1 exam ルール)。
 */
export async function getExamForChapter(chapterId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("chapter_id", chapterId);
  if (!lessons || lessons.length === 0) return null;

  const lessonIds = lessons.map((l) => l.id);
  const { data: exam } = await supabase
    .from("exams")
    .select("id, name")
    .in("lesson_id", lessonIds)
    .maybeSingle();
  return exam ?? null;
}

/**
 * 受講生 UI の章リスト用 ・ 章 ID 配列から「章 ID → 試験 (id + name) または null」 を一括取得。
 * N+1 を避けるため lessons → exams を 1 クエリずつでまとめる。
 */
export async function getExamsByChapterIds(
  chapterIds: string[]
): Promise<Map<string, { id: string; name: string }>> {
  const result = new Map<string, { id: string; name: string }>();
  if (chapterIds.length === 0) return result;

  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, chapter_id")
    .in("chapter_id", chapterIds);
  if (!lessons || lessons.length === 0) return result;

  const lessonIds = lessons.map((l) => l.id);
  const { data: exams } = await supabase
    .from("exams")
    .select("id, name, lesson_id")
    .in("lesson_id", lessonIds);
  if (!exams) return result;

  const lessonToChapter = new Map(lessons.map((l) => [l.id, l.chapter_id]));
  for (const e of exams) {
    const cid = lessonToChapter.get(e.lesson_id);
    if (cid) result.set(cid, { id: e.id, name: e.name });
  }
  return result;
}

/**
 * 試験本体 + 全問題 + 全選択肢 を取得 (受験開始時に 1 回読み込み)。
 */
export async function getExamFull(examId: string): Promise<ExamFull | null> {
  const supabase = await createClient();
  const { data: exam } = await supabase
    .from("exams")
    .select("id, lesson_id, name, passing_score, total_questions")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return null;

  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id, question_text, explanation, correct_choice_id, sort_order")
    .eq("exam_id", examId)
    .order("sort_order");

  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: choices } = await supabase
    .from("exam_choices")
    .select("id, question_id, label, sort_order")
    .in("question_id", questionIds.length > 0 ? questionIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order");

  const choicesByQuestion = new Map<string, ExamChoice[]>();
  for (const c of choices ?? []) {
    if (!choicesByQuestion.has(c.question_id))
      choicesByQuestion.set(c.question_id, []);
    choicesByQuestion.get(c.question_id)!.push({
      id: c.id,
      label: c.label,
      sort_order: c.sort_order,
    });
  }

  return {
    id: exam.id,
    lesson_id: exam.lesson_id,
    name: exam.name,
    passing_score: exam.passing_score,
    total_questions: exam.total_questions,
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      question_text: q.question_text,
      explanation: q.explanation,
      correct_choice_id: q.correct_choice_id,
      sort_order: q.sort_order,
      choices: choicesByQuestion.get(q.id) ?? [],
    })),
  };
}

/**
 * 受講生本人の最新受験記録を取得 (1 件)。
 */
export async function getMyLatestAttempt(
  examId: string
): Promise<ExamAttemptSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("exam_attempts")
    .select("id, score_percent, passed, finished_at")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return row ?? null;
}

/**
 * 章リスト用 ・ 章 ID 配列から「章 ID → 自分の最新合格状態」 一括取得。
 * 合格していれば ✓、 受験済 (不合格) ▶、 未受験 ○ のアイコン分けに使う。
 */
export async function getMyExamPassesByChapterIds(
  chapterIds: string[]
): Promise<Map<string, { passed: boolean; finished_at: string }>> {
  const result = new Map<string, { passed: boolean; finished_at: string }>();
  if (chapterIds.length === 0) return result;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return result;

  // chapter → exam id 取得
  const examsMap = await getExamsByChapterIds(chapterIds);
  if (examsMap.size === 0) return result;

  const examIds = [...examsMap.values()].map((e) => e.id);
  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("exam_id, passed, finished_at")
    .eq("user_id", user.id)
    .in("exam_id", examIds)
    .order("finished_at", { ascending: false });

  if (!attempts) return result;

  // exam_id ごとに最新 attempt を取り、 chapter_id にマップし直す
  const latestByExam = new Map<string, { passed: boolean; finished_at: string }>();
  for (const a of attempts) {
    if (!latestByExam.has(a.exam_id)) {
      latestByExam.set(a.exam_id, { passed: a.passed, finished_at: a.finished_at });
    }
  }
  for (const [chapterId, exam] of examsMap.entries()) {
    const latest = latestByExam.get(exam.id);
    if (latest) result.set(chapterId, latest);
  }
  return result;
}
