-- =====================================================================
-- 2026-07-06: 体型ビフォーアフター写真 (body_photos) ＋ プライベート bucket
-- =====================================================================
--
-- 体組成セクション改修の一部。受講生が体型写真を記録し、
-- 詳細画面「ウエスト＋写真」タブでビフォーアフター＋タイムライン表示する。
--
-- 方針:
--   - 画像は プライベート bucket 'body-photos' に保存 (公開しない・署名URLで表示)。
--   - パス規約: {user_id}/{任意ファイル名}  (RLS を folder=user_id で効かせる)
--   - クライアント側で圧縮 (長辺〜1080px/JPEG) + EXIF 回転してからアップロード。
--   - 管理者の写真閲覧UIは後回し (= select ポリシーだけ先に用意し、UIは別途)。

-- --- テーブル ---------------------------------------------------------
create table if not exists public.body_photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  recorded_at   date not null,                 -- 撮影/記録対象日
  storage_path  text not null,                 -- 'body-photos' bucket 内のパス ({user_id}/xxx.jpg)
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_body_photos_user_date
  on public.body_photos(user_id, recorded_at desc, created_at desc);

alter table public.body_photos enable row level security;

-- 受講生: 自分のみ CRUD
create policy "body_photos: self select"
  on public.body_photos for select
  using (auth.uid() = user_id);
create policy "body_photos: self insert"
  on public.body_photos for insert
  with check (auth.uid() = user_id);
create policy "body_photos: self delete"
  on public.body_photos for delete
  using (auth.uid() = user_id);

-- 管理者: 全件閲覧 (UIは後回し・ポリシーのみ先行)
create policy "body_photos: admin select"
  on public.body_photos for select
  using (public.is_admin());

-- --- Storage bucket (プライベート) -----------------------------------
insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false)
on conflict (id) do nothing;

-- Storage RLS: {user_id}/... のフォルダ規約で本人のみ
create policy "body-photos: self read"
  on storage.objects for select
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "body-photos: self insert"
  on storage.objects for insert
  with check (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "body-photos: self delete"
  on storage.objects for delete
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 管理者: 全件閲覧 (後回しUI用)
create policy "body-photos: admin read"
  on storage.objects for select
  using (bucket_id = 'body-photos' and public.is_admin());
