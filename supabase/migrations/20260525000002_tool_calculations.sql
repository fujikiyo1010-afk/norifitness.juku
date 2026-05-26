-- =====================================================================
-- ツール計算履歴 (tool_calculations)
-- =====================================================================
-- 作成日: 2026-05-25
-- 対象: Phase 3 マイグレーション #2
-- 内容: 4 ツール (体脂肪率 / カロリー / 減量期間 / PFC・カーボサイクル) の
--       計算結果を保存。最新値のみ保持 (UPSERT 運用)。
-- 設計元: docs/00_premises/_consolidated_agreements_2026-05-25.md
--         + /tmp/phase_3_mvp_classification_and_db.html
--
-- 主な特徴:
--   - 1 ユーザー × 1 ツール = 1 件 (UNIQUE 制約、UPSERT 運用)
--   - inputs / outputs を jsonb で保持 (各ツールで構造異なる)
--   - 目標シートに反映済かどうかを applied_to_goal_sheet で管理
--   - 次回ツール画面を開いた時に前回値を復元する用途
--
-- 適用方法:
--   方式1: supabase CLI で `supabase db push`
--   方式2: Supabase ダッシュボード SQL Editor に全文コピペ → Run
--
-- ⚠️ 既存の tool_calculations テーブルがある場合は失敗します。新規追加前提。
-- =====================================================================

create table public.tool_calculations (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.users(id) on delete cascade,
  tool_id                  text not null
                           check (tool_id in ('body_fat', 'calorie', 'diet_period', 'pfc_carb')),
  inputs                   jsonb not null,           -- 入力値 (例: {"gender":"male","height":170,...})
  outputs                  jsonb not null,           -- 計算結果 (例: {"body_fat_pct":22.5,...})
  applied_to_goal_sheet    boolean not null default false,  -- 目標シート反映済フラグ
  applied_at               timestamptz,                     -- 反映実行時刻
  calculated_at            timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- 1 ユーザー × 1 ツール = 1 件 (UPSERT 運用、最新値のみ保存)
  unique (user_id, tool_id)
);

-- UNIQUE 制約が user_id でのアクセスに対応するインデックスを兼ねるため
-- 追加インデックスは不要

-- updated_at 自動更新トリガー (既存ヘルパー関数を使用)
create trigger trg_tool_calculations_updated_at
  before update on public.tool_calculations
  for each row execute function public.set_updated_at();

-- RLS 有効化
alter table public.tool_calculations enable row level security;

-- 受講生は自分のツール計算結果のみ閲覧可、管理者は全閲覧可 (サポート用)
create policy "tool_calculations: self or admin select"
  on public.tool_calculations for select
  using (auth.uid() = user_id or public.is_admin());

-- 受講生は自分のツール計算結果を新規作成可
create policy "tool_calculations: self insert"
  on public.tool_calculations for insert
  with check (auth.uid() = user_id);

-- 受講生は自分のツール計算結果を更新可 (UPSERT で同じ行を上書き)
create policy "tool_calculations: self update"
  on public.tool_calculations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 削除は本人 or 管理者 (リセット機能用)
create policy "tool_calculations: self or admin delete"
  on public.tool_calculations for delete
  using (auth.uid() = user_id or public.is_admin());
