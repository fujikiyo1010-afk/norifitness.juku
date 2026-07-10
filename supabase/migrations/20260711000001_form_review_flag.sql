-- フォーム添削(5大機能②)の「初回完了」札。
-- 初期 false = 初回無料URLへ / true = 2回目以降(有料)URLへ。
-- 管理画面(受講生ハブ)のトグルで手動切替。UTAGE予約状況はアプリからは見えないため完全手動。
alter table public.users
  add column if not exists form_review_first_done boolean not null default false;
