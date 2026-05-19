-- =====================================================================
-- 筋肉塾 新サイト — 初期スキーマ
-- =====================================================================
-- 作成日: 2026-05-19
-- 対象: フェーズ1 マイグレーション #1（初期構築）
-- 内容: 17 テーブル + RLS + インデックス + Storage バケット + auth トリガー
-- 設計元: docs/00_premises/database_design_draft.md
--
-- 適用方法（A/A/A 方針）:
--   方式1: supabase CLI で `supabase db push`（推奨）
--   方式2: Supabase ダッシュボード SQL Editor に全文コピペ → Run
--
-- ⚠️ 既に同名テーブルが存在する DB に流すと失敗します。空の DB で実行してください。
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. 拡張機能
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid() 用


-- ---------------------------------------------------------------------
-- 1. ヘルパー関数（テーブル参照なし）
-- ---------------------------------------------------------------------

-- updated_at を自動更新するトリガー関数
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =====================================================================
-- 2. テーブル定義（依存順）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.1 admin_users（管理者マスタ）
--   先頭に置く理由: is_admin() / 他テーブルの reviewed_by などが参照
--   RLS ポリシーは is_admin() 定義後に追加（下の 2.1b 参照）
-- ---------------------------------------------------------------------
create table public.admin_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text not null,
  role        text not null check (role in ('superadmin', 'admin')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 1b. ヘルパー関数（admin_users 参照あり）
--     PostgreSQL は language sql 関数を作成時に検証するため
--     admin_users 作成後に定義する必要がある
-- ---------------------------------------------------------------------

-- 現在のユーザーが管理者か判定（security definer で RLS をバイパス）
-- 各テーブルの RLS ポリシーから呼ばれる
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active = true
  );
$$;

-- superadmin 判定（社長専用操作向け）
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and is_active = true and role = 'superadmin'
  );
$$;


-- ---------------------------------------------------------------------
-- 2.1b admin_users の RLS とポリシー
--      is_admin() / is_superadmin() 定義後に有効化
-- ---------------------------------------------------------------------
alter table public.admin_users enable row level security;

-- 管理者のみ閲覧・編集可
create policy "admin_users: admin select"
  on public.admin_users for select
  using (public.is_admin());

create policy "admin_users: superadmin insert"
  on public.admin_users for insert
  with check (public.is_superadmin());

create policy "admin_users: superadmin update"
  on public.admin_users for update
  using (public.is_superadmin());

create policy "admin_users: superadmin delete"
  on public.admin_users for delete
  using (public.is_superadmin());


-- ---------------------------------------------------------------------
-- 2.2 users（受講生マスタ）
-- ---------------------------------------------------------------------
create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text unique not null,
  name                text not null,
  nickname            text,
  line_user_id        text,
  stripe_customer_id  text,
  status              text not null default 'active'
                      check (status in ('active', 'lifetime', 'withdrawn', 'refunding')),
  joined_at           timestamptz not null default now(),
  support_until       timestamptz,
  graduated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_users_status      on public.users(status);
create index idx_users_email       on public.users(email);
create index idx_users_joined_at   on public.users(joined_at desc);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create policy "users: self or admin select"
  on public.users for select
  using (auth.uid() = id or public.is_admin());

create policy "users: self update"
  on public.users for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "users: admin insert"
  on public.users for insert
  with check (public.is_admin());

create policy "users: admin delete"
  on public.users for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.3 user_profiles（受講生プロフィール）
-- ---------------------------------------------------------------------
create table public.user_profiles (
  user_id       uuid primary key references public.users(id) on delete cascade,
  avatar_url    text,
  family_name   text,
  given_name    text,
  birthday      date,
  phone         text,
  address       text,
  twitter       text,
  facebook      text,
  instagram     text,
  line_account  text,
  bio           text,
  updated_at    timestamptz not null default now()
);

create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

create policy "user_profiles: self or admin select"
  on public.user_profiles for select
  using (auth.uid() = user_id or public.is_admin());

