# 筋肉塾アプリ 引き継ぎ書 (筋肉塾 8 → 筋肉塾 9)

**作成日**: 2026-06-04 夜
**前セッション**: 筋肉塾 8 (E2E メモ #1〜#8 一括対応)
**次セッション**: 筋肉塾 9 (動画アップロード上限解決 が最優先)

---

## 0. 重要な前提 (最初に必ず読む)

- このプロジェクトは のりfitness 筋肉塾アプリ 新サイト構築
- 操作者: **きよむさん** (のりfitness 社員、のり氏 旧友)
- 対象: のり氏 (代表) と受講生
- ワークスペース: `/Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/`
- 技術: Next.js 16 / React 19 / Tailwind v4 / Supabase / Cloudflare Pages / Vimeo / Stripe / Resend
- Git: 独立リポジトリ、`main` ブランチ

### 自動読み込みされる重要メモリ
- `project_kinniku_juku_e2e_progress.md` (★ 進捗状態の正本)
- `project_kinniku_juku_file_upload_limit.md` (★ 次回最優先タスクの詳細)
- `project_kinniku_juku_app.md` (プロジェクト全体)
- `feedback_articulate_before_implement.md` (メモ着手前は必ず言語化)
- `feedback_test_urls.md` (テスト操作には URL を添える)
- `feedback_handoff_completeness.md` (引き継ぎは抜けなく)

---

## 1. 今日 (2026-06-04) やったこと

### 段階 5 完了 + メモ #1〜#8 全了

| # | 内容 | コミット |
|---|---|---|
| 1 | カルテ送信完了画面 ステータス文言 「のりfitness が」追加 | `3b60a1c` |
| 2 | カルテ閲覧画面 スマホ可読性確認 (修正不要) | — |
| 3 | メニュー配布バリデーション 主部位空欄チェック追加 | `fc0e020` |
| 4 | 強度間同期機能 + 「サイクル」→「強度」置換 | `fc0e020` |
| 5 | 月次添削履歴バッジ拡大 + 中央揃え統一 | `3b60a1c` |
| 6 | RecordingView 左パネルに 月次/目標シート タブ追加 | `fc0e020` |
| 7 | 動画送信中の月次セクション「反映中」表示 | `fc0e020` |
| 8 | 月次添削動画ボタン文言「月次添削動画を開く」明示 | `3b60a1c` |

### 関連で対応済 (前セッションから引き継いだ #9)
- 目標シート編集 ↔ ツール往復で state ロスト問題 → 案 B sessionStorage で解決 (`e7416eb`)

### 今日の最新コミット
```
fc0e020 feat: メモ #3 #4 #6 #7 メニュー配布 + 管理月次添削画面の機能追加
3b60a1c fix(student-ui): メモ #1 #5 #8 受講生 UI 文言・表示の改善
3e42ef0 fix(tools): 戻るボタン周辺の誤タップ対策 + body-fat に例示追加
e7416eb feat(goal-sheet/tools): 案 B sessionStorage 永続化 + PFC ツール完成
```

---

## 2. ⚠️ 次セッション最優先: 動画アップロード上限解決

### 経緯

メモ #7 のテスト中に **「リクエスト形式が不正です」エラー** で動画送信が失敗。
原因: Next.js API Route の `request.formData()` がメモリに大ファイルをロードする時の制約。
実用上限は **~50 MB** 程度。

### きよむさんの強い要望 (重要)

> 動画の長さの修正は必ずやります。1、2 分でダメなのは困ります。
> 必ず過去チャットで話して解決してます。

**ポイント**:
- 月次添削動画は **4-6 分** が運用前提 (最低でも 2-4 分)
- 「過去チャットで解決済」と認識している
- **本番運用前に必須**

### 次セッション 着手順序

1. **過去履歴を確認** (本当に解決済の実装が眠っていないか)
   ```bash
   cd /Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app
   git log --all --oneline -- src/app/api/vimeo/upload/
   git log --all --oneline -S "tus"
   git log --all --oneline -S "chunk"
   git log --all --oneline -S "upload_link"
   ```
   - 過去ブランチ・タグも全部見る
   - もし解決済の実装があれば、それを復活/移植

2. **未対応の場合は新規実装** (詳細は `project_kinniku_juku_file_upload_limit.md`)
   - クライアント直アップ方式 (Vimeo tus PATCH エンドポイントに直接送る)
   - サーバー経由しないのでメモリ制約なし、Vimeo Pro 上限 5 GB まで安定
   - 実装目安: 30 分〜1 時間

3. **動作確認**
   - 4-6 分の動画で送信テスト
   - SQL でテスト太郎を C 状態に戻して試す:
     ```sql
     update monthly_audits
     set nori_video_published_at = null,
         nori_video_vimeo_url = null,
         nori_video_vimeo_id = null,
         nori_video_duration_sec = null
     where id = '0b499cd2-cd1f-492a-bd14-56e025eeadbf';
     ```
     → https://supabase.com/dashboard/project/yciqbigyzfqmmjdcnqfk/sql/new

---

## 3. テストデータ

### テスト太郎 (E2E 用)
- email: `test-student-001@example.com`
- password: `TestStudent2026!`
- user_id: `3d4b9979-31c4-4a5c-aaba-b805fe9ebfbc`
- 月次添削 audit_id (2026-06): `0b499cd2-cd1f-492a-bd14-56e025eeadbf`

### きよむさん (本人 = 管理者)
- user_id: `f0c48fd1-bc43-4b64-8e01-b9d32b2aa172`

### URL
- 管理者ホーム: http://localhost:3000/admin
- テスト太郎 ハブ: http://localhost:3000/admin/users/3d4b9979-31c4-4a5c-aaba-b805fe9ebfbc
- 月次添削個別作業: http://localhost:3000/admin/monthly-reviews/0b499cd2-cd1f-492a-bd14-56e025eeadbf
- 受講生 月次履歴: http://localhost:3000/monthly-review
- 受講生 目標シート: http://localhost:3000/goal-sheet
- Supabase SQL Editor: https://supabase.com/dashboard/project/yciqbigyzfqmmjdcnqfk/sql/new

---

## 4. 動画アップロード上限解決 後の続き (元の予定)

1. E2E 通しテスト最終確認
2. 受講生招待検証 (元 段階 3 の位置)
3. 目標シート受信箱 (元 段階 7 の位置)
4. 残り Phase 2-7 デザイン適用

---

## 5. 操作上の注意点 (重要メモリ抜粋)

- メモ/タスクリスト着手前は必ず **言語化** して合意取る ([[feedback-articulate-before-implement]])
- テスト操作シナリオには毎回 **URL を明示** ([[feedback-test-urls]])
- bypass モード中も破壊的操作は事前確認 ([[feedback-bypass-with-check]])
- 決裁要件 (お金/UX/スコープ/本番運用) は確認 ([[feedback-decision-check]])
- 言語化フェーズでは決定急がない、整理に徹する ([[feedback-genshika-phase]])
- 管理画面 UX は Claude 判断 OK、受講生 UI は別扱い ([[feedback-admin-ux]])
- アイコンは SVG (絵文字は ✓ ▶ のみ例外) ([[feedback-icon-svg-over-emoji]])
- 提案前に過去決定を確認 ([[feedback-check-past-decisions-first]])

---

## 6. 次セッション開始時の動作

次のチャットを開いて、以下のように言うだけで再開できる:

```
筋肉塾 9 です。前セッション (筋肉塾 8) で メモ #1〜#8 を全部完了させました。
次の最優先タスクは「動画アップロード上限解決」です。
project_kinniku_juku_e2e_progress.md と project_kinniku_juku_file_upload_limit.md を読んでから始めてください。
```

または引き継ぎ書のパスを伝える:
```
docs/00_premises/_handoff_to_session9_2026-06-04.md を読んでから始めてください。
```

メモリは自動読み込みされるので、上記のシンプルな声掛けで OK です。
