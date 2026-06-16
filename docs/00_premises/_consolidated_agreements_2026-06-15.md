# 06_kinniku_juku_app 合意の正典 (2026-06-15 版)

> **このファイルは現行 canon**。新規提案前にまずこれを参照する。

| 項目 | 値 |
|---|---|
| 現行 canon 起算日 | 2026-06-15 |
| 前 canon (廃止 ・ 履歴温存) | [`_consolidated_agreements_2026-05-25.md`](./_consolidated_agreements_2026-05-25.md) |
| 生きているルール集 | [`.cursor/rules/kinniku-juku-build.mdc`](../../.cursor/rules/kinniku-juku-build.mdc) (39 原則 + 7 関所 + 補追) |
| やらないこと原典 | [`DO_NOT_DO.md`](../../DO_NOT_DO.md) (10 項目 + v5 アップデート + 開発禁忌) |
| 事業コンテキスト | [`business_context.md`](./business_context.md) (v5、 スコープ拡張記録) |
| DB 設計叩き台 | [`database_design_draft.md`](./database_design_draft.md) (20 テーブル + RLS) |
| 技術スタック | [`tech_stack_proposal.md`](./tech_stack_proposal.md) |
| アラート仕様 | [`admin_alert_tags_spec_2026-06-11.md`](./admin_alert_tags_spec_2026-06-11.md) |
| 社長回答記録 | [`president_response_2026-05-18.md`](./president_response_2026-05-18.md) |
| 画面マスター | [`../03_design_mocks/screen_master.html`](../03_design_mocks/screen_master.html) |

---

## 0. 用途 + 廃止前提

「全部が索引から辿れる」 ことが本 canon の目的。 1 つのファイルに全決定を畳み込むのではなく、 **生きている決定** を本 canon に集約し、 **過去の決定** は廃止注記付きで履歴ファイルとして温存する。 提案前にまずこの canon を参照し、 詳細が必要な領域は本 canon が指すリンク先 (上の表) を読む。

### 廃止三原則 (本 canon の運用ルール)

1. 生きているルール (7 関所 / 39 原則 / 絶対前提 = 「新サイトで決済しない」 等) は一字一句保持。 言い換えてルールを失わない
2. 「廃止」 = 削除ではない。 古い doc / 過去の決定はファイルとして残し、 冒頭に「廃止 ・ 現行はこちら→」 と注記するだけ
3. 着手前に、 巻き直しで「消す / 言い換える」 項目があれば一覧で見せてから実行 (= 止まって確認)

---

## 1. スコープ主軸: 線①/②/③ (★ 2026-06-14 確定)

**線** = 完成スコープの段階。 **Phase** = 開発工程の時間軸。 別軸。

| 線 | 内容 | 対象範囲 |
|---|---|---|
| **線①** | v1 ソフトローンチ | **新規受講生だけ**。 入会動線 〜 配布 〜 リクエスト 〜 学習 〜 体組成 〜 目標シート の 6 区間 (穴ゼロ実証済 2026-06-14 E2E) |
| **線②** | フルオープン | 既存会員移行 + 管理画面大改修 + 全領域の精度上げ |
| **線③** | 将来枝 | Phase 4 todo (お知らせ機能 / LINE Bot / 体組成推移グラフ 等) |

**運用ルール**:
- 提案前に必ず「これは線①/②/③ のどれ?」 で位置付ける
- 線① 進行中に 線②/線③ の話が出たら、 即着手せず別タスクとして起票
- 管理画面大改修は **線① の対象外** (中断中の admin_revamp は線② で再開)

---

## 2. 命名規則

| 軸 | 採用 | 廃止 |
|---|---|---|
| スコープ | **線①/②/③** | Day / Session (チャットセッション番号での参照は履歴用途のみ) |
| 工程 | **Phase 0-4** | Phase 番号は「現在地の一言」 用途に縮小、 詳細スケジュールは本 canon § 9 |
| 文書 | **canon / 履歴 / 参考 / 別プロジェクト / 横断** | 「決定版」 「正典」 等は本 canon と .cursor/rules のみに限定 |

