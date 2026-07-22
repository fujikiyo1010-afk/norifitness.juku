-- じぶんメニュー（週間プール改修）: 棚 / セット記録 / お気に入り種目 + user_workout_logs への無害追加
-- 2026-07-22 きよむ承認 → Management API で dev(yciqbigyzfqmmjdcnqfk) / prod(fqfsgkzyotvpcxmszkax) へ適用済み。
-- 破壊移行なし: 既存 user_workout_logs は列追加 + day_number NULL許容化のみ（既存行は不変）。

alter table user_workout_logs
  add column if not exists is_custom boolean not null default false,
  add column if not exists custom_menu_id uuid,
  add column if not exists primary_target text;
alter table user_workout_logs alter column day_number drop not null;

create table if not exists user_custom_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_target text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_user_custom_menus_updated_at on user_custom_menus;
create trigger trg_user_custom_menus_updated_at
  before update on user_custom_menus
  for each row execute function public.set_updated_at();

create table if not exists user_custom_menu_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_menu_id uuid references user_custom_menus(id) on delete set null,
  log_id uuid references user_workout_logs(id) on delete cascade,
  exercise_name text not null,
  exercise_order int not null default 0,
  set_number int not null,
  weight_kg numeric,
  reps int,
  created_at timestamptz not null default now()
);

create table if not exists user_favorite_exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_name)
);

alter table user_custom_menus enable row level security;
drop policy if exists ucm_self on user_custom_menus;
create policy ucm_self on user_custom_menus for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table user_custom_menu_sets enable row level security;
drop policy if exists ucms_self on user_custom_menu_sets;
create policy ucms_self on user_custom_menu_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table user_favorite_exercises enable row level security;
drop policy if exists ufe_self on user_favorite_exercises;
create policy ufe_self on user_favorite_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
