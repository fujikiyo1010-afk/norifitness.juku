-- =====================================================================
-- 2026-07-10: P6 生活記録 ・ daily_conditions(1日1行・4問)
-- =====================================================================
--
-- 承認済みDDL(2026-07-10 きよむさん)。4問=昨夜の睡眠(0.5単位)/体調/お通じ/お酒。
-- 各項目 nullable(部分入力・スキップOK)。UNIQUE(user_id,date)。RLS=meals同型。

create table if not exists public.daily_conditions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  date        date not null,
  sleep_hours numeric,                                              -- 昨夜の睡眠(0.5単位)
  condition   text check (condition in ('good','normal','bad')),    -- 体調: 良い/普通/悪い
  bowel       text check (bowel in ('yes','constipated','no')),     -- お通じ: あり/便秘気味/なし
  alcohol     text check (alcohol in ('none','little','much')),     -- お酒: なし/少し/しっかり
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_daily_conditions_user_date
  on public.daily_conditions(user_id, date desc);

drop trigger if exists trg_daily_conditions_updated_at on public.daily_conditions;
create trigger trg_daily_conditions_updated_at
  before update on public.daily_conditions
  for each row execute function public.set_updated_at();

alter table public.daily_conditions enable row level security;

drop policy if exists "daily_conditions: self all" on public.daily_conditions;
create policy "daily_conditions: self all"
  on public.daily_conditions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "daily_conditions: admin select" on public.daily_conditions;
create policy "daily_conditions: admin select"
  on public.daily_conditions for select using (public.is_admin());
