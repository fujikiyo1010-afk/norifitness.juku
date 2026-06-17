-- =====================================================================
-- 2026-06-18: security_events (セキュリティ操作履歴)
-- =====================================================================
--
-- 平たく言うと:
-- 「受講生のパスワード変更等、 セキュリティ系操作の履歴を残す箱」 。
-- 用途:
--   1. 受講生本人が「いつパスワード変えたか」 を確認できる
--   2. 管理者 (のり氏 + きよむさん) が受講生ハブ画面で確認できる
--   3. 不正乗っ取り発生時の調査に使える
--
-- 線① の対象 event_type:
--   - password_changed: パスワード変更
--
-- 線② 拡張予定 event_type (CHECK 制約はその時拡張):
--   - email_changed: メールアドレス変更
--   - login_failed: ログイン失敗 (連続検出時のみ)
--
-- INSERT は service_role のみ。 受講生・管理者は SELECT のみ可。

create table if not exists public.security_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  event_type  text not null check (event_type in ('password_changed')),
  occurred_at timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_security_events_user_occurred
  on public.security_events(user_id, occurred_at desc);

alter table public.security_events enable row level security;

-- 受講生本人 SELECT
drop policy if exists "security_events: self select" on public.security_events;
create policy "security_events: self select" on public.security_events
  for select using (auth.uid() = user_id);

-- 管理者 SELECT (全受講生分)
drop policy if exists "security_events: admin select" on public.security_events;
create policy "security_events: admin select" on public.security_events
  for select using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid() and is_active = true
    )
  );

-- INSERT/UPDATE/DELETE は service_role のみ (= ポリシー定義しない = 全拒否)

comment on table public.security_events is
  '線① 設定画面 (2026-06-18) ・ パスワード変更等の操作履歴。 service_role のみが INSERT 可能。';
