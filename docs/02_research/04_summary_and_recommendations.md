# 04 サマリー: 筋肉塾 新サイト設計への示唆

**作成日**: 2026-05-19
**前提**: 筋肉塾 ¥327,800（半年・エキスパ→Supabase 移行・フェーズ0着手前）
**対象4社の深掘り結果**: Stu McLaren TRIBE / RIZAP / Future / COMPASS

---

## 0. エグゼクティブサマリー（3行）

1. **販売戦略は Stu McLaren TRIBE 型**（年1〜2回のローンチ集約 + 無料コンテンツ階段）が最も筋肉塾の構造に合う
2. **入会導線は Future 型 + COMPASS 型のハイブリッド**（クイズ/診断で低ハードル → 個別相談で深い対応）
3. **会員サイトのUIは RIZAP touch + Future アプリ**（食事写真フロー + シンプルなチャット中心UI）

---

## 1. 4社の役割整理

| サービス | 学べる主領域 | 筋肉塾への適用密度 |
|---|---|---|
| **Stu McLaren TRIBE** | 販売戦略・ローンチ・コンテンツ階段 | ⭐⭐⭐ 戦略の幹に直結 |
| **RIZAP** | アプリUI・食事フロー・返金保証 | ⭐⭐⭐ 受講体験のお手本 |
| **Future** | 入会クイズ・1on1動線・データ統合 | ⭐⭐ 動線とUXの参考 |
| **COMPASS** | 動画ファネル・コミュニティ・卒業生実績 | ⭐⭐ 集客と継続の参考 |

---

## 2. 領域別の統合示唆

### A. ビジネスモデル（販売戦略）

#### 推奨設計
```
[年間サイクル]
通年:
  - のり氏のYouTube・SNS・無料コンテンツで認知
  - LP常時設置（Waitlist + 無料診断）
  - 既存特典（炭水化物の取説 等）= エントリー商品

年2回（春・秋）の集中ローンチ:
  - ローンチ前: 無料ワークショップ3〜5本（ライブ配信）
  - 販売期間 5〜7日に集約
  - 期間限定特典 + 14日返金保証

通年バックドア:
  - 個別相談からの直接申込（COMPASS型）
  - 既存ファン向けの常時受付
```

| 出所 | 採用ポイント |
|---|---|
| Stu McLaren | 年集中ローンチ・無料コンテンツ階段 |
| Future | 初月割引 = 「お試し価格」設計の発想 |
| COMPASS | LINE経由のリスト化・説明会クロージング |
| RIZAP | 30日返金保証・分割払いの柔軟性 |

#### 価格設計の選択肢
- **A案（推奨）**: ¥327,800 一括（買い切り）+ 分割払い対応
- **B案**: ¥327,800 を 6ヶ月で分割（月¥54,633）の月額型表記
- **C案**: 「初月¥27,800 → 翌月以降¥60,000×5」のFuture型ファサード

---

### B. 入会動線

#### 推奨フロー

```
[フロント = 認知〜興味]
SNS / YouTube / 既存特典LP
   ↓
筋肉塾の常時LP
   ↓
[エントリー = 低ハードル開始]
- 「筋肉タイプ診断」1分クイズ
- 無料特典DL（メアド or LINE）
   ↓
[教育シーケンス]
- 段階的動画3〜4本 (Stu McLaren型)
- LINE/メルマガで深化
   ↓
[2つの出口を用意]
出口①（即決派）: 「今すぐ申し込む」→ 直接決済
出口②（検討派）: 「個別相談 ZOOM予約」→ COMPASS型クロージング
   ↓
[購入]
- 14日返金保証
- 分割払い対応
- 同期スタート日固定（◯期生）
```

#### 重要な分岐: 価格を LP に出すか出さないか

| 戦略 | メリット | デメリット | 推奨度 |
|---|---|---|---|
| **価格を明示** | 透明性、即決促進、信頼 | 比較されやすい | ★★★（推奨） |
| **価格非公開** | 価値理解後の提示で抵抗減 | 怪しさ、コンバージョン遅 | ★ |

→ **筋肉塾は明示推奨**。のり氏の本人ブランドが既にあり、透明性で勝負できる。

---

### C. 会員サイト UI

#### 推奨画面構成（MVP）

```
[ホーム]
- 今日やること（今日の食事チェック・今週のテーマ）
- 進捗バー（◯/24週）
- のり氏からの今日のメッセージ

[食事ログ]
- 写真を撮って送信（タイムライン型）
- AI判定 + のり氏 or 講師のフィードバック
- 過去の食事振り返り

[学習コンテンツ]
- 週次ドリップ配信のレッスン動画
- ワークシート（PDF DL）
- チェックリスト

[コミュニティ]
- 同期（◯期生）のタイムライン
- 進捗共有
- 質問スレッド

[チャット]
- のり氏 or 講師との 1on1（or グループ）
- ビデオメッセージ受け取り

[プロフィール]
- 体重・体脂肪率の推移グラフ
- ビフォーアフター写真
- 過去のフィードバック

[設定]
- HealthKit / Google Fit 連携
- 通知設定
- 解約（簡単なフロー）
```

