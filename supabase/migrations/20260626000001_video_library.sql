-- 2026-06-26 きよむさん指示: 動画ライブラリ
--
-- 目的: 管理画面で動画(Vimeo URL)を「引き出し」として登録しておき、
--       レッスン編集などで検索して選べるようにする。
--
-- 方針:
--   - usage で用途を分ける ('lesson' = コースレッスン用 / 'menu' = 筋トレメニュー用)
--   - 同じ動画を lesson と menu の両方に登録するのはOK (usage が違えば別行 = 重複OK)
--   - 同一 usage 内での URL 重複は禁止 (unique index)
--   - v1 では usage='lesson' のみ実運用。メニュー用タブは既存の
--     workout_exercise_video_master.json (151本) を読み取り表示する想定。
--   - title / thumbnail_url / duration_sec は登録/取込時に Vimeo oEmbed から取得して保存。

create table public.video_library (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  vimeo_url     text not null,
  usage         text not null check (usage in ('lesson', 'menu')),
  thumbnail_url text,
  duration_sec  integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 同一 usage 内の URL 重複防止 (lesson/menu をまたいだ重複は許可)
create unique index uniq_video_library_usage_url
  on public.video_library(usage, vimeo_url);

create index idx_video_library_usage
  on public.video_library(usage, created_at desc);

create trigger trg_video_library_updated_at
  before update on public.video_library
  for each row execute function public.set_updated_at();

alter table public.video_library enable row level security;

-- 管理者のみ全操作可 (受講生はアクセス不可)
create policy "video_library: admin all"
  on public.video_library for all
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.video_library is
  '管理画面で登録する動画の引き出し。usage=lesson/menu で用途分離(両方登録OK)。レッスン編集等で検索して選ぶ。';
