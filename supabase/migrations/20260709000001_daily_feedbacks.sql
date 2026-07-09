-- デイリー添削の日次フィードバック（1受講生 × 1日 = 1件）
-- 2026-07-09 P2a デイリー添削v1。dev→prod 適用済み（Rule 19）。
-- status: sent=FB送信 / checked=コメントなし確認 / skipped=スキップ（提案書§3）
create table if not exists public.daily_feedbacks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  date        date not null,
  body        text,
  status      text not null default 'sent'
              check (status in ('sent','checked','skipped')),
  admin_id    uuid references public.admin_users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_feedbacks_user_date_idx
  on public.daily_feedbacks (user_id, date desc);

alter table public.daily_feedbacks enable row level security;

-- 受講生: 自分宛の「送信済(sent)」だけ読める（掲示板/緑バッジ用・P2b）
drop policy if exists "daily_feedbacks: self select sent" on public.daily_feedbacks;
create policy "daily_feedbacks: self select sent"
  on public.daily_feedbacks for select
  using (auth.uid() = user_id and status = 'sent');

-- 管理者: 全操作（デイリー添削画面）
drop policy if exists "daily_feedbacks: admin all" on public.daily_feedbacks;
create policy "daily_feedbacks: admin all"
  on public.daily_feedbacks for all
  using (public.is_admin())
  with check (public.is_admin());
