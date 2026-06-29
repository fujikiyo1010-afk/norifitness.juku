-- 2026-06-29 D-2: ログイン連続失敗の検知 → 管理者通知
--
-- 方針:
--   - ログイン失敗を email 単位でカウント (signIn 失敗時に service role で記録)
--   - 一定回数(=5)連続失敗で管理者へセキュリティ通知メール (再通知は間引く)
--   - ハードロックは作らない (Supabase 標準のレート制限に委ねる)
--   - ログイン成功で当該 email の行を削除 (= リセット)
--
-- アクセスは service role (RLS バイパス) のみ書き込み。admin は閲覧可(将来UI用)。

create table public.login_attempts (
  email           text primary key,
  failed_count    integer not null default 0,
  first_failed_at timestamptz,
  last_failed_at  timestamptz,
  notified_at     timestamptz
);

alter table public.login_attempts enable row level security;

create policy "login_attempts: admin select"
  on public.login_attempts for select
  using (public.is_admin());

comment on table public.login_attempts is
  'ログイン連続失敗の検知用(D-2)。email単位の失敗回数。5回で管理者通知。成功で削除。';
