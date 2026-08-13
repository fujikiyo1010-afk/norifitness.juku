-- 受信箱/未対応バッジの軽量化(2026-07-31・段5)。
--   会話に「最新メッセージの sender / body」を持たせ、受信箱・未対応バッジが
--   全メッセージをスキャンしなくて済むようにする(=総メッセージ数に依存しない)。
--   既存の last_message_at 更新トリガを拡張(挿入時に sender/body も反映)。
alter table public.conversations add column if not exists last_message_sender text;
alter table public.conversations add column if not exists last_message_body text;

create or replace function public.update_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = NEW.created_at,
        last_message_sender = NEW.sender_kind,
        last_message_body = NEW.body
    where id = NEW.conversation_id;
  return NEW;
end;
$$;

-- 既存会話をバックフィル(各会話の最新メッセージから)。
update public.conversations c
set last_message_sender = m.sender_kind,
    last_message_body = m.body
from (
  select distinct on (conversation_id) conversation_id, sender_kind, body
  from public.messages
  order by conversation_id, created_at desc
) m
where m.conversation_id = c.id;
