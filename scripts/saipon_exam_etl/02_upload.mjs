/**
 * /tmp/saipon_exam_dump/*.json を読んで Supabase に投入する。
 *
 * 流れ:
 *   1. /tmp/.env.prod から URL + service_role 取得
 *   2. lessons 全件 SELECT (title → lesson_id マップ作成)
 *   3. 各 exam JSON について
 *      a. lessons.title == exam.name の lesson_id 検索 (見つからなければ skip + 警告)
 *      b. exams テーブルに upsert (lesson_id unique 制約あり)
 *      c. exam_questions 一括 insert (各問題 ・ correct_choice_id は後で埋める)
 *      d. exam_choices 一括 insert (各選択肢)
 *      e. exam_questions.correct_choice_id を choices の saipon_choice_id == question.answer で埋める
 *   4. サマリ表示
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envText = fs.readFileSync("/tmp/.env.prod", "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^=#]+?)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DUMP_DIR = "/tmp/saipon_exam_dump";

// ------------------------------------------------------------------
// 1. lessons 全件取得 (title → id マップ)
// ------------------------------------------------------------------
console.log("[1/4] lessons 取得");
const { data: lessons, error: lessonsErr } = await supabase
  .from("lessons")
  .select("id, title");
if (lessonsErr) {
  console.error("lessons SELECT エラー:", lessonsErr.message);
  process.exit(1);
}
console.log(`  → ${lessons.length} lessons`);

const titleToLessonId = new Map();
for (const l of lessons) {
  titleToLessonId.set(l.title.trim(), l.id);
}

// ------------------------------------------------------------------
// 2. exam JSON ファイル一覧
// ------------------------------------------------------------------
console.log("\n[2/4] exam JSON 読み込み");
const examFiles = fs
  .readdirSync(DUMP_DIR)
  .filter((f) => f.startsWith("exam_") && f.endsWith(".json"))
  .sort();
console.log(`  → ${examFiles.length} 試験ファイル`);

// ------------------------------------------------------------------
// 3. 各 exam を投入
// ------------------------------------------------------------------
console.log("\n[3/4] 投入");
const results = { ok: 0, skip: 0, error: 0 };
const skipped = [];

for (const f of examFiles) {
  const raw = JSON.parse(fs.readFileSync(path.join(DUMP_DIR, f), "utf-8"));
  const qid = raw.question_box_id;
  const name = (raw.name || "").trim();
  const lessonId = titleToLessonId.get(name);

  if (!lessonId) {
    results.skip += 1;
    skipped.push({ qid, name });
    console.log(`  [skip] qid=${qid}  ${name}  (一致 lesson なし)`);
    continue;
  }

  const questions = raw.list || [];

  // 3-a. exams upsert (lesson_id 一意 ・ Saipon ID も保持)
  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .upsert(
      {
        lesson_id: lessonId,
        saipon_question_box_id: qid,
        name,
        passing_score: raw.passing_score ?? 80,
        total_questions: questions.length,
      },
      { onConflict: "lesson_id" }
    )
    .select("id")
    .single();
  if (examErr) {
    results.error += 1;
    console.log(`  [error] qid=${qid}  exams upsert: ${examErr.message}`);
    continue;
  }
  const examId = examRow.id;

  // 既存 questions/choices 削除 (再 ETL 対応)
  await supabase.from("exam_questions").delete().eq("exam_id", examId);

  // 3-b. exam_questions 一括 insert
  const questionsInsert = questions.map((q, idx) => ({
    exam_id: examId,
    saipon_question_id: q.id,
    question_text: q.question,
    explanation: q.explanation ?? null,
    sort_order: idx,
  }));
  const { data: insertedQuestions, error: qErr } = await supabase
    .from("exam_questions")
    .insert(questionsInsert)
    .select("id, saipon_question_id");
  if (qErr) {
    results.error += 1;
    console.log(`  [error] qid=${qid}  questions insert: ${qErr.message}`);
    continue;
  }

  // 3-c. exam_choices 一括 insert + correct_choice_id 算出データを作る
  const choicesInsert = [];
  const correctChoiceMap = new Map(); // question_id -> saipon_correct_choice_id
  for (const q of questions) {
    const dbQuestion = insertedQuestions.find(
      (x) => x.saipon_question_id === q.id
    );
    if (!dbQuestion) continue;
    correctChoiceMap.set(dbQuestion.id, q.answer);
    (q.choices || []).forEach((c, idx) => {
      choicesInsert.push({
        question_id: dbQuestion.id,
        saipon_choice_id: c.id,
        label: c.label,
        sort_order: idx,
      });
    });
  }
  const { data: insertedChoices, error: cErr } = await supabase
    .from("exam_choices")
    .insert(choicesInsert)
    .select("id, question_id, saipon_choice_id");
  if (cErr) {
    results.error += 1;
    console.log(`  [error] qid=${qid}  choices insert: ${cErr.message}`);
    continue;
  }

  // 3-d. correct_choice_id を埋める (question 単位で update)
  let correctOkCount = 0;
  for (const [questionDbId, saipoCorrectId] of correctChoiceMap.entries()) {
    const correctChoice = insertedChoices.find(
      (c) => c.question_id === questionDbId && c.saipon_choice_id === saipoCorrectId
    );
    if (!correctChoice) continue;
    const { error: updErr } = await supabase
      .from("exam_questions")
      .update({ correct_choice_id: correctChoice.id })
      .eq("id", questionDbId);
    if (!updErr) correctOkCount += 1;
  }

  results.ok += 1;
  console.log(
    `  [ok] qid=${qid}  ${name}  Q=${questions.length}  Cset=${correctOkCount}`
  );
}

// ------------------------------------------------------------------
// 4. サマリ
// ------------------------------------------------------------------
console.log("\n[4/4] サマリ");
console.log(`  OK     : ${results.ok}`);
console.log(`  SKIP   : ${results.skip}`);
console.log(`  ERROR  : ${results.error}`);

if (skipped.length > 0) {
  console.log("\n  → lesson 一致なしの試験:");
  for (const s of skipped) {
    console.log(`     qid=${s.qid}  ${s.name}`);
  }
}

const { count: examCount } = await supabase
  .from("exams")
  .select("*", { count: "exact", head: true });
const { count: qCount } = await supabase
  .from("exam_questions")
  .select("*", { count: "exact", head: true });
const { count: choiceCount } = await supabase
  .from("exam_choices")
  .select("*", { count: "exact", head: true });

console.log(`\n  DB state: exams=${examCount}  questions=${qCount}  choices=${choiceCount}`);
