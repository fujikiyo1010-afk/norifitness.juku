-- お問い合わせ: 受講生が追記したら status を open(未対応)に戻す(2026-08-27)。
--
-- 背景:
--   受講生には support_tickets の UPDATE 権限が無い(指示書§4「updated_at を動かせるのは管理側だけ」)。
--   そのため こちらが返信して status='in_progress' になった後、受講生が追記しても
--   status は in_progress のまま固まり、「返信待ちなのに DB 上は対応済み」に見えてしまう。
--   → 管理画面の表示(未対応に戻る)と DB がズレ、集計や将来機能が取りこぼす。
--
-- 対策:
--   受講生メッセージの挿入時に、その件の status を open へ戻す(SECURITY DEFINER なので
--   受講生に追加の権限は不要)。これで status が「誰の番か」の正になり、
--   一覧のタブ・サイドバーの赤バッジを status だけで判定できる。
--
-- 安全弁:
--   ・sender_kind='admin' では発火しない(こちらの返信で開き直らない)
--   ・status='in_progress' の件だけが対象。resolved(解決済み)は対象外なので
--     「閉じた件が勝手に開き直る」ことは起きない。
--     ※そもそも解決済みでは受講生の入力欄が消えるため、user メッセージは発生しない。
--   ・open のままの件に対しては何も起きない(no-op)。
--
-- 前例: conversations の last_message 非正規化トリガ(20260731000002)と同じ作り。

create or replace function public.support_reopen_on_user_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.sender_kind = 'user' then
    update public.support_tickets
      set status = 'open',
          updated_at = now()
    where id = NEW.ticket_id
      and status = 'in_progress';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_support_reopen_on_user_message on public.support_messages;

create trigger trg_support_reopen_on_user_message
  after insert on public.support_messages
  for each row execute function public.support_reopen_on_user_message();
