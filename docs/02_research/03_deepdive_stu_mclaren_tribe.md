# 03 深掘り: Stu McLaren TRIBE / The Membership Experience

**URL**: https://stu.me/ ・ https://themembershipexperience.com/
**価格**: $1,997 一括（約31万円） / 分割 6回×$397（約37万円）
**販売形態**: 年1回ローンチ型
**筋肉塾との関係**: **価格帯がほぼ完全一致**、販売戦略の最有力ロールモデル

---

## 1. サイト構造（サイトマップ推測）

```
stu.me（本人ブランドのハブ・通年運営）
├── /                              ホーム（書籍・無料ガイド導線）
├── /book                          書籍「Predictable Profits」
├── /podcast                       Marketing Your Business
├── /community                     無料Facebookグループ案内
├── /ultimate-bundle               $47 エントリー商品
└── /membership-io                 プラットフォーム（自社製品）

themembershipexperience.com（本商品・通年Waitlist / ローンチ時のみ販売）
├── /                              通年: Waitlist 登録ページ
├── /workshop                      ローンチ前: 無料ワークショップ登録
├── /enrollment                    ローンチ期間中: 販売ページ
├── /sales                         注文ページ
└── /thank-you                     購入完了

Membership.io（会員ポータル = 購入後の学習場所）
├── /modules                       7モジュール
├── /lessons                       レッスン視聴
├── /community                     コミュニティ（FBグループへの導線）
├── /q-and-a                       ライブQ&A
└── /resources                     ワークシート・テンプレート
```

**3層構造のサイト分離**: 「ブランドハブ」「商品LP」「会員ポータル」を完全分離。それぞれのドメインで役割が明確。

---

## 2. 主要ページの動線詳細

### A. 通年（ローンチ外の時期）

```
SNS/Podcast/書籍/Google検索
   ↓
stu.me または themembershipexperience.com
   ↓
[無料コンテンツDL]
- 無料ガイド（10万DL）
- 書籍「Predictable Profits」
- ポッドキャストフォロー
   ↓
メアド登録（Waitlistへ）
   ↓
メルマガで関係構築（数ヶ月〜1年）
```

### B. ローンチ期間（年1回・数週間）

```
Waitlist登録者にローンチ告知
   ↓
無料ワークショップ（通常 3〜5本のライブ配信）
   ↓
[ワークショップ最終回 = 販売開始]
   ↓
販売ページ（価格・特典提示）
   ↓
購入（一括 or 分割）
   ↓
期間限定で受付終了（通常 5〜7日）
```

### C. 購入後（学習体験）

```
購入完了メール
   ↓
Membership.io へのログインリンク
   ↓
モジュール1 リリース（14日返金カウントダウン開始）
   ↓
モジュール2〜7 を週次でドリップ配信
   ↓
ライブQ&A セッション
   ↓
Facebookコミュニティ参加
   ↓
卒業（次年の販売時にアフィリエイト or 上位コーチング招待）
```

---

## 3. 入会から退会までのフルジャーニー

| フェーズ | 期間 | 顧客の状態 | 仕掛け |
|---|---|---|---|
| 認知 | 通年 | Stuの存在を知る | Podcast / 書籍 / SNS |
| 興味 | 通年 | コンテンツに触れる | 無料ガイド・無料動画 |
| 検討 | 数ヶ月〜1年 | メルマガで関係構築 | 価値提供 → 売り込みなし |
| 期待 | ローンチ直前 | Waitlistから招待 | カウントダウン・希少性 |
| 体験 | ローンチ中 | 無料ワークショップ参加 | 内容の一部を体験 |
| 決断 | 販売開始日 | 価格と特典を見る | 期間限定・ボーナス |
| 購入 | 期間内 | 決済 | 14日返金で安心 |
| 学習 | 6〜8週間 | モジュール視聴 | ドリップ配信で離脱防止 |
| 実践 | 数ヶ月 | 自社で会員制ローンチ | コミュニティで報告 |
| アップセル | 次年 | コーチング招待 | 上位プログラム |
| 退会 | 任意 | 14日以内なら返金 | 14日後は実質退会不可（買い切り） |

---

## 4. データ構造の推測

