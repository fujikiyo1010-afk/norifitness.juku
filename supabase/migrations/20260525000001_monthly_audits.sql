-- =====================================================================
-- 月次添削 (monthly_audits)
-- =====================================================================
-- 作成日: 2026-05-25
-- 対象: Phase 3 マイグレーション #1
-- 内容: 月 1 回の月次添削 (17 項目テキスト + のり氏動画返信 Vimeo URL)
--       LINE 返信を廃止してアプリ内動画返信に完全移行 (Phase 2-7 合意)
-- 設計元: docs/00_premises/_consolidated_agreements_2026-05-25.md セクション 6-B
--         + /tmp/phase_3_mvp_classification_and_db.html
--
-- 主な特徴:
--   - 1 ユーザー × 1 月 = 1 件 (UNIQUE 制約)
--   - items jsonb で 17 項目を柔軟に保持 ({"q1": {"score": 7, "text": "..."}, ...})
--   - 動画ファイル本体は Vimeo に保存、ここには URL のみ
--   - 受講生は自分の行のみ、管理者は全行アクセス可
--
-- 適用方法:
--   方式1: supabase CLI で `supabase db push`
--   方式2: Supabase ダッシュボード SQL Editor に全文コピペ → Run
--
-- ⚠️ 既存の monthly_audits テーブルがある場合は失敗します。新規追加前提。
-- =====================================================================

create table public.monthly_audits (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users(id) on delete cascade,
  target_month            date not null,                  -- 月の 1 日 (2026-05-01 形式)
  items                   jsonb not null default '{}',    -- 17 項目 {"q1": {"score": 7, "text": "..."}, ...}
  items_filled_count      integer not null default 0,     -- 進捗 (0-17)
  last_saved_at           timestamptz,                    -- 途中保存タイムスタンプ
  submitted_at            timestamptz,                    -- 受講生が提出した時刻
  nori_video_vimeo_url    text,                           -- Vimeo 動画 URL (のり氏返信)
  nori_video_vimeo_id     text,                           -- Vimeo 動画 ID (API 操作用)
  nori_video_published_at timestamptz,                    -- 動画返信公開時刻
  nori_video_duration_sec integer,                        -- 動画長さ (秒)
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- 1 ユーザー 1 月 1 件のみ (二重提出防止)
  unique (user_id, target_month)
);

-- インデックス
create index idx_monthly_audits_user_month
  on public.monthly_audits(user_id, target_month desc);

-- 管理画面: 未返答リスト (提出済 かつ 動画未配信)
create index idx_monthly_audits_pending
  on public.monthly_audits(submitted_at)
  where submitted_at is not null and nori_video_published_at is null;

-- updated_at 自動更新トリガー (既存ヘルパー関数を使用)
create trigger trg_monthly_audits_updated_at
  before update on public.monthly_audits
  for each row execute function public.set_updated_at();

-- RLS 有効化
alter table public.monthly_audits enable row level security;

-- 受講生は自分の月次添削を閲覧可、管理者は全閲覧可
create policy "monthly_audits: self or admin select"
  on public.monthly_audits for select
  using (auth.uid() = user_id or public.is_admin());

-- 受講生は自分の月次添削を新規作成可 (target_month を指定)
create policy "monthly_audits: self insert"
  on public.monthly_audits for insert
  with check (auth.uid() = user_id);

-- 受講生は自分の月次添削を更新可 (途中保存・提出)
-- 管理者も更新可 (動画 URL 設定など)
create policy "monthly_audits: self or admin update"
  on public.monthly_audits for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- 削除は管理者のみ (受講生は削除不可、誤操作防止)
create policy "monthly_audits: admin delete"
  on public.monthly_audits for delete
  using (public.is_admin());
