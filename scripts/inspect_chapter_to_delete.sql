-- ====================================================================
-- 2026-06-23 きよむさん指示
-- 「限定ボディメイク完全ロードマップ」 コースから「0. はじめに必ず視聴」 章を
-- 章ごと削除する前の 事前確認 SELECT。
--   削除する章: f4f8b6dc-e3db-426a-8c1a-d041c0dbd03f
--   コース:     8a7eba0d-006c-403c-9576-8f1d11ca43bc
--
-- 実行手順: Supabase Dashboard → SQL Editor に全文コピペ → Run
--           結果を Claude に渡す → 削除 SQL (delete_intro_chapter_READY.sql) へ
-- ====================================================================

-- ① コース確認 (= 1 行・タイトルが「限定ボディメイク完全ロードマップ」 か)
SELECT id, title, sort_order
FROM public.courses
WHERE id = '8a7eba0d-006c-403c-9576-8f1d11ca43bc';

-- ② 章一覧 (= 全 8 章 / 「0. はじめに」 章が sort_order=2 にいるか + 前後の番号)
SELECT id, title, sort_order
FROM public.chapters
WHERE course_id = '8a7eba0d-006c-403c-9576-8f1d11ca43bc'
ORDER BY sort_order;

-- ③ 削除対象章の中身 (= 7 項目 = 動画レッスン×6 + 章末試験用 lesson)
SELECT id, title, sort_order, (vimeo_url IS NOT NULL) AS has_video, meta_tags
FROM public.lessons
WHERE chapter_id = 'f4f8b6dc-e3db-426a-8c1a-d041c0dbd03f'
ORDER BY sort_order;

-- ④ 章末試験 (= ③ の lesson に CASCADE で紐付く exams / 1 件想定)
SELECT e.id, e.title, e.lesson_id
FROM public.exams e
JOIN public.lessons l ON l.id = e.lesson_id
WHERE l.chapter_id = 'f4f8b6dc-e3db-426a-8c1a-d041c0dbd03f';
