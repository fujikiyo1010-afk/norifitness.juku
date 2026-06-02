-- =====================================================================
-- カルテ RLS 修正: 受講生が自分のカルテを INSERT できるように
-- =====================================================================
-- 作成日: 2026-06-01
--
-- 経緯:
--   当初設計では「受講生 = read-only」と書かれていたが、これは
--   「UPDATE 不可」の意味であり、「INSERT (初回提出) は受講生本人がやる」
--   という合意が memory に明文化されていなかった。
--   2026-06-01 にきよむさんから明示確認を受けて修正。
--
-- 修正内容:
--   - user_workout_carte の INSERT ポリシーを「自分の行 or 管理者」に変更
--   - UPDATE / DELETE は管理者のみのまま (変更したい受講生はリクエスト経由)
--   - 1 ユーザー 1 カルテ (user_id PRIMARY KEY) なので、2 回目 INSERT は
--     自動的に UNIQUE 違反で弾かれる = 実質「初回のみ」
-- =====================================================================

-- 既存の admin insert ポリシーを削除して、self or admin insert に置換
drop policy if exists "user_workout_carte: admin insert" on public.user_workout_carte;

create policy "user_workout_carte: self or admin insert"
  on public.user_workout_carte for insert
  with check (user_id = auth.uid() or public.is_admin());

-- (参考) UPDATE / DELETE / SELECT ポリシーは変更なし:
--   - SELECT: 自分の行 or 管理者
--   - UPDATE: 管理者のみ
--   - DELETE: 管理者のみ
