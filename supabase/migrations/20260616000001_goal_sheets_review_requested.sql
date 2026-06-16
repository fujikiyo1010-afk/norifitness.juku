-- ---------------------------------------------------------------------
-- 目標シート 再添削依頼フラグ追加 (Phase 4 #16 線① 前倒し、 2026-06-16)
-- ---------------------------------------------------------------------
-- 受講生が「送信して [再]添削を依頼」 ボタンを押した時刻を記録。
-- 管理者は last_review_requested_at > reviewed_at の受講生を
-- ホームダッシュ「今すぐ対応」 セクションに表示する (severity = urgent)。
--
-- なぜ notifications テーブルを使わないか:
--   - notifications.type の check 制約は ('system','lesson','comment','broadcast') のみ
--   - notifications RLS で受講生からの INSERT 不可 (admin only)
--   - goal_sheets に直接カラムを追加する方がデータ一貫性が高く migration 1 つで済む
--
-- 関連:
--   - src/lib/goal-sheet/actions.ts saveMyGoalSheet { notify: true }
--   - src/lib/admin/alerts.ts goal_sheet_review_requested
--   - docs/00_premises/admin_alert_tags_spec_2026-06-11.md #9
--   - memory: project_kinniku_juku_phase4_todo #16 線① 前倒し

alter table public.goal_sheets
  add column if not exists last_review_requested_at timestamptz;

comment on column public.goal_sheets.last_review_requested_at is
  '受講生が「送信して [再]添削を依頼」 ボタンを押した時刻。 reviewed_at より新しい場合 = 管理者対応待ち。 NULL = 一度も依頼していない。';

create index if not exists idx_goal_sheets_review_requested
  on public.goal_sheets(last_review_requested_at desc)
  where last_review_requested_at is not null;