---

## 3. 技術スタック (確定)

5/25 版 § 1 を踏襲。 [`tech_stack_proposal.md`](./tech_stack_proposal.md) が原典。

| カテゴリ | 確定内容 |
|---|---|
| フロント | Next.js 16.2.6 (App Router) + React 19 + TypeScript |
| スタイル | Tailwind CSS v4 |
| DB / 認証 / ストレージ | Supabase (PostgreSQL + Auth + Storage) |
| 決済 | Stripe (Webhook 受信のみ、 新サイトは決済処理なし) |
| 動画ホスト | Vimeo (既存動画継承 + 月次添削動画もここ確定 ・ 2026-05-27) |
| メール送信 | Resend |
| LINE 連携 | LINE Messaging API (経路は Step 9d 着手時決定 ・ memory `project_line_integration_options`) |
| ホスティング | **Vercel Pro** (約 $20/月、 商用想定 ・ 旧: Cloudflare Pages、 2026-06-16 転換、 06 が Node 前提フルスタックで Cloudflare Edge と相性悪のため) |
| ドメイン | juku.norifitness.com (Xserver DNS) |

---

## 4. DB 設計 (6/11 v5 反映後)

5/25 版 § 2 の 20 テーブル + 6/11 v5 で追加。 詳細は [`database_design_draft.md`](./database_design_draft.md) が原典。

| カテゴリ | テーブル |
|---|---|
| コア (8) | users / user_profiles / courses / chapters / lessons / lesson_progress / comments / goal_sheets + goal_sheet_revisions |
| 試験 (2) | tests / test_attempts |
| 管理 ・ 運用 (4) | admin_users / invitations / stripe_events / broadcast_notifications |
| 補助 (3) | notifications / user_status_history / faq_categories + faqs |
| 将来 (1) | graduate_voices |
| **6/11 v5 追加** | **body_metrics** (体組成) / **shipments** (発送管理) / **request_tags** (アラート用) |

### 6/13 user_profiles 修正

- birthday 永久 NULL バグの根本対処 (入会時 user_profiles 空行 + カルテ提出時 birthday upsert)
- カルテ Q1 = 生年月日 (必須)
- 1 フォーム ・ 2 保存先で二重化回避 (`user_workout_carte` に birth_date 持たせない)

---

## 5. MVP 機能スコープ (6/11 v5 反映後)

5/25 版 § 3 の MVP 12 機能 (M-1 〜 M-12) + 6/11 v5 で追加された 4 領域:

| 6/11 v5 追加 | 内容 |
|---|---|
| 体組成 (`body_metrics`) | 新サイトで持つ (旧「trainercloud 担当」 から転換) |
| 発送管理 (`shipments`) | プロテイン歓迎ギフト ・ 9 ステップ管理画面 |
| アラート (8 タグ) | 体組成 7 日途絶 / 目標乖離 7% 等。 詳細 [`admin_alert_tags_spec_2026-06-11.md`](./admin_alert_tags_spec_2026-06-11.md) |
| 設定画面 | テンプレート + 通知 + プロフィール |

> ⚠️ **6/11 v5 で追加された機能は社長への事後説明保留中** (D 起票)。 きよむさん判断で進めたもの。 線② フルオープン前に社長承認を取る (DO_NOT_DO.md L17-32 と同期)。

### 画面数 (固定でない)

5/25 版の「受講生 8 画面 ・ 管理者 12 画面」 は撤廃 (体組成 / 発送 / アラート等で拡大済)。 画面数を固定の絶対値として扱わない (`.cursor/rules` F 補追 ・ 既に意図的に覆した旧ルール § 1)。

---

## 6. UX/UI 方針 + ブランドカラー

詳細は [`.cursor/rules/kinniku-juku-build.mdc`](../../.cursor/rules/kinniku-juku-build.mdc) C セクション (C.9 〜 C.29) が原典。 要点:

