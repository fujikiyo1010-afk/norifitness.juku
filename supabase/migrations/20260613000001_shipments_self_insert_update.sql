-- =====================================================================
-- 2026-06-13: shipments テーブルに受講生 self INSERT / UPDATE ポリシーを追加
-- =====================================================================
--
-- 平たく言うと:
-- 受講生がオンボ Step 6 で自分の発送先住所を登録する時、
-- これまで RLS で弾かれていた (= 管理者しか INSERT できない設計だった)。
-- 受講生本人が「自分自身の shipments 行」だけを操作できるように追加。
--
-- 発見経緯: 2026-06-13 E2E テストで「テスト受講生 太郎」がオンボ Step 6 で
--           「発送先の登録に失敗しました」エラー。 ログに RLS 違反:
--           'new row violates row-level security policy for table "shipments"'
--           きよむさん (管理者) でテストする限り見つからなかったバグ。
--
-- 既存ポリシー:
--   - "shipments: admin all"   (管理者は全操作 OK)
--   - "shipments: self select" (受講生は自分の行を SELECT のみ OK)
--
-- 追加するポリシー (受講生本人のみ、 user_id 偽装防止):
--   - self insert: 自分の user_id でのみ INSERT 可
--   - self update: 自分の行のみ UPDATE 可 (住所変更時)

create policy "shipments: self insert"
  on public.shipments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "shipments: self update"
  on public.shipments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
