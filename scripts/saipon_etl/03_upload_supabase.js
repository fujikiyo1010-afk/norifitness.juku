// scripts/saipon_etl/03_upload_supabase.js
//
// /tmp/saipon_dump/etl_output.json を本番 Supabase に投入
//
// 前提:
//   - /tmp/.env.supabase に NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   - NODE_PATH=06_kinniku_juku_app/node_modules
//
// 安全策:
//   - 既存 courses 件数チェック ・ 1 件以上なら確認なしで止まる ( --force で上書き)
//   - エラー時は途中 rollback (削除) せず手動対処
//
// 使い方:
//   set -a && source /tmp/.env.supabase && set +a && \
//     NODE_PATH=./node_modules node scripts/saipon_etl/03_upload_supabase.js

const fs = require('fs');

// /tmp/.env.supabase を自前 parse (前回パターン踏襲)
const ENV_PATH = '/tmp/.env.supabase';
if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  for (const line of envContent.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([^=]+?)=(.+)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FORCE = process.argv.includes('--force');

(async () => {
  const etl = JSON.parse(fs.readFileSync('/tmp/saipon_dump/etl_output.json', 'utf-8'));
  console.log('--- ETL データ確認 ---');
  console.log(`  courses: ${etl.courses.length}`);
  console.log(`  chapters: ${etl.chapters.length}`);
  console.log(`  lessons: ${etl.lessons.length}`);
  console.log('');

  // 1. 既存 courses 件数チェック
  console.log('[1/4] 本番 Supabase 既存 courses 件数チェック...');
  const { count: existingCount, error: countErr } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });
  if (countErr) {
    console.error(`❌ SELECT 失敗: ${countErr.message}`);
    process.exit(1);
  }
  console.log(`  既存 courses: ${existingCount} 件`);

  if (existingCount > 0 && !FORCE) {
    console.error('');
    console.error('❌ 既存データあり ・ 上書き停止');
    console.error('   既存を消すには: --force を付けて再実行 (DELETE → INSERT)');
    process.exit(1);
  }

  if (existingCount > 0 && FORCE) {
    console.log('  ⚠️ --force 指定 ・ 既存 lessons → chapters → courses 順で削除');
    await supabase.from('lessons').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('chapters').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('  ✅ 既存削除完了');
  }

  // 2. courses INSERT
  console.log('');
  console.log('[2/4] courses INSERT (5 件)...');
  const courseRows = etl.courses.map((c) => ({
    title: c.title,
    description: c.description,
    sort_order: c.sort_order,
    is_published: c.is_published,
  }));
  const { data: insertedCourses, error: cErr } = await supabase
    .from('courses')
    .insert(courseRows)
    .select('id, sort_order');
  if (cErr) {
    console.error(`❌ courses INSERT 失敗: ${cErr.message}`);
    process.exit(1);
  }
  console.log(`  ✅ ${insertedCourses.length} 件挿入`);

  // sort_order → real id マップ
  const courseIdxToId = new Map();
  insertedCourses.forEach((row) => {
    courseIdxToId.set(row.sort_order - 1, row.id); // course_idx は sort_order - 1
  });

  // 3. chapters INSERT
  console.log('');
  console.log('[3/4] chapters INSERT (23 件)...');
  const chapterRows = etl.chapters.map((ch) => ({
    course_id: courseIdxToId.get(ch.course_idx),
    title: ch.title,
    description: ch.description,
    sort_order: ch.sort_order,
    released_at: ch.released_at,
  }));
  const { data: insertedChapters, error: chErr } = await supabase
    .from('chapters')
    .insert(chapterRows)
    .select('id, course_id, sort_order');
  if (chErr) {
    console.error(`❌ chapters INSERT 失敗: ${chErr.message}`);
    process.exit(1);
  }
  console.log(`  ✅ ${insertedChapters.length} 件挿入`);

  // chapter_idx → real id マップ
  const chapterIdxToId = new Map();
  etl.chapters.forEach((origCh) => {
    const matched = insertedChapters.find(
      (r) => r.course_id === courseIdxToId.get(origCh.course_idx) && r.sort_order === origCh.sort_order,
    );
    if (matched) chapterIdxToId.set(origCh.chapter_idx, matched.id);
  });

  // 4. lessons INSERT (大量なのでバッチ分割)
  console.log('');
  console.log('[4/4] lessons INSERT (224 件) バッチ分割...');
  const lessonRows = etl.lessons.map((l) => ({
    chapter_id: chapterIdxToId.get(l.chapter_idx),
    title: l.title,
    description: l.description,
    vimeo_url: l.vimeo_url,
    meta_tags: l.meta_tags,
    sort_order: l.sort_order,
    released_at: l.released_at,
  }));
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < lessonRows.length; i += BATCH) {
    const batch = lessonRows.slice(i, i + BATCH);
    const { error: lErr } = await supabase.from('lessons').insert(batch);
    if (lErr) {
      console.error(`❌ lessons INSERT batch ${i}-${i + BATCH} 失敗: ${lErr.message}`);
      process.exit(1);
    }
    total += batch.length;
    console.log(`  ↳ ${total}/${lessonRows.length}`);
  }

  console.log('');
  console.log('✅ 全投入完了');
  console.log(`  courses: ${insertedCourses.length} 件`);
  console.log(`  chapters: ${insertedChapters.length} 件`);
  console.log(`  lessons: ${total} 件`);
  console.log('');
  console.log('🌐 確認 URL: https://juku.norifitness.com/courses');
})();
