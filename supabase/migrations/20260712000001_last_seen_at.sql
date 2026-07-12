-- C (2026-07-12): 「最終ログイン」→「最終利用」対応。
-- アプリを開いた時点=利用 を記録する列。ログイン済み受講生がアプリを開き
-- JSTの日付が変わっていた場合のみ1回更新する(ルートレイアウトの getLayoutBootState)。
-- アラート判定は max(auth.last_sign_in_at, users.last_seen_at) を採用(閾値7日据え置き)。
-- 追加のみ・null許容・既存行に影響なし(導入直後は空=従来表示、数日で自然に正確化)。
alter table users add column if not exists last_seen_at timestamptz;
