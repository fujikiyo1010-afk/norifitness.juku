-- =====================================================================
-- 2026-07-10: P5 筋トレ実施記録 ・ 3テーブル(原本固定/実績二層)
-- =====================================================================
--
-- 承認済みDDL(2026-07-10 きよむさん)。原本=既存 user_workout_menu(cycles jsonb)を参照のみ。
--   - user_workout_progress: 1ユーザー1行(進行状態・開始日・周回・再配布予告)
--   - user_workout_logs: 1(周,日)=1行(強度/status/メモ)。スキップも残す。
--   - user_workout_log_items: やった種目だけ行を作る(原本外=source 'added')。
--     「原本にあってitemsに無い=やらなかった」を管理側が差分描画(ステータス列を持たない)。

-- --- 1) 進行状態 -------------------------------------------------------
create table if not exists public.user_workout_progress (
  user_id         uuid primary key references public.users(id) on delete cascade,
  menu_id         uuid references public.user_workout_menu(id) on delete set null,
  current_day     int  not null default 1,
  cycle_number    int  not null default 1,
  started_at      timestamptz not null default now(),
  pending_menu_id uuid references public.user_workout_menu(id) on delete set null,
  updated_at      timestamptz not null default now()
);

-- --- 2) 実施ログ(1日1行) ---------------------------------------------
create table if not exists public.user_workout_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  menu_id      uuid references public.user_workout_menu(id) on delete set null,
  date         date not null,
  day_number   int  not null,
  cycle_number int  not null,
  intensity    text not null default 'medium' check (intensity in ('small','medium','large')),
  status       text not null check (status in ('done','rest_done','skipped')),
  memo         text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, cycle_number, day_number)
);
create index if not exists idx_uwl_user_date
  on public.user_workout_logs(user_id, date desc);

-- --- 3) 実績種目 ------------------------------------------------------
create table if not exists public.user_workout_log_items (
  id            uuid primary key default gen_random_uuid(),
  log_id        uuid not null references public.user_workout_logs(id) on delete cascade,
  exercise_name text not null,
  source        text not null default 'original' check (source in ('original','added')),
  weight_kg     numeric,
  reps          int,
  sets          int,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_uwli_log
  on public.user_workout_log_items(log_id);

-- --- updated_at トリガ ------------------------------------------------
drop trigger if exists trg_uw_progress_updated_at on public.user_workout_progress;
create trigger trg_uw_progress_updated_at
  before update on public.user_workout_progress
  for each row execute function public.set_updated_at();

drop trigger if exists trg_uw_logs_updated_at on public.user_workout_logs;
create trigger trg_uw_logs_updated_at
  before update on public.user_workout_logs
  for each row execute function public.set_updated_at();

-- --- RLS(meals 同型: 受講生=自分 / 管理=全件select) -------------------
alter table public.user_workout_progress enable row level security;
alter table public.user_workout_logs enable row level security;
alter table public.user_workout_log_items enable row level security;

drop policy if exists "uw_progress: self all" on public.user_workout_progress;
create policy "uw_progress: self all"
  on public.user_workout_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "uw_progress: admin select" on public.user_workout_progress;
create policy "uw_progress: admin select"
  on public.user_workout_progress for select using (public.is_admin());

drop policy if exists "uw_logs: self all" on public.user_workout_logs;
create policy "uw_logs: self all"
  on public.user_workout_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "uw_logs: admin select" on public.user_workout_logs;
create policy "uw_logs: admin select"
  on public.user_workout_logs for select using (public.is_admin());

drop policy if exists "uw_log_items: self all" on public.user_workout_log_items;
create policy "uw_log_items: self all"
  on public.user_workout_log_items for all
  using (
    exists (
      select 1 from public.user_workout_logs l
      where l.id = user_workout_log_items.log_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_workout_logs l
      where l.id = user_workout_log_items.log_id and l.user_id = auth.uid()
    )
  );
drop policy if exists "uw_log_items: admin select" on public.user_workout_log_items;
create policy "uw_log_items: admin select"
  on public.user_workout_log_items for select using (public.is_admin());
