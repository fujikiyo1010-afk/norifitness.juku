-- =====================================================================
-- 2026-07-10: P4 食事添削 ・ 3テーブル + private bucket 'meal-photos'
-- =====================================================================
--
-- 方針(承認済みDDL・2026-07-10 きよむさん):
--   - meal_logs = 1食1レコード(朝/昼/夕/間)。日合計は user+date で集計。
--   - meal_log_items = 品目行。PFCは全null許容(写真だけ運用=v1-a)。
--   - food_table = のり監修ミニ成分表(中身はv1-b/P4-bで投入・v1-aは空でOK)。
--   - 目標PFCは既存 goal_sheets.content.nutrition を流用(新表なし)。
--   - のりコメントは既存 daily_feedbacks(新表なし)。編集ロックは導出(フラグ列なし)。
--   - meal_type にユニーク制約は張らない(間食は同日複数OK。朝昼夕の再投稿誘導はアプリ側)。

-- --- 1) food_table -----------------------------------------------------
create table if not exists public.food_table (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  aliases      text[] not null default '{}',                 -- 「なっとう」→納豆 検索用
  unit_type    text not null check (unit_type in ('weight','count')),
  base_qty     numeric not null,                             -- weight=100(g) / count=1
  default_qty  numeric not null,                             -- 初期表示量(もち麦150g・卵1個)
  step_qty     numeric not null,                             -- weight=10 / count=1
  unit_label   text not null,                                -- 'g' '個' 'パック' '本' '杯'
  kcal         numeric,
  protein_g    numeric,
  fat_g        numeric,
  carb_g       numeric,
  fiber_g      numeric,                                      -- 元データにあり(任意)
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --- 2) meal_logs (1食1レコード) --------------------------------------
create table if not exists public.meal_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  date       date not null,
  meal_type  text not null check (meal_type in ('朝','昼','夕','間')),
  posted_at  timestamptz not null default now(),
  memo       text,
  photos     text[] not null default '{}',                  -- 'meal-photos' bucket パス配列
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_meal_logs_user_date
  on public.meal_logs(user_id, date);

-- --- 3) meal_log_items (品目行・PFC全null許容) ------------------------
create table if not exists public.meal_log_items (
  id            uuid primary key default gen_random_uuid(),
  meal_log_id   uuid not null references public.meal_logs(id) on delete cascade,
  name          text not null,
  source        text not null default 'none' check (source in ('table','manual','none')),
  food_table_id uuid references public.food_table(id) on delete set null,
  quantity      numeric,
  unit          text,
  kcal          numeric,
  protein_g     numeric,
  fat_g         numeric,
  carb_g        numeric,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_meal_log_items_log
  on public.meal_log_items(meal_log_id);

-- --- updated_at トリガ(既存 public.set_updated_at) -------------------
drop trigger if exists trg_food_table_updated_at on public.food_table;
create trigger trg_food_table_updated_at
  before update on public.food_table
  for each row execute function public.set_updated_at();

drop trigger if exists trg_meal_logs_updated_at on public.meal_logs;
create trigger trg_meal_logs_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();

-- --- RLS ---------------------------------------------------------------
alter table public.food_table enable row level security;
alter table public.meal_logs enable row level security;
alter table public.meal_log_items enable row level security;

-- food_table: 受講生=有効品のみ read / 管理=全操作
drop policy if exists "food_table: read active" on public.food_table;
create policy "food_table: read active"
  on public.food_table for select
  using (is_active = true or public.is_admin());
drop policy if exists "food_table: admin write" on public.food_table;
create policy "food_table: admin write"
  on public.food_table for all
  using (public.is_admin())
  with check (public.is_admin());

-- meal_logs: 受講生=自分のみ CRUD / 管理=全件 select
drop policy if exists "meal_logs: self all" on public.meal_logs;
create policy "meal_logs: self all"
  on public.meal_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "meal_logs: admin select" on public.meal_logs;
create policy "meal_logs: admin select"
  on public.meal_logs for select
  using (public.is_admin());

-- meal_log_items: 親 meal_log の所有者のみ CRUD / 管理=全件 select
drop policy if exists "meal_log_items: self all" on public.meal_log_items;
create policy "meal_log_items: self all"
  on public.meal_log_items for all
  using (
    exists (
      select 1 from public.meal_logs ml
      where ml.id = meal_log_items.meal_log_id and ml.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meal_logs ml
      where ml.id = meal_log_items.meal_log_id and ml.user_id = auth.uid()
    )
  );
drop policy if exists "meal_log_items: admin select" on public.meal_log_items;
create policy "meal_log_items: admin select"
  on public.meal_log_items for select
  using (public.is_admin());

-- --- Storage bucket (プライベート 'meal-photos') ---------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- パス規約: {user_id}/... で本人のみ。管理は全件 read。
drop policy if exists "meal-photos: self read" on storage.objects;
create policy "meal-photos: self read"
  on storage.objects for select
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "meal-photos: self insert" on storage.objects;
create policy "meal-photos: self insert"
  on storage.objects for insert
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "meal-photos: self delete" on storage.objects;
create policy "meal-photos: self delete"
  on storage.objects for delete
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "meal-photos: admin read" on storage.objects;
create policy "meal-photos: admin read"
  on storage.objects for select
  using (bucket_id = 'meal-photos' and public.is_admin());
