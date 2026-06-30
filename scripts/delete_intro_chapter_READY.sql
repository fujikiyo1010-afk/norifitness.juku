-- ====================================================================
-- 2026-06-23 きよむさん指示
-- 「限定ボディメイク完全ロードマップ」 コースから
-- 「0. はじめに必ず視聴して下さい」 章 を 章ごと完全削除 + sort_order 再採番。
--
-- 削除対象:
--   chapter:  f4f8b6dc-e3db-426a-8c1a-d041c0dbd03f (= 「0. はじめに必ず視聴して下さい」)
--   lessons:  ① ② ③ 目標設定 動画 / 【テスト】 目標設定の効果的なやり方
--             / カロミルの使い方 / バーンフィットの使い方 (= 計 6 件)
--   exams:    L4 lesson に紐付いた章末試験 1 件 (= CASCADE で自動削除)
--   関連:     lesson_progress / lesson_reviews / exam_questions / exam_attempts 全部 CASCADE
--
-- 残り 7 章を sort_order 1〜7 に再採番 (= 元 1 はそのまま / 3-8 を 2-7 に詰める)。
--
-- 実行手順:
--   Supabase Dashboard → SQL Editor で全文 コピペ → Run
-- ====================================================================

BEGIN;

-- ① 章削除 (= CASCADE で関連全部 自動削除)
DELETE FROM public.chapters
WHERE id = 'f4f8b6dc-e3db-426a-8c1a-d041c0dbd03f';

-- ② sort_order 再採番 (= 残り 7 章を詰める / 元 sort_order > 2 を 1 つずつ前にずらす)
UPDATE public.chapters
SET sort_order = sort_order - 1
WHERE course_id = '8a7eba0d-006c-403c-9576-8f1d11ca43bc'
  AND sort_order > 2;

COMMIT;

-- ③ 確認 (= 7 章になってる + sort_order 1〜7 連番)
SELECT id, title, sort_order
FROM public.chapters
WHERE course_id = '8a7eba0d-006c-403c-9576-8f1d11ca43bc'
ORDER BY sort_order;