```
users
  - id, email, name, signup_date
  - waitlist_status (waiting / converted / unsubscribed)
  - lifetime_value

waitlists
  - user_id, workshop_id, joined_at

workshops（ローンチ前の無料ワークショップ）
  - id, title, scheduled_at, replay_url

purchases
  - user_id, product_id, amount, payment_plan, purchased_at
  - refund_status (active / refunded)

course_modules
  - id, title, release_offset_days, content_url

user_progress
  - user_id, module_id, completed_at

community_links
  - user_id, facebook_group_join_url（外部）
```

**注**: コミュニティ機能を自前で持たず、Facebookグループに外部依存。

---

## 5. 技術スタック（推測）

| 領域 | 推測スタック | 根拠 |
|---|---|---|
| LP・販売ファネル | **ClickFunnels** | HTMLメタタグ・URL構造から確認 |
| 動画ホスティング | **Searchie.io** | 動画埋め込みのソース |
| メルマガ | **ConvertKit / ActiveCampaign** | 業界標準 |
| 会員ポータル | **Membership.io**（自社） | Stu本人が共同創業 |
| 決済 | **Stripe** | 業界標準 |
| コミュニティ | **Facebook グループ**（外部） | LPに明記 |
| ライブ配信 | **Zoom** | 推測 |

---

## 6. 筋肉塾新サイト設計に活かせるポイント ⭐

### ① 3層ドメイン構造の参考
| 層 | 役割 | 筋肉塾への適用例 |
|---|---|---|
| ブランドハブ | のり氏の本人ブランド・無料情報 | norifitness.com 全体 |
| 商品LP | 筋肉塾の販売専用LP | kinnikujuku.norifitness.com など |
| 会員ポータル | 受講生限定の学習・コミュニティ | members.kinnikujuku.norifitness.com など |

### ② ローンチ型販売（年1〜2回集約）
- **通年販売せず、年1回（or 2回）に集約**することで「希少性」を演出
- **無料ワークショップ3〜5本 → 販売** の流れが世界標準
- ローンチ前のメルマガでリストを温める

### ③ Waitlist + 無料コンテンツによる「事前温度上げ」
- Waitlist 登録者には**ローンチ前に教育コンテンツを連続提供**
- 売り込みではなく「価値提供」で関係を作る
- 結果として販売開始日のCVRが極端に高くなる

### ④ 14日返金保証 = 「条件付き安心感」
- モジュール1 リリース後14日 = 主要価値を見せた後に返金可
- 「全モジュール完了後の返金不可」が暗黙の条件
- 心理的ハードルを下げつつ、悪用も防ぐ

### ⑤ コンテンツのドリップ配信
- 全モジュールを即座に開放せず、週次で1モジュールずつリリース
- 離脱防止＋次への期待感維持
- **筋肉塾の半年カリキュラムを月次〜週次でドリップする発想**

### ⑥ 無料 → エントリー商品 → メイン商品の階段
| 価格帯 | 商品例 | 役割 |
|---|---|---|
| ¥0 | ガイド・書籍・ポッドキャスト | リスト獲得 |
| 約7,000円（$47） | Ultimate Bundle | 購買習慣・小コミット |
| 約31万円（$1,997） | Membership Experience | メイン商品 |
| （高単価） | コーチング・マスターマインド | アップセル |

→ **筋肉塾でも「炭水化物の取扱説明書」などの特典が¥7,000〜の Mini商品 ポジションになり得る**

---

## 7. 避けるべきアンチパターン

### ❌ Facebookグループ依存
- プラットフォームリスク（Meta側のポリシー変更で消える）
- 退会・参加管理が不便
- **筋肉塾は自前コミュニティ（Discord / 専用UI）を持つべき**

### ❌ ローンチ集中型のみ（時期外の収益化なし）
- 年1〜2回しか売らないと、機会損失大
- **筋肉塾は「常時受付＋年2回の集中ローンチ」のハイブリッドが現実的**

### ❌ 売り切り型（リピート売上が立たない）
- 一度購入したら次の購入動機が薄い
- **筋肉塾は「卒業生 → アルムナイ会員」など継続課金の道を残す**

---

## 8. 出典

- [The Membership Experience 公式](https://themembershipexperience.com/)
- [Matt McWilliams レビュー 2026](https://www.mattmcwilliams.com/tribe-course-stu-mclaren-review-bonuses/)
- [Stu.me 公式](https://stu.me/)
