-- =====================================================================
-- 2026-07-10: P7 デイリー添削ページ ・ しおり(feedback_bookmarks)
-- =====================================================================
-- 承認済みDDL(2026-07-10 きよむさん)。受講生が日次FB(daily_feedbacks)を日付で保存。
create table if not exists public.feedback_bookmarks (
  user_id    uuid not null references public.users(id) on delete cascade,
  fb_date    date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, fb_date)
);
alter table public.feedback_bookmarks enable row level security;
drop policy if exists "feedback_bookmarks: self all" on public.feedback_bookmarks;
create policy "feedback_bookmarks: self all"
  on public.feedback_bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