| 項目 | 確定内容 |
|---|---|
| ブランドカラー | ティール緑 **#00897b** (ホバー #00695c、 アクセント #004d40) |
| ツール群 | インディゴ **#3949ab** (役割色分け) |
| 添削系 | 薄黄 (rgba(255,235,59,0.18) 〜 0.55、 名前色 #b8860b) |
| 絵文字 | 許可リスト方式 **`✓ ▶ → ←` の 4 つのみ**。 他は SVG 線画 (Lucide / Heroicons outline、 `stroke: currentColor; fill: none; stroke-width: 2;`) |
| 受講生 UI 幅 | `max-w-[460px]` wrapper 必須 (PWA standalone 前提、 PC では中央 460px) |
| モック制作 | `/tmp/<画面名>.html` に `max-width: 390px` (iPhone 14 Pro 実機密度基準) |
| 画面マスター | [`screen_master.html`](../03_design_mocks/screen_master.html) が正典 ・ デザインを即興しない |
| 管理画面 | デスクトップ専用 (max-w-3xl 〜 max-w-5xl)、 スマホレスポンシブ不要 |
| 0 件表示 | 0 件は赤くしない (完了は静かに緑/グレー) |
| ゲーミフィケーション | 抑制方針 (XP / レベル / Streak なし、 バッジ控えめ) |

### モック温存対象 (C.28 で変更禁止)

- [`recovered/管理画面___月次添削_受信箱_(3a_3).html`](../03_design_mocks/recovered/)
- [`recovered/管理画面___月次添削_個別作業_(3b_3).html`](../03_design_mocks/recovered/)
- [`recovered/管理画面___動画録画モード.html`](../03_design_mocks/recovered/)

---

## 7. 認証 ・ 入会動線 (マジックリンク方式 ・ 2026-06-10 転換)

| ステップ | 内容 |
|---|---|
| 1 | 申請フォーム提出 |
| 2 | 管理者承認 |
| 3 | 自動メール (アクティベーションリンク = マジックリンク) |
| 4 | 会員情報登録 (氏名固定、 ニックネーム廃止) |
| 5 | 自動ログイン |
| 6 | オンボーディング 8 ステップ |

### オンボ 8 ステップ詳細 (2026-06-10 確定)

| Step | 内容 | 入力必須? |
|---|---|---|
| 1-2 | ウェルカム + サービス概要 | × |
| 3-5 | **紹介のみ** (ミニフォーム廃止) | × |
| 6 | プロテイン発送先 | ✅ 実入力必須 |
| 7 | 通知 ON | ✅ 実入力必須 |
| 8 | 完了 | × |

→ 完遂性はホーム v4 黄バナー (カルテ/目標シート/体組成 未記入時) で担保。 旧「Step 3-5 ミニフォーム必須化 (commitment 効果狙い)」 は廃止。

### 旧「12 桁招待コード受付方式」 廃止

→ archive 候補。 [`.cursor/rules` F 補追 ・ 既に意図的に覆した旧ルール § 3](../../.cursor/rules/kinniku-juku-build.mdc) で履歴記録済。

---

## 8. 動画機能 (Vimeo 確定 ・ 2026-05-27)

### 月次添削動画

| 項目 | 確定内容 |
|---|---|
| ホスト | Vimeo (Supabase Storage 案は破棄 ・ 既存契約コスト 0、 iOS 互換性自動解決) |
| アップロード方式 | **クライアント直アップ (tus PATCH)** で 50MB 突破済 (2026-06-10) |
| Vimeo embed 設定 | end_screen={type:"empty"} / ロゴ非表示 / ティール緑 / speed OFF |
| アップ中の制限 | タブ閉じる / リロード NG (SPA 内ナビは OK) |

詳細フロー (15 ステップ) は 5/25 版 § 6-B が原典として残る。 本 canon では概要のみ。

### LIVE 講義

- Google Meet 配信 → アーカイブ Vimeo 保存 → 段階公開

### 再撮影

- ❌ やらない (コンテンツ一覧の構成維持、 既存 217 レッスン継承)

---

## 9. 取りこぼし注意項目 (handoff 由来 ・ 5/26〜6/4 sweep 反映)

### A) ツール↔目標シート完全分離 (2026-05-28、 [`_handoff_to_chat8`](./_handoff_to_chat8_2026-05-28.md))

- ツール画面 `/tools/*` は単独機能、 目標シートと無関係
- 「反映ボタン」 なし、 「保存ボタン」 あり (`tool_calculations` テーブルに UPSERT)
- 次回開いた時、 前回値が薄色プリセット

⚠️ ただし [`PfcCarbToolClient.tsx`](../../src/app/tools/pfc-carb/PfcCarbToolClient.tsx) の現状実装は目標シートからの読み込みあり = 5/28 完全分離方針と部分的に相違。 線② 着手時に整合確認 (E 起票候補)。

### B) 身長手入力 + セルフイメージ 7 項目 TODO (2026-05-26、 [`_handoff_to_chat6`](./_handoff_to_chat6_2026-05-26.md))

- 身長 = `user_profiles` 削除済 → 目標シート ① で手入力に確定 (5/25 § 17 で正式確定済)
- セルフイメージ 8 項目 = 残り 7 項目ラベル未確定 → **のり氏確認待ち** (現在も TODO)

### C) カーボサイクル「今日の目安」削除 (2026-05-26、 C 案、 5/25 § 17)

- ホーム画面・目標シートに「今日 = HIGH 日 / LOW 日」 日次表示なし
- 受講生は週次表を `/tools/pfc-carb` で確認

### D) ヒーロー文言 + 4 ツールマップ (2026-05-28、 [`_handoff_to_chat8`](./_handoff_to_chat8_2026-05-28.md))

ツール画面ヒーロー文言 (確定):
> カラダづくりに必要な数値を、まとめて。
> 気になった時、日々の見直しに。

4 ツール × 目標シート反映先:

| ツール | 目標シート反映先 |
|---|---|
| 1 体脂肪率 | ① 現状把握「体脂肪率」 入力欄 |
| 2 必要カロリー | ③ 栄養設計「目標カロリー」 入力欄 |
| 3 減量期間 | ② 目標選定「目標体重 / 期間 / 達成日」 セクション |
| 4 PFC | ③ 栄養設計「PFC」 入力欄 |

### E) 筋トレ過去事例検索モデル (2026-06-01、 [`_handoff_to_workout_review`](./_handoff_to_workout_review_2026-06-01.md))

- **旧軸テンプレ案は完全廃棄**。 新モデル = 過去事例検索
- マッチング重み付け (確定): 性別 (フィルタ最強) > 重点部位 (100) > 年齢層 (50) > 頻度 (30) > 環境 (30)
- 277 件資産化、 カルテで類似度マッチング → 上位 3 件 → のり氏微調整
- 詳細は memory `project_kinniku_juku_workout_menu`

### F) 動画アップロード上限 (2026-06-04 起票 → 2026-06-10 解決)

- ✅ 解決済 (履歴扱い)。 クライアント直アップ (tus PATCH) で 50MB 突破済
- 詳細は memory `project_kinniku_juku_file_upload_limit`

### G) プロセス則

- 提案前に正典 Read ([`.cursor/rules`](../../.cursor/rules/kinniku-juku-build.mdc) E.20)
- 言語化フェーズでは決定を急がない (.cursor/rules E.32)
- 5問セルフテスト (本 canon § 12 参照)
- 任せ方ルール 5 項目 (本 canon § 12 参照)

---

## 10. やらないこと (要約 ・ 原典は DO_NOT_DO.md)

詳細は [`DO_NOT_DO.md`](../../DO_NOT_DO.md) が原典。 本 canon では 5 行要約のみ:

1. 新サイトでの決済処理 (Stripe で外部完結)
2. 申込フォーム ・ 返金処理機能
3. 個別面談を経ない直接申込
4. 受講生のセルフ解約 (買い切り)
5. noriAI / trainercloud 統合 (MVP 段階)

開発禁忌 (2026-06-14 確定、 DO_NOT_DO.md L82-89):
- R-1: 素アドレス `fujikiyo1010@gmail.com` の auth ユーザー削除 (cascade で管理者 admin_users 行が道連れ)
- R-2: 素アドレスをテスト受講生として使う (テストは Gmail エイリアス `+test1` 等)

---

## 11. noriAI + trainercloud 関係

5/25 版 § 12-13 踏襲。 要点:

| 項目 | 確定 |
|---|---|
| noriAI 連携 (MVP) | ❌ 含めない (社長明示「後でいい」、 Should Have 以降) |
| trainercloud (MyTrainer) | 永久に別アプリ ・ 別管理 (OEM 型 SaaS、 API なし、 SSO 不可) |
| 役割分担 | 新サイト (学習 + 体組成 + 添削) / trainercloud (運動実行記録) |
| 食事 | trainercloud で完結 (新サイトに食事関連テーブルなし) |

> ⚠️ 体組成は 6/11 v5 で「新サイトで持つ」 に転換済 (旧「trainercloud 担当」 から)。 詳細 [`.cursor/rules` F 補追 旧ルール § 2](../../.cursor/rules/kinniku-juku-build.mdc)

---

## 12. 任せ方ルール 5 項目 (2026-06-14) + 5 問セルフテスト (2026-06-13)

### 任せ方ルール 5 項目 (memory `feedback_delegation_rules_2026_06_14`)

1. **検証 ・ 裏方 ・ ドキュメント** = スピード優先で進める
2. **機能 ・ 動線 ・ デザイン ・ 破壊的 DB** = 提案ゲート必須
3. **決定事項を変えない**
4. **改善案は止まって聞く** (止まること自体は歓迎)
5. **Supabase 操作**: SELECT・upsert は実行 OK / DELETE 等は SQL 提示 → 明示 OK → 実行 / 破壊スクリプトは承認時にハーネスの一部として自動実行 OK

### 5 問セルフテスト (memory `feedback_data_lifecycle_5questions`)

データに触る前に「データの一生」 を点検:

1. **生産者は誰?**
2. **順序は?**
3. **権限は?**
4. **初回はどう生まれる?**
5. **実受講生で歩いたか?**

→ **Q1 と Q5 が核**。 純粋 UI 修正には適用不要。

---

## 13. TOP 10 絶対外せない決定事項

| # | 決定事項 | 原典 |
|---|---|---|
| 1 | 新サイトで決済しない (Stripe で外部完結) | DO_NOT_DO #1 / .cursor/rules F.22 |
| 2 | trainercloud は永久に別アプリ ・ 統合不可 | DO_NOT_DO #10 / .cursor/rules F.23 |
| 3 | 主軸 KPI は 「実施完工率」 | president_response_2026-05-18 |
| 4 | 目標管理シート = 最初に設定 → いつでも見れる → 編集可能 | きよむさん 5/19 明示 |
| 5 | screen_master が画面の正典 | .cursor/rules C.10 / F.25 |
| 6 | 受講生 UI は max-w-[460px] + モック先行 (`/tmp` 390px) | .cursor/rules C.9 / C.27 |
| 7 | 絵文字は `✓ ▶ → ←` のみ | .cursor/rules C.12 |
| 8 | 廃止は削除せず履歴温存 | 本 canon § 0 三原則 ② |
| 9 | 線① 進行中に線②/線③ の話は別起票 | 本 canon § 1 |
| 10 | 高額サービスは完遂性 > 柔らかさ | memory `project_norifitness_kanzen_priority` |

---

## 14. 履歴 (廃止) 一覧 + マスター TOC ポインタ

### 廃止された旧決定

| 旧決定 | 廃止日 | 現行 | 原典 |
|---|---|---|---|
| 受講生 8 画面・管理者 12 画面 (固定) | 6/11 v5 | 画面数固定の絶対値として扱わない | .cursor/rules F 補追 § 1 |
| 体組成 = trainercloud 担当 | 6/11 v5 | 新サイトで持つ (body_metrics 新設) | .cursor/rules F 補追 § 2 |
| 12 桁招待コード受付方式 | 6/10 | マジックリンク方式 | .cursor/rules F 補追 § 3 |
| オンボ Step 3-5 ミニフォーム必須 | 6/10 | 紹介のみ + ホーム v4 黄バナー | .cursor/rules F 補追 § 4 |
| 受講生 UI 控えめな絵文字可 | 6/12 | 許可リスト方式 `✓ ▶ → ←` の 4 つのみ | .cursor/rules F 補追 § 5 |
| 旧軸テンプレ筋トレ案 | 6/1 | 過去事例検索モデル | memory `project_kinniku_juku_workout_menu` / `_handoff_to_workout_review` |
| 新サイトでの月次添削動画 Supabase Storage 案 | 5/27 | Vimeo 確定 | memory `project_kinniku_juku_video_storage_confirmed` |

### 履歴ファイルの所在 (マスター TOC として索引から辿れる)

| カテゴリ | 場所 | 件数 |
|---|---|---|
| 5/25 当時の合意スナップショット | [`_consolidated_agreements_2026-05-25.md`](./_consolidated_agreements_2026-05-25.md) | 1 |
| handoff (履歴) | [`handoff_2026-05-19.md`](./handoff_2026-05-19.md) / [`handoff_2026-05-20.md`](./handoff_2026-05-20.md) / [`_handoff_to_phase3_2026-05-25.md`](./_handoff_to_phase3_2026-05-25.md) / [`_handoff_to_chat6_2026-05-26.md`](./_handoff_to_chat6_2026-05-26.md) / [`_handoff_to_chat8_2026-05-28.md`](./_handoff_to_chat8_2026-05-28.md) / [`_handoff_to_workout_review_2026-06-01.md`](./_handoff_to_workout_review_2026-06-01.md) / [`_handoff_to_session9_2026-06-04.md`](./_handoff_to_session9_2026-06-04.md) | 7 |
| 古い社長確認系 | `_pending_confirmations.md` / `_questions_for_president.md` / `president_question_v4_2026-05-19.md` / `_kiyomu_todo_before_president.md` | 4 |
| Phase 0 完了報告 | `phase0_summary.md` / `phase1_kickoff_checklist.md` | 2 |
| モック履歴 | `docs/03_design_mocks/archive/` (12) + `docs/03_design_mocks/all_versions/` (137) + `docs/03_design_mocks/recovered/` (122、 うち 3 件 C.28 温存対象) | 271 |
| 解決済バグ memory | `project_kinniku_juku_file_upload_limit` / 各種 handoff (6/9, 6/11 v2, 6/12 v3, 6/13 evening, 6/14 evening) | 多数 |

### handoff 検証結果 (取りこぼし注意項目)

5/26〜6/4 の handoff 4 本 (chat6 / chat8 / workout-review / session9) を全文 sweep 済。 取りこぼし A〜G は **全て本 canon § 9 に取り込み済**。 生チャットだけにある重要決定の検出ゼロ。

---

## 15. このファイルの更新ルール

| 場面 | 対応 |
|---|---|
| 既存合意の前提を変える可能性が出た | [`.cursor/rules` E.34](../../.cursor/rules/kinniku-juku-build.mdc) に従い「これは合意 X と矛盾」 と明示確認 |
| きよむさんが「変えていい」 と判断 | 本 canon + DO_NOT_DO.md + business_context.md の該当箇所を同時に更新 |
| 廃止 | 削除せず § 14 の履歴一覧に追記 |
| 巻き直し | 「消す / 言い換える」 項目は事前に一覧で見せて、 きよむさん OK 後に実行 |

---

## 16. 起票事項 (D ・ E)

### D: 6/11 v5 の社長承認状況

- 6/11 v5 で MVP に追加された 4 領域 (体組成 / 発送 / アラート / 設定) は **社長への事後説明保留中**
- 線② フルオープン前に社長承認を取る
- DO_NOT_DO.md L17-32 と同期して扱う

### E: Phase 4 todo の 線②/線③ 振り分け

- memory `project_kinniku_juku_phase4_todo` に線②/線③ タグを追記済 (本 canon 作成と同時に実施)
- 線① 進行中は触らない、 線① 完成後に線②/線③ の優先順位を決める
