-- チャット画像添付(2026-07-31・段4)。管理者→受講生の画像送信。
--   - messages に画像パス2列を追加(フル/サムネ・いずれも chat-images バケットのパス)。
--   - 非公開バケット chat-images。表示は署名URL(サーバ=service role が発行)。
--   - 30日で cron 削除(/api/cron/chat-image-cleanup)。表示側は created_at>30日で「期限切れ」。
alter table public.messages add column if not exists image_path text;
alter table public.messages add column if not exists image_thumb_path text;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

-- 直接アクセスは管理者のみ(署名URLはサーバ side=service role が発行しRLSをバイパス)。
drop policy if exists "chat-images: admin all" on storage.objects;
create policy "chat-images: admin all"
  on storage.objects for all
  using (bucket_id = 'chat-images' and public.is_admin())
  with check (bucket_id = 'chat-images' and public.is_admin());
