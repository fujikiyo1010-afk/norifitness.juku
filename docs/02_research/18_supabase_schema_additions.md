# 18 Supabase スキーマ追加提案（+3 テーブル）

**作成日**: 2026-05-19
**位置づけ**: ⚠️ **提案レベル**。メイン実装チャットが採否判断・スタイル調整した上で migration 化してください。
**前提**: [database_design_draft.md](../00_premises/database_design_draft.md) の 16 テーブル + 既存 `supabase/migrations/20260519000001_initial_schema.sql` を尊重し、**既存のスタイル・命名規則・RLS パターンに完全準拠**。

---

## 🎯 目的

[07_wireframe_members.md](07_wireframe_members.md) v2.1 で統合した「学びを深める」5機能のうち、
3つを支える DB テーブルを提案する。

| 新テーブル | 対応する機能 |
|---|---|
| `lesson_reviews` | 📝 3行 振り返り |
| `lesson_bookmarks` | 🔖 動画の瞬間スクラップ |
| `real_world_actions` | 💪 実生活への落とし込み（目標シート連動） |

残り2機能（🌟 先輩からの一言、🔁 逆向き学習モード）は **既存テーブルで実現可能**:
- 先輩から一言 → `comments` に `is_alumni_pinned` カラム追加 or `graduate_voices`（将来統合予定）を活用
- 逆向き学習 → 既存 `tests` + `test_attempts` で実現可能、UI 上の表示順だけ変える

---

## 🛠 SQL 提案

### スタイル準拠ポイント（既存 migration から踏襲）

- ✅ 拡張: `pgcrypto` で `gen_random_uuid()` を使用（既存で有効化済）
- ✅ トリガー: `set_updated_at()` を再利用
- ✅ RLS ヘルパー: `is_admin()` / `is_superadmin()` を再利用
- ✅ 小文字 SQL
- ✅ コメントは日本語
- ✅ インデックス命名: `idx_<table>_<column>`
- ✅ トリガー命名: `trg_<table>_updated_at`
- ✅ ポリシー命名: `"<table>: <description>"`

---

### 1. `lesson_reviews` — 3行振り返り

```sql
-- ---------------------------------------------------------------------
-- 学習機能追加 1. lesson_reviews（3行振り返り）
-- ---------------------------------------------------------------------
-- 用途: レッスン視聴後に受講生が「学んだこと / 印象に残ったこと / 次やってみたいこと」
--       を3つの欄に書き残す。Feynman 技法による定着促進。
-- WF: 07_wireframe_members.md /contents/lessons/{id} 画面
-- 一覧画面: /profile/reviews
-- ---------------------------------------------------------------------
create table public.lesson_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  learned       text,                  -- 1. 学んだこと
  impressed     text,                  -- 2. 印象に残ったこと
  next_action   text,                  -- 3. 次にやってみたいこと
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 1ユーザー × 1レッスン = 1件（編集は同レコードで）
  unique (user_id, lesson_id)
);

create index idx_lesson_reviews_user      on public.lesson_reviews(user_id, created_at desc);
create index idx_lesson_reviews_lesson    on public.lesson_reviews(lesson_id);

create trigger trg_lesson_reviews_updated_at
  before update on public.lesson_reviews
  for each row execute function public.set_updated_at();

alter table public.lesson_reviews enable row level security;

create policy "lesson_reviews: self or admin select"
  on public.lesson_reviews for select
  using (auth.uid() = user_id or public.is_admin());

create policy "lesson_reviews: self insert"
  on public.lesson_reviews for insert
  with check (auth.uid() = user_id);

create policy "lesson_reviews: self update"
  on public.lesson_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lesson_reviews: self or admin delete"
  on public.lesson_reviews for delete
  using (auth.uid() = user_id or public.is_admin());
```

**判断ポイント**:
- 3カラム全部 NULL 許可（書きたい所だけ書ける）
- `unique (user_id, lesson_id)` で1レッスン1レコードに統一 → 編集は同レコード上書き
- 管理者からは閲覧可（受講生サポートに活用）、編集は本人のみ

---

### 2. `lesson_bookmarks` — 動画の瞬間スクラップ

```sql
-- ---------------------------------------------------------------------
-- 学習機能追加 2. lesson_bookmarks（動画の瞬間スクラップ）
-- ---------------------------------------------------------------------
-- 用途: 動画再生中に「この瞬間を保存」したい時にマーキング。
--       後でマイページから一覧→該当時刻にジャンプ。
-- WF: 07_wireframe_members.md レッスン画面 + /profile/bookmarks
-- ---------------------------------------------------------------------
create table public.lesson_bookmarks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  position_sec  integer not null check (position_sec >= 0),  -- 動画内の秒数
  label         text,                  -- 自分用ラベル（任意、UIで表示）
  note          text,                  -- 自分用メモ（任意）
  created_at    timestamptz not null default now()
);

create index idx_lesson_bookmarks_user
  on public.lesson_bookmarks(user_id, created_at desc);
create index idx_lesson_bookmarks_lesson
  on public.lesson_bookmarks(lesson_id, position_sec);

-- 注: updated_at なし（ブックマーク自体は時刻固定なので、編集時は note のみ）
-- 編集を許す場合は updated_at + トリガー追加を検討

alter table public.lesson_bookmarks enable row level security;

create policy "lesson_bookmarks: self or admin select"
  on public.lesson_bookmarks for select
  using (auth.uid() = user_id or public.is_admin());

create policy "lesson_bookmarks: self insert"
  on public.lesson_bookmarks for insert
  with check (auth.uid() = user_id);

create policy "lesson_bookmarks: self update"
  on public.lesson_bookmarks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lesson_bookmarks: self or admin delete"
  on public.lesson_bookmarks for delete
  using (auth.uid() = user_id or public.is_admin());
```

