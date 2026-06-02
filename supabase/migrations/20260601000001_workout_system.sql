-- =====================================================================
-- 筋トレメニュー機能 (過去事例検索モデル) マイグレーション
-- =====================================================================
-- 作成日: 2026-06-01
-- 設計元: memory/project_kinniku_juku_workout_menu.md
--         memory/project_kinniku_juku_admin_user_hub.md
--         docs/00_premises/_handoff_to_workout_review_2026-06-01.md
--
-- 既存パターンとの整合 (2026-06-01 レビューで修正):
--   - RLS は public.is_admin() を使用 (admin_users 別テーブル参照)
--   - handled_by は public.admin_users(id) を参照
--   - updated_at は共通 public.set_updated_at() を使用
--   - 受講生の生年月日は user_profiles.birthday を正とする (案 C)
--     カルテ側に birth_date / age_band を持たない、TS 側で calcAgeBand 計算
--
-- 内容:
--   1. workout_templates       : 過去メニューテンプレ (検索対象、193件のシード)
--   2. user_workout_carte      : 受講生カルテ (機械マッチング4項目+判断補助4項目)
--   3. user_workout_menu       : 受講生に配布したメニュー (テンプレ+微調整)
--   4. user_workout_request    : メニュー変更リクエスト
--   5. user_carte_request      : カルテ更新リクエスト
-- =====================================================================


