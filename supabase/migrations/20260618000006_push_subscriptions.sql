-- =====================================================================
-- 2026-06-18: push_subscriptions (Web Push 購読)
-- =====================================================================
--
-- 平たく言うと:
-- 「端末ごとに『通知届けていいよ』 とお墨付きをもらった証 (subscription) を保管する箱」 。
-- 1 受講生が複数端末 (iPhone + iPad + PC ブラウザ等) で許可した場合、 行が複数になる。
--
-- 仕様:
--   - endpoint = 端末ユニーク URL (= Push Service が発行)、 unique
--   - p256dh / auth = 暗号鍵 (端末側で生成、 サーバが Push 内容を暗号化するのに使う)
--   - user_agent = デバッグ用 (どの端末か推測)
--   - last_used_at = 直近送信成功時刻 (失効判定の参考)
--
-- RLS:
--   - 受講生は自分の subscription のみ insert / select / delete
--   - admin (= superadmin/admin) は全件 select 可 (送信先一覧のため、 ただし本番送信は service_role 経由)

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- 受講生は自分のもののみ
create policy push_subscriptions_user_select
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy push_subscriptions_user_insert
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy push_subscriptions_user_delete
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- admin は全件閲覧可
create policy push_subscriptions_admin_select
  on public.push_subscriptions for select
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid() and admin_users.is_active = true
    )
  );
