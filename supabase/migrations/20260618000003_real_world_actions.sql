-- =====================================================================
-- 2026-06-18: real_world_actions (実践リスト)
-- =====================================================================
--
-- 平たく言うと:
-- 「レッスン視聴後、 『今週これを試す』 と 1 行宣言 → 試したらチェック → 振り返り記入」
-- 学習サイクルの完結 = Feynman 振り返り + 実生活適用。
-- のりfitness「自走できる卒業」 思想と整合。
--
-- 設計方針 (2026-06-17/18 きよむさん確定):
--   - 目標シート連携なし、 完全独立運用
--   - lesson_id は任意 (NULL 可) = レッスン外で自発作成も可
--   - 「今週」 は宣言文、 自動期限切れ等のシステム的プレッシャーなし
--   - tried (= 試したか) と reflection (= 振り返り) は別カラム
--   - reflection は任意 (= 書かなくても tried=true にできる)
--
-- 関連 memory: project-kinniku-juku-line2-deferred-features (旧線② 持ち越し → 線①で実装に格上げ)

create table if not exists public.real_world_actions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  lesson_id       uuid references public.lessons(id) on delete set null,  -- 任意 (= 自発作成可)
  planned_action  text not null,                                          -- 「今週これを試す」 宣言 (1-2 行)
  tried           boolean not null default false,
  tried_at        timestamptz,                                            -- tried=true セット時に NOW()
  reflection      text,                                                   -- 「やってみて分かったこと」 (任意)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_real_world_actions_user_tried_created
  on public.real_world_actions(user_id, tried, created_at desc);

create index if not exists idx_real_world_actions_lesson
  on public.real_world_actions(lesson_id)
  where lesson_id is not null;

create trigger trg_real_world_actions_updated_at
  before update on public.real_world_actions
  for each row execute function public.set_updated_at();

alter table public.real_world_actions enable row level security;

-- 受講生: 自分のみ CRUD
create policy "real_world_actions: self select"
  on public.real_world_actions for select
  using (auth.uid() = user_id);
create policy "real_world_actions: self insert"
  on public.real_world_actions for insert
  with check (auth.uid() = user_id);
create policy "real_world_actions: self update"
  on public.real_world_actions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "real_world_actions: self delete"
  on public.real_world_actions for delete
  using (auth.uid() = user_id);

-- 管理者: 全件閲覧 (将来「受講生がどんなアクション宣言しているか」 を把握できるよう)
create policy "real_world_actions: admin select"
  on public.real_world_actions for select
  using (public.is_admin());

comment on table public.real_world_actions is
  '線① 実践リスト (2026-06-18) ・ レッスン後の「今週これを試す」 宣言 → 試したらチェック → 振り返り記入 ・ 目標シート連携なし単独運用';
