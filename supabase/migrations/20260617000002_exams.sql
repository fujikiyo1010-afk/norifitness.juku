-- 試験機能 (2026-06-17 線① 必須) ・ Saipon /site_api/exam? からの引っ越し
--
-- マッピング: Saipon exam.name == 我々の lessons.title (【テスト】 含む)
-- 採点: 正解数 / 全問数 × 100 (パーセント) >= passing_score で合格 (デフォルト 80)

-- =====================================================================
-- exams ・ 試験 (lesson に対して 1:1)
-- =====================================================================
create table public.exams (
  id                       uuid primary key default gen_random_uuid(),
  lesson_id                uuid not null references public.lessons(id) on delete cascade,
  saipon_question_box_id   integer,
  name                     text not null,
  passing_score            integer not null default 80
                           check (passing_score between 1 and 100),
  total_questions          integer not null default 0
                           check (total_questions >= 0),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index uq_exams_lesson_id on public.exams(lesson_id);
create index idx_exams_saipon_qid on public.exams(saipon_question_box_id);

create trigger trg_exams_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

alter table public.exams enable row level security;

create policy "exams: all read"
  on public.exams for select using (true);
create policy "exams: admin write"
  on public.exams for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- exam_questions ・ 問題 (exam に対して 1:N)
-- =====================================================================
create table public.exam_questions (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references public.exams(id) on delete cascade,
  saipon_question_id  integer,
  question_text       text not null,
  explanation         text,
  -- 正解 ・ exam_choices.id を後から埋める (循環 FK 回避のため uuid のみ)
  correct_choice_id   uuid,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);
create index idx_exam_questions_exam on public.exam_questions(exam_id, sort_order);

alter table public.exam_questions enable row level security;

create policy "exam_questions: all read"
  on public.exam_questions for select using (true);
create policy "exam_questions: admin write"
  on public.exam_questions for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- exam_choices ・ 選択肢 (question に対して 1:N)
-- =====================================================================
create table public.exam_choices (
  id                  uuid primary key default gen_random_uuid(),
  question_id         uuid not null references public.exam_questions(id) on delete cascade,
  saipon_choice_id    integer,
  label               text not null,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);
create index idx_exam_choices_question on public.exam_choices(question_id, sort_order);

alter table public.exam_choices enable row level security;

create policy "exam_choices: all read"
  on public.exam_choices for select using (true);
create policy "exam_choices: admin write"
  on public.exam_choices for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- exam_attempts ・ 受験記録 (user + exam に対して 1:N、 何回も挑戦可)
-- =====================================================================
create table public.exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  exam_id         uuid not null references public.exams(id) on delete cascade,
  score_percent   integer not null check (score_percent between 0 and 100),
  passed          boolean not null,
  -- answers = [{ question_id: uuid, selected_choice_id: uuid|null, is_correct: bool }]
  answers         jsonb not null default '[]'::jsonb,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz not null default now()
);
create index idx_exam_attempts_user on public.exam_attempts(user_id, finished_at desc);
create index idx_exam_attempts_user_exam on public.exam_attempts(user_id, exam_id, finished_at desc);

alter table public.exam_attempts enable row level security;

create policy "exam_attempts: self or admin select"
  on public.exam_attempts for select
  using (auth.uid() = user_id or public.is_admin());
create policy "exam_attempts: self insert"
  on public.exam_attempts for insert
  with check (auth.uid() = user_id);
create policy "exam_attempts: admin delete"
  on public.exam_attempts for delete
  using (public.is_admin());

comment on table public.exams is
  '試験 (lessons との 1:1 ・ Saipon /site_api/exam? からの引っ越し 2026-06-17)';
comment on column public.exam_questions.correct_choice_id is
  '正解の exam_choices.id (循環 FK 回避のため uuid のみ、 ETL 後に埋める)';
comment on column public.exam_attempts.answers is
  '[{ question_id, selected_choice_id, is_correct }] の配列。 集計用';