-- ===== 1. workout_templates =====
-- 過去メニューテンプレ (新規メニューが追加されるたびに自動追加される)
create table public.workout_templates (
  id                  uuid primary key default gen_random_uuid(),

  -- 出典 (元の受講生)
  source_name         text,                            -- 例: 水野剛
  source_filename     text,                            -- 例: 水野剛さん専用ダンベル毎日コツコツメニュー.xlsx
  source_user_id      uuid references public.users(id) on delete set null,  -- 新規メニューはここに紐付く

  -- 機械マッチング用属性
  gender              text not null check (gender in ('男','女','その他')),
  age_band            text not null check (age_band in ('10代','20代','30代','40代','50代','60代','70代')),
  instrument          text,                            -- 例: ダンベルのみ / ジム用 / 器具なし / 汎用名
  frequency           text,                            -- 例: 毎日コツコツ / 週3 / 週5
  primary_body        text,                            -- 重点部位 (集計最多): 例: 脚 / 大胸筋

  -- メニュー本体 (jsonb 集約)
  cycles              jsonb not null,                  -- 進化サイクル全データ (小/中/大)
  /* cycles 構造例:
     [
       { "段階": "小", "シート名": "...", "週": [
         { "日": "1日目", "種目": [
           { "順番": "1", "種目名": "...", "回数": "...", "インターバル": "...",
             "主部位": [...], "補部位": [...] }
         ]}
       ]}
     ]
  */

  -- 集計データ (検索用、cycles から計算済)
  body_parts_main     jsonb not null default '{}',     -- 主部位カウント: {"脚":10, "胸":5}
  total_exercises     int not null default 0,
  cycle_count         int not null default 0,

  -- メタ
  karte_match         text,                            -- 元の照合状態 (○/△/×) 参考用
  is_active           boolean not null default true,   -- 候補対象とするか
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- インデックス (マッチング検索の高速化)
create index idx_workout_templates_gender_active
  on public.workout_templates(gender, is_active) where is_active = true;
create index idx_workout_templates_age_band on public.workout_templates(age_band);
-- 部位検索用 (jsonb キー検索)
create index idx_workout_templates_body_parts on public.workout_templates using gin(body_parts_main);

-- updated_at 共通 trigger (既存パターン)
create trigger trg_workout_templates_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();

comment on table public.workout_templates is '過去メニューテンプレ。新規受講生にメニュー配布したら自動追加される。マッチング検索の対象母集団。';
comment on column public.workout_templates.cycles is 'メニュー本体 (jsonb)。進化サイクル(小/中/大)、各週、各日、各種目。';
comment on column public.workout_templates.body_parts_main is '主部位のカウント集計。マッチング時に重点部位カバー率の計算に使用。';


-- ===== 2. user_workout_carte =====
-- 受講生カルテ (機械マッチング4項目 + 判断補助4項目)
-- 受講生 = read-only, のり氏(管理者) = 編集可
-- 注: 生年月日 / 年齢層は user_profiles.birthday を正とする (案 C、2026-06-01 合意)
create table public.user_workout_carte (
  user_id             uuid primary key references public.users(id) on delete cascade,

  -- ===== 機械マッチング用 (4項目、age_band は user_profiles.birthday から TS 側で計算) =====
  gender              text not null check (gender in ('男','女','その他')),
  environments        text[] not null default '{}',    -- 複数選択: ['ダンベル','ベンチ','懸垂機']
  frequency_wish      text,                            -- '毎日コツコツ' / '週6' ... / '任せる'
  focus_body_parts    text[] not null default '{}',    -- 複数選択: ['全身バランス'] or ['胸','背中']

  -- ===== 判断補助用 (4項目、機械マッチングには使わない) =====
  purposes            text[] not null default '{}',    -- ダイエット/筋肉増/健康維持/体力向上/見た目改善
  experience          text,                            -- 全くない/たまに/週次/毎日
  medical_limits      text[] not null default '{}',    -- 腰痛/膝痛/心臓/高血圧/その他 (空配列 = なし)
  ideal_body          text,                            -- 健康+適度に筋肉/細マッチョ/マッチョ/曲線美/モデル

  -- メタ
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- メニュー再提案フラグ
  menu_review_needed  boolean not null default false,  -- 機械マッチング項目変更時にtrue
  last_machine_field_changed_at timestamptz             -- いつ機械マッチング項目が変わったか
);

create index idx_user_workout_carte_gender on public.user_workout_carte(gender);
create index idx_user_workout_carte_review
  on public.user_workout_carte(menu_review_needed) where menu_review_needed = true;

comment on table public.user_workout_carte is
  '受講生筋トレカルテ。完全選択式 8 項目。受講生は read-only、管理者のみ編集可。'
  '生年月日 = user_profiles.birthday を正、TS 側で calcAgeBand で年齢層計算。';
comment on column public.user_workout_carte.menu_review_needed is
  '機械マッチング項目 (gender / environments / frequency_wish / focus_body_parts) が変更されたら true。のり氏がハブ画面で「メニュー見直し推奨」を見て手動対応。';


-- ===== 3. user_workout_menu =====
-- 受講生に配布したメニュー (テンプレ + 微調整)
create table public.user_workout_menu (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,

  -- ベースにしたテンプレ
  template_id         uuid references public.workout_templates(id) on delete set null,
  template_snapshot   jsonb,                           -- テンプレが将来削除されても参照できるようコピー保存

  -- 微調整後のメニュー本体 (jsonb)
  cycles              jsonb not null,                  -- 微調整後の最終形
  notes               text,                            -- のり氏のメモ

  -- 配布情報
  effective_from      date not null default current_date,
  is_current          boolean not null default true,   -- 現役メニューか (新しいメニュー配布時に過去はfalse)

  -- メタ
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_user_workout_menu_user_current
  on public.user_workout_menu(user_id, is_current) where is_current = true;
create index idx_user_workout_menu_user_all
  on public.user_workout_menu(user_id, effective_from desc);

create trigger trg_user_workout_menu_updated_at
  before update on public.user_workout_menu
  for each row execute function public.set_updated_at();

comment on table public.user_workout_menu is
  '受講生に配布したメニュー。1人の受講生に対して、新しいメニュー配布のたびに is_current=true で追加 (旧は false に)。履歴管理。';


-- ===== 4. user_workout_request =====
-- メニュー変更リクエスト (受講生発信)
create table public.user_workout_request (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  request_text        text not null,                   -- 自由記入
  status              text not null default 'pending'
                      check (status in ('pending','in_progress','handled','dismissed')),
  created_at          timestamptz not null default now(),
  handled_at          timestamptz,
  handled_by          uuid references public.admin_users(id) on delete set null,  -- 対応した管理者
  resulting_menu_id   uuid references public.user_workout_menu(id) on delete set null  -- 対応で配布したメニュー
);

create index idx_user_workout_request_status
  on public.user_workout_request(status, created_at desc);
create index idx_user_workout_request_user
  on public.user_workout_request(user_id, created_at desc);


-- ===== 5. user_carte_request =====
-- カルテ更新リクエスト (受講生発信)
create table public.user_carte_request (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  request_text        text not null,                   -- 例: 「ジム入会したので環境を更新したい」
  status              text not null default 'pending'
                      check (status in ('pending','in_progress','handled','dismissed')),
  created_at          timestamptz not null default now(),
  handled_at          timestamptz,
  handled_by          uuid references public.admin_users(id) on delete set null  -- 対応した管理者
);

create index idx_user_carte_request_status
  on public.user_carte_request(status, created_at desc);
create index idx_user_carte_request_user
  on public.user_carte_request(user_id, created_at desc);


-- ===== RLS (Row Level Security) =====
-- 既存パターンに統一: public.is_admin() ヘルパー関数を使用

-- workout_templates: 管理者のみ閲覧/編集可、受講生は不可
alter table public.workout_templates enable row level security;
create policy "workout_templates: admin all"
  on public.workout_templates for all
  using (public.is_admin())
  with check (public.is_admin());

-- user_workout_carte: 受講生は自分のみ閲覧可 (編集は不可)、管理者は全件編集可
alter table public.user_workout_carte enable row level security;
create policy "user_workout_carte: self select"
  on public.user_workout_carte for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_workout_carte: admin insert"
  on public.user_workout_carte for insert
  with check (public.is_admin());
create policy "user_workout_carte: admin update"
  on public.user_workout_carte for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "user_workout_carte: admin delete"
  on public.user_workout_carte for delete
  using (public.is_admin());

-- user_workout_menu: 受講生は自分のみ閲覧可、管理者は全件編集可
alter table public.user_workout_menu enable row level security;
create policy "user_workout_menu: self select"
  on public.user_workout_menu for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_workout_menu: admin insert"
  on public.user_workout_menu for insert
  with check (public.is_admin());
create policy "user_workout_menu: admin update"
  on public.user_workout_menu for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "user_workout_menu: admin delete"
  on public.user_workout_menu for delete
  using (public.is_admin());

-- user_workout_request: 受講生は自分のリクエストを作成/閲覧可、管理者は全件操作可
alter table public.user_workout_request enable row level security;
create policy "user_workout_request: self select"
  on public.user_workout_request for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_workout_request: self insert"
  on public.user_workout_request for insert
  with check (user_id = auth.uid() or public.is_admin());
create policy "user_workout_request: admin update"
  on public.user_workout_request for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "user_workout_request: admin delete"
  on public.user_workout_request for delete
  using (public.is_admin());

-- user_carte_request: 受講生は自分のリクエストを作成/閲覧可、管理者は全件操作可
alter table public.user_carte_request enable row level security;
create policy "user_carte_request: self select"
  on public.user_carte_request for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_carte_request: self insert"
  on public.user_carte_request for insert
  with check (user_id = auth.uid() or public.is_admin());
create policy "user_carte_request: admin update"
  on public.user_carte_request for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "user_carte_request: admin delete"
  on public.user_carte_request for delete
  using (public.is_admin());


-- ===== Trigger: カルテ更新時にメニュー再提案フラグ =====
-- 機械マッチング 4 項目 (gender / environments / frequency_wish / focus_body_parts) が変わったら
-- menu_review_needed = true にセット。birth_date は user_profiles 側にあるため監視対象外
-- (user_profiles.birthday 変更時の波及は将来検討、現状は手動で対応)
create or replace function public.check_carte_machine_field_changed()
returns trigger
language plpgsql
as $$
begin
  if (new.gender IS DISTINCT FROM old.gender
      or new.environments IS DISTINCT FROM old.environments
      or new.frequency_wish IS DISTINCT FROM old.frequency_wish
      or new.focus_body_parts IS DISTINCT FROM old.focus_body_parts)
  then
    new.menu_review_needed := true;
    new.last_machine_field_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_user_workout_carte_machine_field_check
  before update on public.user_workout_carte
  for each row execute function public.check_carte_machine_field_changed();

-- updated_at 共通 trigger (既存パターン)
-- Trigger 順序: BEFORE UPDATE は名前のアルファベット順で実行されるため、
-- check_machine_field_changed (trg_..._machine_field_check) が先、updated_at が後で問題なし
create trigger trg_user_workout_carte_updated_at
  before update on public.user_workout_carte
  for each row execute function public.set_updated_at();

comment on function public.check_carte_machine_field_changed is
  'カルテ更新時、機械マッチング 4 項目 (gender / environments / frequency_wish / focus_body_parts) が変わったら menu_review_needed=true に。のり氏がハブ画面で「メニュー見直し推奨」を見て手動対応する。birth_date は user_profiles 側のため監視対象外。';
