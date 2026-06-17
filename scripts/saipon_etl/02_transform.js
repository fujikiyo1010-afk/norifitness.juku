// scripts/saipon_etl/02_transform.js
//
// /tmp/saipon_dump/*.json (サイポン生データ) を Supabase スキーマに変換
// 出力: /tmp/saipon_dump/etl_output.json
//
// 構造:
// {
//   "courses": [{title, description, sort_order, is_published}],
//   "chapters": [{course_idx, sort_order, title, description, released_at}],
//   "lessons":  [{course_idx, chapter_idx, sort_order, title, vimeo_url, meta_tags}]
// }
//
// course_idx / chapter_idx は 03_upload で実 UUID に解決する用の仮 index

const fs = require('fs');
const path = require('path');

const DUMP_DIR = '/tmp/saipon_dump';
const OUTPUT = path.join(DUMP_DIR, 'etl_output.json');

// ---------- 1. categories.json (5 コース + 23 章 メタ) ----------
const categoriesRaw = JSON.parse(fs.readFileSync(path.join(DUMP_DIR, 'categories.json'), 'utf-8'));

const courses = [];
const chapters = [];
const lessons = [];

categoriesRaw.categories.forEach((cat, catIdx) => {
  // courses 行
  courses.push({
    course_idx: catIdx, // 仮 index (03 で UUID 解決)
    title: cat.name,
    description: null,
    sort_order: catIdx + 1,
    is_published: true,
    category_id: cat.category_id, // デバッグ用 (上げない)
  });

  // chapters 行 ・ category 内 sort_order = 1, 2, 3, ...
  cat.courses.forEach((chap, chapIdx) => {
    chapters.push({
      course_idx: catIdx,
      chapter_idx: `${catIdx}-${chapIdx}`,
      sort_order: chapIdx + 1,
      title: chap.name,
      description: null,
      released_at: chap.date ? `${chap.date}T00:00:00+09:00` : null,
      course_no: chap.course_no, // 後で course_<X>.json を引くキー
    });
  });
});

// ---------- 2. course_<X>.json (各章のレッスン名 + lesson_no) ----------
const lessonNoToInfo = new Map(); // lesson_no -> { title, chapter_idx, sort_order_in_chapter }

chapters.forEach((chap) => {
  const courseFile = path.join(DUMP_DIR, `course_${chap.course_no}.json`);
  if (!fs.existsSync(courseFile)) {
    console.warn(`⚠️ course_${chap.course_no}.json なし (スキップ)`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(courseFile, 'utf-8'));
  (data.lessons || []).forEach((l, lIdx) => {
    lessonNoToInfo.set(l.lesson_no, {
      title: l.name,
      lesson_id: l.lesson_id,
      chapter_idx: chap.chapter_idx,
      sort_order: lIdx + 1, // 章内連番
      released_at: l.date ? `${l.date}T00:00:00+09:00` : null,
    });
  });
});

// ---------- 3. lesson_<Y>.json (各レッスンの Vimeo URL) ----------
const VIMEO_RE = /https?:\\\/\\\/vimeo\.com\\\/([0-9]+)/;

lessonNoToInfo.forEach((info, lessonNo) => {
  const lessonFile = path.join(DUMP_DIR, `lesson_${lessonNo}.json`);
  let vimeoUrl = null;
  if (fs.existsSync(lessonFile)) {
    const raw = fs.readFileSync(lessonFile, 'utf-8'); // raw JSON 文字列で正規表現適用
    const match = raw.match(VIMEO_RE);
    if (match) {
      vimeoUrl = `https://vimeo.com/${match[1]}`;
    }
  }

  // メタタグ判定 ・ 名前に「【テスト】」 を含むものは "テスト" タグ
  const metaTags = [];
  if (info.title && info.title.includes('【テスト】')) metaTags.push('テスト');
  if (info.title && info.title.includes('【未編集】')) metaTags.push('未編集');

  lessons.push({
    chapter_idx: info.chapter_idx,
    sort_order: info.sort_order,
    title: info.title,
    description: null,
    vimeo_url: vimeoUrl,
    meta_tags: metaTags.length > 0 ? metaTags : null,
    released_at: info.released_at,
    saipon_lesson_no: lessonNo, // デバッグ用 (上げない)
    saipon_lesson_id: info.lesson_id, // デバッグ用 (上げない)
  });
});

// ---------- 出力 ----------
fs.writeFileSync(OUTPUT, JSON.stringify({ courses, chapters, lessons }, null, 2));

console.log('✅ ETL transform 完了');
console.log(`  courses: ${courses.length} (期待 5)`);
console.log(`  chapters: ${chapters.length} (期待 23)`);
console.log(`  lessons: ${lessons.length} (期待 224)`);
console.log(`  vimeo_url あり: ${lessons.filter((l) => l.vimeo_url).length} (期待 191)`);
console.log(`  vimeo_url なし: ${lessons.filter((l) => !l.vimeo_url).length} (期待 33)`);
console.log(`  「テスト」 タグ: ${lessons.filter((l) => l.meta_tags?.includes('テスト')).length}`);
console.log(`  「未編集」 タグ: ${lessons.filter((l) => l.meta_tags?.includes('未編集')).length}`);
console.log('');
console.log(`出力: ${OUTPUT} (${fs.statSync(OUTPUT).size} bytes)`);
