-- =====================================================================
-- 2026-06-18: announcements (一斉アナウンス機能 ・ 線① C-1)
-- =====================================================================
--
-- 平たく言うと:
-- 「のり氏/きよむさんが 全受講生に一斉メールを送るための箱と履歴」 。
-- 利用規約改定 / メンテ告知 / インシデント告知 / お知らせ等に使う。
-- 送信した瞬間に行を update して sent_at + recipient_count を残す = 監査エビデンス。
--
-- 仕様:
--   - audience = 'all_active' のみサポート (= 線①、 セグメント分けは線②)
--   - include_opt_out_users = true なら email_notification_enabled=false の人にも強制送信
--     (= 規約改定 / インシデント告知 では true 推奨)
--   - status = 'draft' (作成のみ) / 'sent' (送信済)
--   - 送信後は内容変更不可 (= 履歴として残す前提)
--
-- RLS:
--   - 受講生は読めない (= admin 専用機能)
--   - admin (admin_users.is_active=true) は全 CRUD 可

create table if not exists public.announcements (
  id                       uuid primary key default gen_random_uuid(),
  subject                  text not null,
  body_text                text not null,
  audience                 text not null default 'all_active'
    check (audience in ('all_active')),
  include_opt_out_users    boolean not null default false,
  status                   text not null default 'draft'
    check (status in ('draft', 'sent')),
  created_by               uuid not null references public.admin_users(id) on delete restrict,
  created_at               timestamptz not null default now(),
  sent_at                  timestamptz,
  sent_by                  uuid references public.admin_users(id) on delete set null,
  recipient_count          integer
);

create index if not exists announcements_created_at_idx
  on public.announcements(created_at desc);

alter table public.announcements enable row level security;

create policy announcements_admin_all
  on public.announcements for all
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid() and admin_users.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid() and admin_users.is_active = true
    )
  );
