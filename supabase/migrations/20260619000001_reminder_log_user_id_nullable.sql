-- =====================================================================
-- 2026-06-19: reminder_log.user_id を NULLABLE に変更
-- =====================================================================
--
-- 平たく言うと:
-- A-2 発送忘れアラート (= admin 宛 1 通 / 日) を同テーブルで dedup したい。
-- 「特定の受講生に紐付かない通知」 を扱うため user_id を NULL 可に。
--
-- 既存 RLS / index は影響なし (NULLABLE 化は単純な制約緩和)。
-- 既存データは触らない (= NOT NULL → NULL 許可、 既存値は維持される)。

alter table public.reminder_log alter column user_id drop not null;