**判断ポイント**:
- `position_sec` で動画内の秒数を保存（Vimeo Player API から取得）
- ラベル・メモは任意。シンプルにポジションだけでもOK
- 同じレッスンの同じ位置に複数ブックマークもあり得る（学び直すたびに増える）→ UNIQUE 制約は付けない
- `updated_at` 不要と判断（保存後はそのまま）。編集 UI を作るなら追加

---

### 3. `real_world_actions` — 実生活への落とし込み

```sql
-- ---------------------------------------------------------------------
-- 学習機能追加 3. real_world_actions（実生活への落とし込み）
-- ---------------------------------------------------------------------
-- 用途: レッスン視聴後「今週、実生活でどう試すか」を1行宣言。
--       後で「試したか」「振り返り」を更新できる。
--       目標シート (/goal-sheet) と連動して一覧表示。
-- WF: 07_wireframe_members.md レッスン画面 + /goal-sheet
-- ---------------------------------------------------------------------
create table public.real_world_actions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  lesson_id       uuid references public.lessons(id) on delete set null,
                                  -- レッスン由来でない自発的な行動も保存可能
  planned_action  text not null,  -- 「月曜のジムで肩甲骨を意識して...」
  tried           boolean not null default false,
  reflection      text,           -- 試した後の振り返り（任意）
  planned_at      timestamptz not null default now(),
  tried_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_real_world_actions_user
  on public.real_world_actions(user_id, planned_at desc);
create index idx_real_world_actions_user_tried
  on public.real_world_actions(user_id, tried);

create trigger trg_real_world_actions_updated_at
  before update on public.real_world_actions
  for each row execute function public.set_updated_at();

alter table public.real_world_actions enable row level security;

create policy "real_world_actions: self or admin select"
  on public.real_world_actions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "real_world_actions: self insert"
  on public.real_world_actions for insert
  with check (auth.uid() = user_id);

create policy "real_world_actions: self update"
  on public.real_world_actions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "real_world_actions: self or admin delete"
  on public.real_world_actions for delete
  using (auth.uid() = user_id or public.is_admin());
```

**判断ポイント**:
- `lesson_id` は **任意**（受講生が自発的に「これやろう」と書く場合は NULL）
- `tried` フラグで「まだ / 試した」を切替、`tried_at` で完了日時記録
- `reflection` で「試してどうだったか」を書ける（学習サイクルを閉じる）
- 管理者は閲覧可（コーチング相当のフィードバックに活用）

---

## 🔁 「先輩からの一言」「逆向き学習」は新テーブル不要

### 先輩からの一言

既存テーブルで対応:
- **案A（簡易）**: `comments` テーブルに `is_alumni_pinned boolean default false` カラム追加。
  卒業生（`users.status = 'lifetime'` or `'graduated_at IS NOT NULL'`）が投稿したコメントを管理者が `is_alumni_pinned = true` でピン留め。
- **案B（将来）**: `graduate_voices` テーブル（将来統合予定）を活用し、レッスンに紐付けて表示。

```sql
-- 案A の場合の追加（既存 comments テーブルに）
alter table public.comments
  add column is_alumni_pinned boolean not null default false;

create index idx_comments_alumni_pinned
  on public.comments(lesson_id, is_alumni_pinned)
  where is_alumni_pinned = true;
```

### 逆向き学習モード

新テーブル不要。既存 `tests` / `test_attempts` テーブルで実現可能:
- UI で「試験を先に受ける」ボタンを置き、`test_attempts` に記録
- 不合格時の「該当レッスンに戻る」リンクは既存ロジックで対応

---

## 📋 採用判断のチェックリスト（メイン実装チャット向け）

メイン側で migration 化する前に確認していただきたい点:

- [ ] **3テーブルすべて必要か?** 一部だけ採用も可
- [ ] **命名規則**は既存スキーマと整合しているか確認
- [ ] **RLS パターン**は既存と同じ「self or admin」設計でOKか
- [ ] **`unique (user_id, lesson_id)`** 制約は妥当か（`lesson_reviews` のみ）
- [ ] **`comments.is_alumni_pinned`** 追加は必要か（先輩から一言機能を実装する場合のみ）
- [ ] **インデックス**は使用クエリに合っているか実装後にチューニング

---

## 🚧 注意

- 本ファイルは **提案のみ**。実 migration ファイル（`supabase/migrations/`）は作成していません。
- メイン側で採用判断 → そちらで migration ファイル化 → `supabase db push` で適用してください。
- 既に Phase 1 で 19 テーブル + RLS が動いている状態に **影響を与えない設計**としていますが、念のため staging で確認してから本番適用を推奨。
- 既存スキーマの **慣習・構造・意図を絶対に壊さない**ようにしてください。リサーチ側の提案は参考程度として、メインの判断を優先してください。

---

## 🔗 関連ドキュメント

- [07_wireframe_members.md](07_wireframe_members.md) — WF v2.1（学習ツール最優先）
- [17_design_inspiration_v2.md](17_design_inspiration_v2.md) — 設計判断の根拠
- [database_design_draft.md](../00_premises/database_design_draft.md) — 既存16テーブルの定義（正規）
- `supabase/migrations/20260519000001_initial_schema.sql` — 実装済み初期スキーマ
