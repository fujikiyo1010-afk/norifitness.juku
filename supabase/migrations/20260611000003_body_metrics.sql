-- =====================================================================
-- 2026-06-11: 体組成記録 テーブル (body_metrics)
-- =====================================================================
--
-- 受講生がいつでも自分の体組成を記録できる専用テーブル。
--
-- 関連設計:
--   - 体組成 v2 モック (docs/03_design_mocks/recovered/体組成記録画面_v2_(案2-D_ハイブリッド).html)
--   - 体組成推移グラフ モック (docs/03_design_mocks/recovered/体組成推移グラフ画面.html ・ 案 B 採用)
--
-- 月次添削の体組成項目 (monthly_audits.items) は「月次添削の参考情報」として並存。
-- アラート判定 + 推移グラフ は本テーブルを優先参照。
--
-- アラート閾値:
--   - 体組成 7 日途絶 (前回記録から 7 日以上経過)
--   - 目標乖離 7% (最新体重 vs 目標体重)

create table if not exists public.body_metrics (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  recorded_at         date not null,                 -- 記録対象日
  weight_kg           numeric(4,1),                  -- 例: 60.5 (NULL 許容)
  body_fat_percent    numeric(3,1),                  -- 例: 22.4 (NULL 許容)
  waist_cm            numeric(4,1),                  -- 例: 85.0 (NULL 許容)
  note                text,                          -- 任意メモ
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- 1 受講生 1 日 1 件 (同日複数記録不可、 上書き運用)
  unique (user_id, recorded_at)
);

create index if not exists idx_body_metrics_user_date
  on public.body_metrics(user_id, recorded_at desc);

create trigger trg_body_metrics_updated_at
  before update on public.body_metrics
  for each row execute function public.set_updated_at();

alter table public.body_metrics enable row level security;

-- 受講生: 自分のみ CRUD
create policy "body_metrics: self select"
  on public.body_metrics for select
  using (auth.uid() = user_id);
create policy "body_metrics: self insert"
  on public.body_metrics for insert
  with check (auth.uid() = user_id);
create policy "body_metrics: self update"
  on public.body_metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "body_metrics: self delete"
  on public.body_metrics for delete
  using (auth.uid() = user_id);

-- 管理者: 全件閲覧
create policy "body_metrics: admin select"
  on public.body_metrics for select
  using (public.is_admin());
