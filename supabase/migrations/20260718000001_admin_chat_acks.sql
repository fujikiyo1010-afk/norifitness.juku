-- 管理ホーム「チャット未返信」警報の手動「完了にする」(案A・返信不要マーク)
-- 2026-07-18。自動計算の警報を、返信せず手動で片付けられるようにする。
--   仕組み: 押した時刻(acked_at)を記録。警報計算時「受講生の最終発言 <= acked_at」なら抑制。
--   受講生が新しく発言すると発言時刻 > acked_at になり、警報は自動で再表示される(=案A)。
-- 1受講生 = 1行(upsertで最新の確認時刻に上書き)。
create table if not exists public.admin_chat_acks (
  user_id   uuid primary key references public.users(id) on delete cascade,
  acked_at  timestamptz not null default now(),
  acked_by  uuid references public.admin_users(id) on delete set null
);

alter table public.admin_chat_acks enable row level security;

-- 管理者のみ全操作(管理画面専用・受講生からは触れない)
drop policy if exists "admin_chat_acks: admin all" on public.admin_chat_acks;
create policy "admin_chat_acks: admin all"
  on public.admin_chat_acks for all
  using (public.is_admin())
  with check (public.is_admin());