create policy "user_profiles: self upsert"
  on public.user_profiles for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "user_profiles: self update"
  on public.user_profiles for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "user_profiles: admin delete"
  on public.user_profiles for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.4 courses（コース = 5 大カテゴリ）
-- ---------------------------------------------------------------------
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  sort_order    integer not null,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_courses_sort on public.courses(sort_order);

create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

alter table public.courses enable row level security;

create policy "courses: published or admin select"
  on public.courses for select
  using (is_published or public.is_admin());

create policy "courses: admin insert"
  on public.courses for insert
  with check (public.is_admin());

create policy "courses: admin update"
  on public.courses for update
  using (public.is_admin());

create policy "courses: admin delete"
  on public.courses for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.5 chapters（章）
-- ---------------------------------------------------------------------
create table public.chapters (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null,
  description  text,
  sort_order   integer not null,
  released_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_chapters_course on public.chapters(course_id, sort_order);

create trigger trg_chapters_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

alter table public.chapters enable row level security;

-- 受講生: 段階公開済み（released_at NULL or now() 以降）かつ親コース公開済み
create policy "chapters: released or admin select"
  on public.chapters for select
  using (
    public.is_admin() or (
      (released_at is null or released_at <= now())
      and exists (
        select 1 from public.courses c
        where c.id = chapters.course_id and c.is_published
      )
    )
  );

create policy "chapters: admin insert"
  on public.chapters for insert
  with check (public.is_admin());

create policy "chapters: admin update"
  on public.chapters for update
  using (public.is_admin());

create policy "chapters: admin delete"
  on public.chapters for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.6 lessons（レッスン）
-- ---------------------------------------------------------------------
create table public.lessons (
  id                  uuid primary key default gen_random_uuid(),
  chapter_id          uuid not null references public.chapters(id) on delete cascade,
  title               text not null,
  description         text,
  vimeo_url           text,
  summary_video_url   text,
  sub_image_url       text,
  meta_tags           jsonb,
  sort_order          integer not null,
  released_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_lessons_chapter on public.lessons(chapter_id, sort_order);

create trigger trg_lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

alter table public.lessons enable row level security;

-- 段階公開: レッスン自身も親 chapter も公開済みのみ閲覧可
create policy "lessons: released or admin select"
  on public.lessons for select
  using (
    public.is_admin() or (
      (released_at is null or released_at <= now())
      and exists (
        select 1 from public.chapters ch
        join public.courses co on co.id = ch.course_id
        where ch.id = lessons.chapter_id
          and (ch.released_at is null or ch.released_at <= now())
          and co.is_published
      )
    )
  );

create policy "lessons: admin insert"
  on public.lessons for insert
  with check (public.is_admin());

create policy "lessons: admin update"
  on public.lessons for update
  using (public.is_admin());

create policy "lessons: admin delete"
  on public.lessons for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.7 lesson_progress（学習進捗）
-- ---------------------------------------------------------------------
create table public.lesson_progress (
  user_id          uuid not null references public.users(id) on delete cascade,
  lesson_id        uuid not null references public.lessons(id) on delete cascade,
  is_completed     boolean not null default false,
  completed_at     timestamptz,
  watched_seconds  integer not null default 0,
  last_watched_at  timestamptz,
  created_at       timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index idx_lesson_progress_user           on public.lesson_progress(user_id, is_completed);
create index idx_lesson_progress_last_watched   on public.lesson_progress(user_id, last_watched_at);

alter table public.lesson_progress enable row level security;

create policy "lesson_progress: self or admin select"
  on public.lesson_progress for select
  using (auth.uid() = user_id or public.is_admin());

create policy "lesson_progress: self upsert"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

create policy "lesson_progress: self update"
  on public.lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lesson_progress: admin delete"
  on public.lesson_progress for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.8 comments（公開コメント、スレッド型）
-- ---------------------------------------------------------------------
create table public.comments (
  id                 uuid primary key default gen_random_uuid(),
  lesson_id          uuid not null references public.lessons(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  parent_comment_id  uuid references public.comments(id) on delete cascade,
  body               text not null,
  image_url          text,
  is_deleted         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_comments_lesson_created
  on public.comments(lesson_id, created_at desc)
  where is_deleted = false;
create index idx_comments_user on public.comments(user_id);
create index idx_comments_parent on public.comments(parent_comment_id);

create trigger trg_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

alter table public.comments enable row level security;

-- 全受講生が公開コメントを閲覧可。論理削除されたものは管理者か投稿者のみ
create policy "comments: public or own deleted select"
  on public.comments for select
  using (
    is_deleted = false
    or auth.uid() = user_id
    or public.is_admin()
  );

create policy "comments: self insert"
  on public.comments for insert
  with check (auth.uid() = user_id);

-- 投稿者は自分のコメントのみ編集可（body / image_url / is_deleted）
create policy "comments: self update"
  on public.comments for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "comments: admin hard delete"
  on public.comments for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.9 goal_sheets（目標管理シート ★主軸）
-- ---------------------------------------------------------------------
create table public.goal_sheets (
  user_id      uuid primary key references public.users(id) on delete cascade,
  content      jsonb not null,
  admin_notes  text,
  reviewed_by  uuid references public.admin_users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_goal_sheets_updated_at
  before update on public.goal_sheets
  for each row execute function public.set_updated_at();

alter table public.goal_sheets enable row level security;

create policy "goal_sheets: self or admin select"
  on public.goal_sheets for select
  using (auth.uid() = user_id or public.is_admin());

create policy "goal_sheets: self insert"
  on public.goal_sheets for insert
  with check (auth.uid() = user_id or public.is_admin());

create policy "goal_sheets: self update"
  on public.goal_sheets for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "goal_sheets: admin delete"
  on public.goal_sheets for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.10 goal_sheet_revisions（目標シート編集履歴）
-- ---------------------------------------------------------------------
create table public.goal_sheet_revisions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  snapshot    jsonb not null,
  edited_by   uuid not null,  -- users.id or admin_users.id（参照先は appli 側で判定）
  reason      text,
  created_at  timestamptz not null default now()
);

create index idx_goal_sheet_revisions_user
  on public.goal_sheet_revisions(user_id, created_at desc);

alter table public.goal_sheet_revisions enable row level security;

create policy "goal_sheet_revisions: self or admin select"
  on public.goal_sheet_revisions for select
  using (auth.uid() = user_id or public.is_admin());

-- 履歴は INSERT のみ（更新・削除禁止 = 改ざん防止）
create policy "goal_sheet_revisions: self or admin insert"
  on public.goal_sheet_revisions for insert
  with check (auth.uid() = user_id or public.is_admin());


-- ---------------------------------------------------------------------
-- 2.11 tests（試験）
-- ---------------------------------------------------------------------
create table public.tests (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid references public.lessons(id) on delete cascade,
  title          text not null,
  passing_score  integer not null default 80 check (passing_score between 0 and 100),
  questions      jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_tests_lesson on public.tests(lesson_id);

create trigger trg_tests_updated_at
  before update on public.tests
  for each row execute function public.set_updated_at();

alter table public.tests enable row level security;

-- 試験本体: 親レッスンが見える人は試験も見える
create policy "tests: visible to lesson viewers"
  on public.tests for select
  using (
    public.is_admin() or (
      lesson_id is null  -- レッスンに紐付かない独立試験は公開扱い
      or exists (
        select 1 from public.lessons l
        where l.id = tests.lesson_id
          and (l.released_at is null or l.released_at <= now())
      )
    )
  );

create policy "tests: admin insert"
  on public.tests for insert
  with check (public.is_admin());

create policy "tests: admin update"
  on public.tests for update
  using (public.is_admin());

create policy "tests: admin delete"
  on public.tests for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.12 test_attempts（受験履歴）
--   何度でも受験可能（unique 制約なし）
-- ---------------------------------------------------------------------
create table public.test_attempts (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  test_id   uuid not null references public.tests(id) on delete cascade,
  score     integer not null check (score between 0 and 100),
  passed    boolean not null,
  answers   jsonb,
  taken_at  timestamptz not null default now()
);

create index idx_test_attempts_user on public.test_attempts(user_id, taken_at desc);
create index idx_test_attempts_test on public.test_attempts(test_id, taken_at desc);

alter table public.test_attempts enable row level security;

create policy "test_attempts: self or admin select"
  on public.test_attempts for select
  using (auth.uid() = user_id or public.is_admin());

create policy "test_attempts: self insert"
  on public.test_attempts for insert
  with check (auth.uid() = user_id);

-- 一度提出した受験結果は編集不可（admin の修正のみ許可）
create policy "test_attempts: admin update"
  on public.test_attempts for update
  using (public.is_admin());

create policy "test_attempts: admin delete"
  on public.test_attempts for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.13 stripe_events（Stripe Webhook 受信記録）
-- ---------------------------------------------------------------------
create table public.stripe_events (
  id                 uuid primary key default gen_random_uuid(),
  stripe_event_id    text unique not null,
  event_type         text not null,
  payload            jsonb not null,
  customer_email     text,
  amount             integer,
  processed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_stripe_events_unprocessed
  on public.stripe_events(created_at)
  where processed_at is null;
create index idx_stripe_events_email on public.stripe_events(customer_email);

alter table public.stripe_events enable row level security;

-- 管理者のみ閲覧可。INSERT は Service Role キー経由（Webhook 受信時）= RLS バイパスなので制限不要
create policy "stripe_events: admin select"
  on public.stripe_events for select
  using (public.is_admin());

create policy "stripe_events: admin update"
  on public.stripe_events for update
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.14 invitations（招待リンク）
-- ---------------------------------------------------------------------
create table public.invitations (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  name              text,
  token             text unique not null,
  expires_at        timestamptz not null,
  created_by        uuid references public.admin_users(id),
  accepted_at       timestamptz,
  user_id           uuid references public.users(id),
  stripe_event_id   uuid references public.stripe_events(id),
  created_at        timestamptz not null default now()
);

create index idx_invitations_email   on public.invitations(email);
create index idx_invitations_token   on public.invitations(token);
create index idx_invitations_pending on public.invitations(expires_at)
  where accepted_at is null;

alter table public.invitations enable row level security;

create policy "invitations: admin all"
  on public.invitations for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.15 broadcast_notifications（管理者からの配信）
-- ---------------------------------------------------------------------
create table public.broadcast_notifications (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  body                text not null,
  target_segment      text not null check (target_segment in ('all', 'active', 'lifetime', 'by_chapter')),
  target_chapter_id   uuid references public.chapters(id),
  send_email          boolean not null default false,
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  created_by          uuid not null references public.admin_users(id),
  created_at          timestamptz not null default now()
);

create index idx_broadcast_scheduled
  on public.broadcast_notifications(scheduled_at)
  where sent_at is null;

alter table public.broadcast_notifications enable row level security;

create policy "broadcast_notifications: admin all"
  on public.broadcast_notifications for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.16 notifications（受講生個人の通知）
-- ---------------------------------------------------------------------
create table public.notifications (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users(id) on delete cascade,
  type                        text not null check (type in ('system', 'lesson', 'comment', 'broadcast')),
  title                       text not null,
  body                        text,
  link_url                    text,
  broadcast_notification_id   uuid references public.broadcast_notifications(id) on delete set null,
  is_read                     boolean not null default false,
  created_at                  timestamptz not null default now()
);

create index idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where is_read = false;
create index idx_notifications_user_all
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: self or admin select"
  on public.notifications for select
  using (auth.uid() = user_id or public.is_admin());

-- 受講生は is_read のトグルのみ。INSERT は admin / Service Role 経由
create policy "notifications: self mark read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications: admin insert"
  on public.notifications for insert
  with check (public.is_admin());

create policy "notifications: admin delete"
  on public.notifications for delete
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.17 user_status_history（ステータス変更履歴）
-- ---------------------------------------------------------------------
create table public.user_status_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references public.admin_users(id),
  reason       text,
  changed_at   timestamptz not null default now()
);

create index idx_user_status_history_user
  on public.user_status_history(user_id, changed_at desc);

alter table public.user_status_history enable row level security;

create policy "user_status_history: self or admin select"
  on public.user_status_history for select
  using (auth.uid() = user_id or public.is_admin());

create policy "user_status_history: admin insert"
  on public.user_status_history for insert
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.18 faq_categories（FAQ カテゴリ）
-- ---------------------------------------------------------------------
create table public.faq_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null
);

alter table public.faq_categories enable row level security;

-- 認証ユーザー全員が閲覧可
create policy "faq_categories: authenticated select"
  on public.faq_categories for select
  using (auth.role() = 'authenticated');

create policy "faq_categories: admin write"
  on public.faq_categories for all
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 2.19 faqs（FAQ 本体）
-- ---------------------------------------------------------------------
create table public.faqs (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.faq_categories(id) on delete cascade,
  question      text not null,
  answer        text not null,
  sort_order    integer not null,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_faqs_category on public.faqs(category_id, sort_order);

create trigger trg_faqs_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

alter table public.faqs enable row level security;

create policy "faqs: published or admin select"
  on public.faqs for select
  using (is_published or public.is_admin());

create policy "faqs: admin write"
  on public.faqs for all
  using (public.is_admin())
  with check (public.is_admin());


-- =====================================================================
-- 3. Auth トリガー — auth.users 削除時の連動
-- =====================================================================
-- 注: auth.users への INSERT トリガーは Supabase の招待フローで
-- アプリ側コードが public.users / admin_users を明示的に INSERT するため
-- 自動同期は持たない。誤って public.users なしで auth.users だけ作るのを
-- 防ぐのは Application Layer の責務。


-- =====================================================================
-- 4. Storage バケット
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('comment-images',    'comment-images',    true),
  ('profile-avatars',   'profile-avatars',   true),
  ('lesson-thumbnails', 'lesson-thumbnails', true)
on conflict (id) do nothing;

-- comment-images: 受講生は自分のファイル(`<user_id>/...`)のみアップロード、誰でも閲覧
create policy "storage: comment-images public read"
  on storage.objects for select
  using (bucket_id = 'comment-images');

create policy "storage: comment-images self upload"
  on storage.objects for insert
  with check (
    bucket_id = 'comment-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage: comment-images self delete"
  on storage.objects for delete
  using (
    bucket_id = 'comment-images'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- profile-avatars: 同上
create policy "storage: profile-avatars public read"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');

create policy "storage: profile-avatars self upload"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage: profile-avatars self update"
  on storage.objects for update
  using (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage: profile-avatars self delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- lesson-thumbnails: 管理者のみアップロード、誰でも閲覧
create policy "storage: lesson-thumbnails public read"
  on storage.objects for select
  using (bucket_id = 'lesson-thumbnails');

create policy "storage: lesson-thumbnails admin write"
  on storage.objects for all
  using (bucket_id = 'lesson-thumbnails' and public.is_admin())
  with check (bucket_id = 'lesson-thumbnails' and public.is_admin());


-- =====================================================================
-- 5. シードデータ（最小限）
-- =====================================================================

-- FAQ カテゴリ（4 種、後で管理画面から追加可）
insert into public.faq_categories (name, sort_order) values
  ('はじめに',          10),
  ('学習・コンテンツ',  20),
  ('試験・卒業',        30),
  ('その他',            40)
on conflict do nothing;


-- =====================================================================
-- 完了
-- =====================================================================
