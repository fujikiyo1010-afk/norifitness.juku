-- =====================================================================
-- 2026-06-18: chat (conversations + messages)
-- =====================================================================
--
-- 平たく言うと:
-- 「受講生 ↔ のり氏 (admin) の 1:1 チャット箱」 。
-- 受講生はホーム → /messages で送る + 受信、 のり氏は /admin/messages で
-- 全受講生の受信箱を一覧 → 個別チャット画面で返信。
--
-- 仕様 (2026-06-18 きよむさん確定):
--   - 1 受講生 = 1 conversation (= unique constraint)
--   - 既読管理は last_read_at_user / last_read_at_admin の 2 タイムスタンプ
--   - 未読数 = 「last_read_at 以降に created_at される他者の messages 数」
--   - sender_kind = 'user' or 'admin'
--
-- 関連 memory: project-kinniku-juku-line2-deferred-features
-- (旧 LINE サポートタイル の代替として 線① で実装に格上げ)

create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  last_message_at     timestamptz not null default now(),
  last_read_at_user   timestamptz,                   -- 受講生が最後に読んだ時刻
  last_read_at_admin  timestamptz,                   -- admin が最後に読んだ時刻
  unique (user_id)
);

create index if not exists idx_conversations_last_message
  on public.conversations(last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_kind     text not null check (sender_kind in ('user', 'admin')),
  sender_id       uuid not null,                     -- user_id or admin_users.id
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_conv_created
  on public.messages(conversation_id, created_at desc);

-- ─────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations: 受講生は自分の行、 admin は全件
drop policy if exists "conversations: self select" on public.conversations;
create policy "conversations: self select" on public.conversations
  for select using (auth.uid() = user_id);

drop policy if exists "conversations: self insert" on public.conversations;
create policy "conversations: self insert" on public.conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "conversations: self update" on public.conversations;
create policy "conversations: self update" on public.conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conversations: admin select" on public.conversations;
create policy "conversations: admin select" on public.conversations
  for select using (public.is_admin());

drop policy if exists "conversations: admin update" on public.conversations;
create policy "conversations: admin update" on public.conversations
  for update using (public.is_admin()) with check (public.is_admin());

-- messages: 受講生は自分の conversation の messages のみ
drop policy if exists "messages: user select" on public.messages;
create policy "messages: user select" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages: user insert" on public.messages;
create policy "messages: user insert" on public.messages
  for insert with check (
    sender_kind = 'user'
    and sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- admin は全件 SELECT + admin として INSERT
drop policy if exists "messages: admin select" on public.messages;
create policy "messages: admin select" on public.messages
  for select using (public.is_admin());

drop policy if exists "messages: admin insert" on public.messages;
create policy "messages: admin insert" on public.messages
  for insert with check (
    public.is_admin()
    and sender_kind = 'admin'
    and sender_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────
-- TRIGGER: messages 挿入時に conversations.last_message_at を更新
-- ─────────────────────────────────────────────────────────

create or replace function public.update_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = NEW.created_at
    where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists trg_messages_update_conv on public.messages;
create trigger trg_messages_update_conv
  after insert on public.messages
  for each row execute function public.update_conversation_last_message_at();

-- ─────────────────────────────────────────────────────────
-- Realtime 有効化 (Supabase Dashboard でも要設定だが、 publication 経由でも可)
-- ─────────────────────────────────────────────────────────

-- conversations + messages を supabase_realtime publication に追加
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

comment on table public.conversations is
  '線① in-app チャット (2026-06-18) ・1 受講生 = 1 conversation';
comment on table public.messages is
  '線① in-app チャット messages ・sender_kind = user or admin';
