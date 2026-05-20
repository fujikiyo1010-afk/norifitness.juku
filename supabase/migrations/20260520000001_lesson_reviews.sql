-- =====================================================================
-- 学びを深める 1: lesson_reviews (3 行振り返り)
-- =====================================================================
-- 作成日: 2026-05-20
-- 内容: Feynman 技法によるレッスン後の学びの言語化
-- 表示: レッスン詳細ページのアコーディオン UI、任意項目
-- 制約: 1 ユーザー × 1 レッスン = 1 レコード(編集は同一行を上書き)
-- 適用方法: Supabase ダッシュボード SQL Editor に貼り付け Run、
--           または supabase db push
-- =====================================================================

create table public.lesson_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  learned       text,                  -- 1. 学んだこと
  impressed     text,                  -- 2. 印象に残ったこと
  next_action   text,                  -- 3. 次にやってみたいこと
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index idx_lesson_reviews_user
  on public.lesson_reviews(user_id, created_at desc);
create index idx_lesson_reviews_lesson
  on public.lesson_reviews(lesson_id);

create trigger trg_lesson_reviews_updated_at
  before update on public.lesson_reviews
  for each row execute function public.set_updated_at();

alter table public.lesson_reviews enable row level security;

-- 受講生は自分の振り返りのみ閲覧可、管理者は全閲覧可(サポート用)
create policy "lesson_reviews: self or admin select"
  on public.lesson_reviews for select
  using (auth.uid() = user_id or public.is_admin());

create policy "lesson_reviews: self insert"
  on public.lesson_reviews for insert
  with check (auth.uid() = user_id);

create policy "lesson_reviews: self update"
  on public.lesson_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 削除は本人 or 管理者(管理者は乱用しない運用前提)
create policy "lesson_reviews: self or admin delete"
  on public.lesson_reviews for delete
  using (auth.uid() = user_id or public.is_admin());
