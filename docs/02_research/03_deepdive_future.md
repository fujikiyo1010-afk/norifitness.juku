# 03 深掘り: Future（純オンラインパーソナルトレーニング）

**URL**: https://www.future.co/
**価格**: 初月 $50 → $199/月（約30,800円）
**販売形態**: 月額サブスク・常時受付
**筋肉塾との関係**: **純オンラインPTの最完成形**、動線・コーチマッチング・アプリUIの直接参考

---

## 1. サイト構造（サイトマップ推測）

```
future.co（マーケサイト）
├── /                              ホーム（CTA: Find Your Coach）
├── /quiz                          1分クイズ（コーチマッチング）
├── /coaches                       コーチ一覧（プロフィール）
├── /how-it-works                  仕組み説明
├── /pricing                       料金（初月$50・通常$199）
├── /faq                           よくある質問
├── /apple-watch                   Apple Watch統合の説明
├── /reviews                       レビュー・実績
├── /privacy・/terms               法務系
└── App Store / Google Play 誘導

Future アプリ（iOS / Android）
├── オンボーディング（intake call）
├── ホーム（今日のワークアウト）
├── ワークアウト実行画面（動画・タイマー・形チェック）
├── コーチチャット（テキスト・ビデオ・画像）
├── プログラム一覧（コーチが作成）
├── プログレス（Apple Watch経由データ）
└── 設定・支払い管理
```

---

## 2. 主要ページの動線詳細

### A. 認知 → 入会（初回ジャーニー）

```
SNS広告 / YouTube / レビューサイト
   ↓
future.co トップ
   ↓
「Find Your Coach」 CTA クリック
   ↓
[1分クイズ - 約8質問]
- 目標（ダイエット/筋肥大/持久力等）
- 現在の運動レベル
- 1週間に運動できる日数
- 利用可能な機材（ジム/自宅/最小限）
- 怪我・身体的制限
- 年齢・性別
- ライフスタイル（仕事・家族）
- メールアドレス
   ↓
[コーチマッチング結果]
- 3〜5名のコーチプロフィール提示
- 各コーチの実績・専門領域・写真
- 「このコーチを選ぶ」ボタン
   ↓
コーチ選択
   ↓
$50 で初月開始（クレカ登録）
   ↓
App Store / Google Play へ誘導
```

### B. オンボーディング（契約後）

```
アプリインストール → ログイン
   ↓
ウェルカム動画（コーチからのパーソナルメッセージ）
   ↓
intake call 予約（30〜45分）
   ↓
intake call（電話 or ビデオ）
- より詳細な目標・スケジュール・好み
- 過去のトレーニング経験
- 怪我の詳細
   ↓
コーチが3〜5日かけて完全パーソナルプラン作成
   ↓
プラン公開 → 初回ワークアウト
```

### C. 継続体験

```
毎週: コーチが翌週分のプログラム作成
   ↓
ユーザー: 任意の日にワークアウト実行
   ↓
Apple Watch連携: 心拍・カロリー・時間を自動記録
   ↓
ワークアウト後: コーチに状況フィードバック
   ↓
コーチ: テキスト・ビデオでチェックイン（週2〜3回）
   ↓
[月次サイクル]
- 進捗レビュー（ビデオ通話）
- プラン調整
   ↓
継続 or キャンセル（30日以内なら全額返金）
```

---

## 3. 入会から退会までのフルジャーニー

| フェーズ | 期間 | 顧客の状態 | 仕掛け |
|---|---|---|---|
| 認知 | - | 広告経由でFutureを知る | "$50 first month" の引き |
| 興味 | 数分 | LP閲覧 → クイズ開始 | 1分の低ハードル |
| マッチ | 1〜2分 | コーチプロフィール閲覧 | 顔写真・実績で「人」を選ぶ |
| 決済 | 即時 | $50 課金 | 通常の1/4 で初月 |
| 期待 | 1〜3日 | アプリDL・intake待ち | 担当が決まる安心感 |
| intake | 30〜45分 | コーチとビデオ通話 | 一気にロイヤリティ↑ |
| 開始 | 5〜7日 | プラン受領・初回実行 | パーソナル感 |
| 継続 | 月次 | ワークアウト＋チャット | Apple Watch自動記録 |
| 評価 | 30日 | 結果が見え始める | 月次ビデオレビュー |
| 課金 | 31日目〜 | $199 自動課金開始 | 「来月もコーチを保持」 |
| 解約 | 任意 | アプリから即解約 | 摩擦低 |
| 30日返金 | 30日以内 | 不満足なら全額返金 | 安心保証 |

---

## 4. データ構造の推測

