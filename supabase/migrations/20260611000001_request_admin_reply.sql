-- =====================================================================
-- 2026-06-11: リクエスト処理 即時モデル対応
-- =====================================================================
--
-- 管理画面 大改修 (トレクラ寄せ) に伴い、 カルテ更新 / メニュー変更
-- リクエストに「管理者返信本文 + 返信時刻」を保存できるようにする。
--
-- 設計原則 (即時モデル):
--   - 編集 → 返信 の順番強制
--   - ステータス 2 値: pending / handled (= 対応済)
--   - 「次月反映」「保留中」等の中間状態は作らない
--   - 完了形テンプレ標準 (「変更しました」)
--
-- モック: docs/03_design_mocks/recovered/管理画面_リクエスト_流れ作業.html

alter table public.user_carte_request
  add column if not exists admin_reply_text text,
  add column if not exists replied_at timestamptz;

alter table public.user_workout_request
  add column if not exists admin_reply_text text,
  add column if not exists replied_at timestamptz;

-- 補足インデックス: 「対応済」を replied_at 降順で一覧表示する画面用
create index if not exists idx_user_carte_request_replied
  on public.user_carte_request(replied_at desc)
  where replied_at is not null;

create index if not exists idx_user_workout_request_replied
  on public.user_workout_request(replied_at desc)
  where replied_at is not null;
