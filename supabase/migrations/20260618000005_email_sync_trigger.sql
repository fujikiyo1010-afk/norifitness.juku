-- =====================================================================
-- 2026-06-18: auth.users.email → public.users.email 自動同期 trigger
-- =====================================================================
--
-- 平たく言うと:
-- 「受講生が /account/email でメアド変更 → 新メールでリンク確認 →
--  Supabase が auth.users.email を更新 → このトリガーで public.users.email も同期」
--
-- なぜ必要か:
--   - 管理画面 (/admin/users/[id], /admin/messages 等) は public.users.email を表示
--   - 自動同期がないと、 受講生が変更しても管理画面側は古いまま
--
-- 関連 memory: project-kinniku-juku-handoff (#8 メール変更)

create or replace function public.sync_auth_email_to_public_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.email is distinct from OLD.email then
    update public.users
       set email = NEW.email
     where id = NEW.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_auth_email on auth.users;
create trigger trg_sync_auth_email
  after update of email on auth.users
  for each row execute function public.sync_auth_email_to_public_users();

comment on function public.sync_auth_email_to_public_users() is
  '線① #8 メール変更 (2026-06-18) ・auth.users.email が変わったら public.users.email も同期';
