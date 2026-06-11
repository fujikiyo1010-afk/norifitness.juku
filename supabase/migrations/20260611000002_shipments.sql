-- =====================================================================
-- 2026-06-11: プロテイン歓迎ギフト 発送管理
-- =====================================================================
--
-- 入会者へのプロテイン 1 個発送を追跡するテーブル。
-- 1 受講生 1 発送 (歓迎ギフトは入会時のみ、 リピート発送なし)。
--
-- 住所はスナップショット保存 (受講生プロフィール変更後も発送時情報が残る)。
--
-- モック: docs/03_design_mocks/recovered/管理画面_発送管理.html
--
-- 受講生側からの住所入力 UI (オンボ Step 6) は別タスクで実装予定。
-- 管理画面は本テーブルを読んで一覧 + 「発送済」チェックを管理。

create table if not exists public.shipments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,

  -- 住所スナップショット
  postal_code         text,
  prefecture          text,
  city                text,
  address_line        text,
  recipient_name      text,

  -- ステータス
  status              text not null default 'pending'
                      check (status in ('pending','shipped','cancelled')),
  shipped_at          timestamptz,
  shipped_by          uuid references public.admin_users(id) on delete set null,
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- 1 受講生 1 発送
  unique (user_id)
);

create index if not exists idx_shipments_status
  on public.shipments(status, created_at desc);
create index if not exists idx_shipments_pending
  on public.shipments(created_at desc)
  where status = 'pending';

create trigger trg_shipments_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

alter table public.shipments enable row level security;

-- 管理者: 全件閲覧 + 編集
create policy "shipments: admin all"
  on public.shipments for all
  using (public.is_admin())
  with check (public.is_admin());

-- 受講生: 自分の発送状態だけ閲覧 (将来の「あなたの発送状況」表示用)
create policy "shipments: self select"
  on public.shipments for select
  using (auth.uid() = user_id);
