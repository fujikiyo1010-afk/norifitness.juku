# Supabase Pro / Vercel Pro 切替ガイド (= L-1 + L-7)

**作成**: 2026-06-19 (D-Pro)
**実施タイミング**: 招待発射の直前 (= 数日前) ・ 課金開始日を最小化
**月額合計**: $25 + $20 = **$45/月 ≈ 6,500 円/月** (= 為替次第)

---

## L-1 ・ Supabase Pro 切替 ($25/月)

### なぜ必要か

| Free プラン | Pro プラン |
|---|---|
| MAU 50,000 / 月 | **100,000 / 月** |
| 7 日 inactive で **自動 pause** ← 受講生に致命的 | pause なし |
| バックアップなし | **daily backups + PITR** (Point in Time Recovery) |
| 監査ログ なし | あり |

**特に「7 日 inactive で自動 pause」** が運用上致命的 (= 連休 / 春節 等で受講生がアプリ開かないと、 アプリ落ちる)。

### 手順 (= 10 分)

1. https://supabase.com/dashboard/project/fqfsgkzyotvpcxmszkax を開く
2. 左メニュー **「Project Settings」 → 「Billing」**
3. **「Upgrade to Pro」** ボタンをクリック
4. 支払い方法 (= クレジットカード) 入力
5. 確認 → 「Subscribe」
6. **数分以内に Pro 適用**

### 切替後 確認

- Settings → Plan が 「Pro」 表示
- バックアップ設定 確認 → デフォルトで daily 有効

---

## L-7 ・ Vercel Pro 切替 ($20/月)

### なぜ必要か

| Hobby プラン | Pro プラン |
|---|---|
| 個人利用のみ | **商用利用 OK** ← 重要 |
| Cron job **1 件まで** | **40 件まで** |
| Bandwidth 100 GB | 1 TB |
| Analytics 無し | 基本 Analytics 込み |

**特に「商用利用 OK」 が必須** (= Hobby プランで商用は規約違反)。

### 手順 (= 10 分)

1. https://vercel.com/fujikiyo1010-afks-projects/norifitness-juku/settings/billing を開く
2. **「Upgrade to Pro」** ボタン
3. 支払い方法 (= 既に GitHub 連携してれば 何もしなくて OK の場合あり)
4. 確認 → 「Subscribe」

### 切替後 確認

- Settings → Plan が 「Pro」 表示
- Cron tab で job 一覧 (= 現在 1 件 / Pro なら追加可)

---

## 📅 推奨タイミング

| ステップ | 内容 |
|---|---|
| **招待発射 3 日前** | Supabase Pro 切替 → backup 開始 |
| **招待発射 1 日前** | Vercel Pro 切替 → 商用準備完了 |
| **招待発射 当日** | 既に Pro 環境 / 動作確認済 |

→ **早すぎる切替は無駄な課金になる、 遅すぎは「7日 inactive で pause」 等のリスク**。 3 日 - 1 日前 が安全。

---

## ⚠️ 切替後 不可逆?

両方とも **クリック 1 つでダウングレード可能** (= 翌月から Free に戻せる)。 ローンチが延期したら一旦戻す判断もアリ。

---

## 💰 コスト見直し (= ローンチ後 数か月で)

- 受講生 100 人以下: Supabase Free でも 50k MAU で足りる可能性 (= ただし pause リスク)
- 受講生 数千人: Pro 必須
- 1 人当たり LTV (= 受講料) > $45 なら問題なし

ローンチ 1 ヶ月後に実 MAU / 動作観察 → プラン継続/ダウン判断。