| 出所 | 採用UIパターン |
|---|---|
| RIZAP touch | 食事写真フロー（撮影 → 即送信） |
| Future | チャット中心の極簡UI、Apple Watch連携 |
| Peloton | 進捗の可視化、Streaks、レベル制度 |
| COMPASS | 同期グループとの繋がり可視化 |

---

### D. データ構造（Supabase テーブル設計の起点）

4社の推測テーブルから、筋肉塾の中核テーブル案:

```
-- ユーザー基本
users
  id, email, name, line_id, phone
  signup_source, signup_date
  current_cohort_id, plan_id, role (member/admin/coach)

-- 期生（同期グループ）
cohorts
  id, name (例: "2026春"), start_date, end_date

-- 学習コンテンツ
lessons
  id, week_no, title, video_url, worksheet_url
  release_at（ドリップ配信用）

lesson_progress
  user_id, lesson_id, watched_at, completed_at

-- 食事ログ
meals
  id, user_id, photo_url, meal_type, eaten_at
  ai_analysis_json, coach_feedback, feedback_by

-- 体組成・体重
body_records
  user_id, recorded_at, weight, body_fat_pct
  source (manual / healthkit / google_fit)

-- メッセージ
conversations
  id, user_id, type (1on1 / cohort_group)

messages
  conversation_id, sender_id, content_type (text/video/image)
  content, sent_at, read_at

-- コミュニティ投稿
posts
  id, cohort_id, author_id, content, photos[], posted_at

comments
  post_id, author_id, content, posted_at

-- 決済
purchases
  user_id, product_id, amount, payment_method
  installments[], status (active/refunded)

-- リード（販売前）
prospects
  id, email, line_id, quiz_responses_id
  funnel_stage (lead / educated / consultation / customer)
```

---

## 3. 戦略決定が必要なポイント（次に議論すべき論点）

筋肉塾の新サイト着手前に、のり氏と決めておくべき分岐点:

### 論点① 販売モデル
- A: 通年販売（Future型）
- B: 年集中ローンチ（Stu McLaren型）
- **C: ハイブリッド（推奨）**

### 論点② 価格表示
- A: LP に明示（推奨）
- B: 説明会で初提示（COMPASS型）

### 論点③ コーチング体制
- A: のり氏単独運営（均質）
- B: 認定講師制（拡張性）
- C: 自走型（最小限の人手）

### 論点④ コミュニティ機能
- A: 自前実装（独立性）
- B: Discord / Slack 連携
- C: Facebook グループ（プラットフォーム借り）

### 論点⑤ 退会・返金ポリシー
- A: 14日返金（Stu McLaren / Future型）
- B: 30日返金（RIZAP型）
- C: 返金なし（既存エキスパ流）

### 論点⑥ データ自動取得
- A: 完全手動入力
- B: HealthKit / Google Fit 連携（推奨）

### 論点⑦ ローンチ前フリーコンテンツの厚み
- A: 既存特典LPで十分
- B: 専用ローンチワークショップを毎期作る

---

## 4. 「やらないこと」リスト（避けるべきアンチパターン統合）

| 由来 | やらないこと |
|---|---|
| Stu McLaren | Facebookグループ依存（プラットフォームリスク） |
| Stu McLaren | ローンチ集中型のみ（時期外の収益機会損失） |
| RIZAP | 店舗訪問前提（完全オンラインの強みを潰す） |
| RIZAP | カウンセリングを「セールスの場」にして押し売り感を出す |
| Future | コミュニティ機能を捨てる（孤独感） |
| Future | 機材依存（Apple Watch持ってないと体験劣化） |
| COMPASS | 料金非公開で透明性を捨てる |
| COMPASS | 入会まで多ステップ過ぎる（4本動画→LINE→説明会） |
| COMPASS | 「説明会 = セールス」の押し売り構造 |
| 全社共通 | 受講生間の差別（プラン違いでの機能制限を露骨にする） |

---

## 5. 次のアクション（提案）

研究フェーズは完了。次のフェーズへの提案:

1. **論点①〜⑦ をのり氏ヒアリングでクリア**（30分〜1時間の対話）
2. **動線整理（別チャットで進行中）の成果物とこのリサーチを統合**
3. **MVP スコープ確定**（このリサーチを基に「何を作って何を作らないか」を切る）
4. **Supabase テーブル設計第1稿**（本ドキュメント §2D を起点に）
5. **LP / 会員サイトのワイヤーフレーム**（本ドキュメント §2C を起点に）

---

## 6. ドキュメント参照リンク

- [01_longlist.md](01_longlist.md) — 30社一覧
- [02_midlist.md](02_midlist.md) — 10社中レベル調査
- [03_deepdive_stu_mclaren_tribe.md](03_deepdive_stu_mclaren_tribe.md) — 販売戦略の参考
- [03_deepdive_rizap.md](03_deepdive_rizap.md) — アプリUI・食事フロー
- [03_deepdive_future.md](03_deepdive_future.md) — 入会クイズ・1on1動線
- [03_deepdive_compass.md](03_deepdive_compass.md) — 動画ファネル・コミュニティ
