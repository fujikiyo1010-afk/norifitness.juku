/**
 * /tmp/exam_mapping.json (lesson_id 紐付け済) を読んで全 15 試験を投入。
 *
 * 02_upload.mjs と違って、 タイトル一致は使わず、 マッピング JSON の lesson_id を信頼。
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
const MAPPING = JSON.parse(fs.readFileSync("/tmp/exam_mapping.json", "utf-8"));

// ------------------------------------------------------------------
// 0) 既存 exams 全クリア (re-run 対応)
// ------------------------------------------------------------------
console.log("[0/3] 既存 exams クリア (CASCADE で questions/choices も削除)");
const { error: delErr } = await supabase
  .from("exams")
  .delete()
  .gte("id", "00000000-0000-0000-0000-000000000000");
if (delErr) console.log("  warn:", delErr.message);

// ------------------------------------------------------------------
// 1) マッピング順に投入
// ------------------------------------------------------------------
console.log("\n[1/3] 各 exam 投入");
const results = { ok: 0, error: 0 };

for (const m of MAPPING) {
  const examFile = path.join(DUMP_DIR, `exam_${m.qid}.json`);
  const raw = JSON.parse(fs.readFileSync(examFile, "utf-8"));
  const questions = raw.list || [];

  // 1-a. exams insert
  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .insert({
      lesson_id: m.targetLessonId,
      saipon_question_box_id: m.qid,
      name: m.examName,
      passing_score: raw.passing_score ?? 80,
      total_questions: questions.length,
    })
    .select("id")
    .single();
  if (examErr) {
    results.error += 1;
    console.log(`  [error] qid=${m.qid}  exams insert: ${examErr.message}`);
    continue;
  }
  const examId = examRow.id;

  // 1-b. exam_questions 一括 insert
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
    console.log(`  [error] qid=${m.qid}  questions insert: ${qErr.message}`);
    continue;
  }

  // 1-c. exam_choices 一括 insert
  const choicesInsert = [];
  const correctChoiceMap = new Map();
  for (const q of questions) {
    const dbQ = insertedQuestions.find((x) => x.saipon_question_id === q.id);
    if (!dbQ) continue;
    correctChoiceMap.set(dbQ.id, q.answer);
    (q.choices || []).forEach((c, idx) => {
      choicesInsert.push({
        question_id: dbQ.id,
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
    console.log(`  [error] qid=${m.qid}  choices insert: ${cErr.message}`);
    continue;
  }

  // 1-d. correct_choice_id 埋め
  let correctOk = 0;
  for (const [questionDbId, saipoCorrectId] of correctChoiceMap.entries()) {
    const correctChoice = insertedChoices.find(
      (c) => c.question_id === questionDbId && c.saipon_choice_id === saipoCorrectId
    );
    if (!correctChoice) continue;
    const { error: updErr } = await supabase
      .from("exam_questions")
      .update({ correct_choice_id: correctChoice.id })
      .eq("id", questionDbId);
    if (!updErr) correctOk += 1;
  }

  results.ok += 1;
  console.log(
    `  [ok] qid=${m.qid}  Q=${questions.length}  Cset=${correctOk}  → ${m.targetLessonTitle}`
  );
}

// ------------------------------------------------------------------
// 2) サマリ
// ------------------------------------------------------------------
console.log(`\n[2/3] サマリ: OK ${results.ok} / ERROR ${results.error}`);

const { count: examCount } = await supabase
  .from("exams")
  .select("*", { count: "exact", head: true });
const { count: qCount } = await supabase
  .from("exam_questions")
  .select("*", { count: "exact", head: true });
const { count: choiceCount } = await supabase
  .from("exam_choices")
  .select("*", { count: "exact", head: true });
console.log(
  `\n[3/3] DB state: exams=${examCount}  questions=${qCount}  choices=${choiceCount}`
);
