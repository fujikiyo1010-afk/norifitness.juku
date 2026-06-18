-- =====================================================================
-- 2026-06-18: reminder_log (Push リマインド配信履歴 ・ 線① R-1〜R-4 + B-6)
-- =====================================================================
--
-- 平たく言うと:
-- 「いつ誰にどんなリマインド Push を送ったか」 の履歴。
-- cron daily で「最後の送信から 7 日経過したか」 を判定して再送 (= 3 段階リマインド) に使う。
-- 受講生がアクション完了したらリマインド条件が false になるので、 自動的に停止。
--
-- reminder_key 一覧:
--   - 'r1_video_idle'      : 学習動画 未視聴 (3, 10, 17 日)
--   - 'r2_carte_blank'     : カルテ未提出 (5, 12, 19 日)
--   - 'r3_goal_sheet_blank': 目標シート未記入 (7, 14, 21 日)
--   - 'r4_body_metrics'    : 体組成記録 7 日途絶 (7, 14, 21 日)
--   - 'b6_audit_3d_before' : 月次添削 期限 3 日前
--   - 'b6_audit_due'       : 月次添削 期限当日
--   - 'b6_audit_overdue_3d': 月次添削 期限 +3 日
--
-- RLS: 受講生は読めない (= 完全に service_role 専用テーブル)

create table if not exists public.reminder_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  reminder_key    text not null,
  sent_at         timestamptz not null default now()
);

create index if not exists reminder_log_user_key_idx
  on public.reminder_log(user_id, reminder_key, sent_at desc);

alter table public.reminder_log enable row level security;
-- RLS policy なし = authenticated user は 0 件しか返らない = service_role でのみアクセス可