```
users
  - id, email, phone, name
  - signup_source, quiz_responses_id
  - apple_health_authorized, current_coach_id

quiz_responses
  - user_id, goal, fitness_level, days_per_week
  - equipment, injuries, age, gender, lifestyle

coaches
  - id, name, photo_url, bio, specialties[]
  - certifications, years_experience, accepting_clients

coach_matches
  - user_id, coach_ids[], selected_coach_id, matched_at

intake_calls
  - user_id, coach_id, scheduled_at, completed_at, notes

programs
  - id, user_id, coach_id, name, start_date

workouts
  - id, program_id, day_of_week, exercises[]
  - estimated_duration, video_intro_url

workout_logs
  - workout_id, user_id, started_at, completed_at
  - heart_rate_data (Apple Watch), perceived_exertion

messages
  - sender_type (coach/user), conversation_id
  - content_type (text/video/image), content, sent_at

subscriptions
  - user_id, plan, amount, next_billing_date, status

health_data（Apple Watch連携）
  - user_id, recorded_at, type (heart_rate/calories/steps)
  - value, source
```

---

## 5. 技術スタック（推測）

| 領域 | 推測スタック | 根拠 |
|---|---|---|
| アプリ | iOS/Android ネイティブ（Swift/Kotlin） | パフォーマンス重視・HealthKit深い統合 |
| バックエンド | AWS or GCP | スケーラビリティ |
| メッセージング | カスタム or Sendbird/Twilio | リアルタイム性 |
| Apple Watch | HealthKit + Future独自アプリ | リアルタイム同期 |
| 動画ホスティング | Mux or AWS CloudFront | エクササイズ動画大量 |
| LP（future.co） | Next.js / Webflow | モダンSPA系 |
| 決済 | Stripe | サブスク標準 |
| 解析 | Mixpanel / Amplitude | プロダクト分析 |

---

## 6. 筋肉塾新サイト設計に活かせるポイント ⭐

### ① 1分クイズによる超低ハードル開始
- 8質問・1分で完了（メアド入力は最後）
- ユーザーは「コーチを選ぶ楽しみ」を体験
- マッチング = ゲーム化
- **筋肉塾への適用**: 入会前に「あなたに合う学習プラン診断」「目標タイプ診断」を置く

### ② 「人」を選ぶ体験 = コーチプロフィールの作り込み
- 写真・実績・専門領域を明記
- 「このコーチに任せたい」という人格的信頼
- **筋肉塾**: のり氏のキャラクター・実績を前面に。複数講師制ならプロフィール強化

### ③ 初月 $50 = 通常価格の 1/4 という「お試し」設計
- 月額$199 が通常 → 初月$50
- 「とりあえず1ヶ月」のハードル激減
- 31日目から通常価格自動課金
- **筋肉塾**: 初月割引や「最初の月＝低単価でお試し」型を検討

### ④ Apple Watch / HealthKit 統合（自動データ取得）
- ユーザー入力ほぼ不要
- 心拍・カロリー・歩数を自動同期
- **筋肉塾**: 食事は手動だが、体重・歩数・心拍は HealthKit / Google Fit 経由で自動化検討

### ⑤ コーチによるビデオチェックイン（短尺・週2〜3回）
- テキストだけでなく動画で「顔を見せる」
- パーソナル感の極致
- **筋肉塾**: のり氏 or 講師による週次ビデオフィードバック（事前録画）

### ⑥ 30日返金保証 = サブスクの購買障壁を下げる
- 31日目に自動課金 = 30日間は完全リスクフリー
- 「合わなかったら返す」という心理的余裕
- **筋肉塾**: 半年契約なら「最初の30日返金」を真似できる

### ⑦ シンプルなアプリUX
- ホーム = 今日のワークアウト1択
- チャット = コーチとの直線
- 余計な機能なし
- **筋肉塾**: MVPは「今日やること」「のり氏チャット」「進捗」の3画面でも十分機能する

---

## 7. 避けるべきアンチパターン

### ❌ コミュニティ機能の欠如（孤独感）
- 完全1on1のため、他受講生との交流ゼロ
- ピアプレッシャー・横の繋がりがない
- **筋肉塾**: 同期コミュニティ・進捗共有を持つことで Future の弱点を補える

### ❌ コーチ依存（個別差大）
- 担当コーチの質・相性で体験が大きく変わる
- 不満時にコーチ変更可能だが、関係構築リセット
- **筋肉塾**: のり氏単独運営なら「均質性」が強み、複数講師なら標準化必要

### ❌ 価格体系の単純さ（個別対応で差別化できない）
- 全員 $199/月の一律
- 重度に手厚いコーチング層を作れない
- **筋肉塾**: 既に¥327,800 の半年契約という独特な価格モデル＝差別化済み

### ❌ Apple Watch持っていないユーザーへの体験劣化
- HealthKit前提の設計
- Android ユーザーは Google Fit で代替できるが劣化
- **筋肉塾**: 機材依存しない手動入力 UI も用意する

---

## 8. 出典

- [Future 公式](https://www.future.co/)
- [Future Pro App Store](https://apps.apple.com/us/app/future-pro-personal-training/id1288178982)
- [Best Online Personal Trainers (Fortune)](https://fortune.com/article/best-online-personal-trainers/)
