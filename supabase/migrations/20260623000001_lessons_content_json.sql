-- 2026-06-23 きよむさん指示
-- レッスンに「テキストレッスン」 タイプを追加するための content_json カラム新設。
--
-- 既存: vimeo_url が値あれば「動画レッスン」 / NULL なら未配信
-- 追加: content_json が値あれば「テキストレッスン」 (= モンクモード 解説など)
--
-- レンダリング規約:
--   - content_json は { sections: [{ title, steps: [{ title, body, images? }] }] } 構造
--   - lesson 詳細ページで content_json があれば TextLessonRenderer (= アコーディオン) で描画
--   - vimeo_url と content_json の両方ある場合: 動画 + テキスト 併用 (= 将来拡張用 / 当面 排他想定)

alter table public.lessons
  add column if not exists content_json jsonb;

comment on column public.lessons.content_json is
  'テキストレッスン用 構造化コンテンツ。 NULL = 動画レッスン / 値あり = テキストレッスン (= アコーディオン描画)';
