-- =====================================================================
-- 2026-06-12: signup_requests (アカウント発行申請)
-- =====================================================================
--
-- 平たく言うと:
-- 「すでに面談 + 決済を済ませた受講生が、 アプリで『アカウントを発行してください』
--  と氏名 + メアドを渡す入口」 (/request) の保存先。
--
-- 動線:
--   1. 個別面談 (Zoom 等) → 申込意思確認
--   2. Stripe / 銀行振込 → 新サイト外で決済完了
--   3. きよむさん 入金確認 (手動) → LINE で /request の URL 案内
--   4. 受講生が /request で氏名 + メアド入力 → 本テーブルに insert (status=pending)
--   5. /admin/invitations で承認 → invitations 行を発行 + Resend でメール送信
--   6. 受講生がメール内リンク → /invite で会員登録 → ホーム
--
-- DO_NOT_DO 衝突なし:
--   #2 (申込フォーム禁止 = 決済前段) → 本フォームは決済後段、 違反しない
--   #5 (面談を経ない直接申込禁止) → LINE で URL 案内された人のみ到達想定
--
-- モック: docs/03_design_mocks/recovered/申請フォーム画面.html

create table if not exists public.signup_requests (
  id                  uuid primary key default gen_random_uuid(),

  -- 受講生入力
  name                text not null,
  email               text not null,

  -- ステータス
  status              text not null default 'pending'
                      check (status in ('pending','approved','rejected')),
  approved_at         timestamptz,
  approved_by         uuid references public.admin_users(id) on delete set null,
  rejected_at         timestamptz,
  rejected_by         uuid references public.admin_users(id) on delete set null,
  rejection_reason    text,

  -- 承認時に作成された invitations 行への参照
  invitation_id       uuid references public.invitations(id) on delete set null,

  -- 管理者メモ (面談時の特記事項など)
  note                text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_signup_requests_pending
  on public.signup_requests(created_at desc)
  where status = 'pending';

create index if not exists idx_signup_requests_email
  on public.signup_requests(email);

create index if not exists idx_signup_requests_status
  on public.signup_requests(status, created_at desc);

create trigger trg_signup_requests_updated_at
  before update on public.signup_requests
  for each row execute function public.set_updated_at();

alter table public.signup_requests enable row level security;

-- 管理者: 全件閲覧 + 編集
create policy "signup_requests: admin all"
  on public.signup_requests for all
  using (public.is_admin())
  with check (public.is_admin());

-- 受講生 (未認証): /request からの insert を許可
-- (承認/閲覧は admin のみ、 anon は insert のみで返り値も受け取らない想定)
create policy "signup_requests: anon insert"
  on public.signup_requests for insert
  to anon
  with check (true);

-- 受講生 (認証済 = 既に承認済アカウントを持つ人): 自分のメールの申請履歴閲覧
-- (再申請したい場合の参考、 必須ではない)
create policy "signup_requests: self select by email"
  on public.signup_requests for select
  to authenticated
  using (
    email = (select email from public.users where id = auth.uid())
  );

-- 注: スパム対策 (Cloudflare Turnstile 等のキャプチャ) は Phase 4 候補。
--     現状は anon insert を許可、 重複メアド申請は管理画面で確認して対応。
