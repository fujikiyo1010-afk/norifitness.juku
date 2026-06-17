-- 設定画面 ・ メール通知 ON/OFF (2026-06-17 線① 設定画面新設)
-- 受講生が自分の users 行を update できる RLS は既存 ("users: self update") を流用。

alter table public.users
  add column if not exists email_notification_enabled boolean not null default true;

comment on column public.users.email_notification_enabled is
  '線① /account 設定画面で受講生がメール通知 ON/OFF を切替。 デフォルト ON。';
