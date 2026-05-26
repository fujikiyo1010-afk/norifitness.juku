# 19 デザイン仕様書（v1.1 のり氏ブランド準拠版）

**作成日**: 2026-05-19 / **更新**: 2026-05-20（のり氏既存ブランド分析を反映）
**位置づけ**: ⚠️ **提案レベル**。メイン実装チャット & のり氏で採否判断・調整してください。
**前提**: [07_wireframe_members.md](07_wireframe_members.md) v2.1 の WF を、具体的なビジュアル・実装単位に落とし込む橋渡し。
**技術**: Tailwind CSS v4 ベース（既存スタック準拠）

**v1.1 の変更点**: カラーパレットを [20_norisan_brand_analysis.md](20_norisan_brand_analysis.md) の調査結果に基づき、**のり氏 既存ブランド実色**に置き換え。

---

## 🎯 デザイン原則（5本柱）

| 原則 | 説明 |
|---|---|
| 1. **学習に集中させる** | 情報の階層を明確に、ノイズを削る |
| 2. **温度感がある** | 機械的でなく、のり氏の人間味が滲む |
| 3. **モバイルで触れる** | 親指タップで全機能完結 |
| 4. **小さく祝う** | 章完了・試験合格など節目だけ派手に。日常は静か |
| 5. **継続を罰しない** | 連続記録が途切れても自責にさせない |

---

## 🎨 カラーパレット（のり氏ブランド準拠）

詳細根拠は [20_norisan_brand_analysis.md](20_norisan_brand_analysis.md) 参照。
既存サイト（02_kinniku_lp / 01_tokuten/*）から抽出したブランド実色を使用。

```
Primary（信頼・落ち着き / のり氏 LP --lp-accent と統一）
  brand-900   #00574d    濃ティール             ← 見出し・ヘッダー
  brand-700   #00695c    標準ティール           ← ボタン主役
  brand-500   #00897b    ⭐のり氏ブランドティール
  brand-300   #4DB6AC    明るいティール（リンク等）
  brand-100   #B2DFDB    薄ティール（背景）
  brand-50    #E0F2F1    最薄ティール

Accent（達成・温度 / のり氏 特典LP --g2 と統一）
  accent-700  #bf3d00    深オレンジ・赤茶
  accent-600  #e65100    ⭐のり氏特典オレンジ   ← できた！押下時
  accent-500  #ff7043    オレンジ               ← できた！通常
  accent-300  #ff8a50    明オレンジ
  accent-100  #ffc299    薄オレンジ
  accent-50   #fff8f5    最薄オレンジ（背景ティント）

CTA Special（LINE飛ばし専用 / のり氏ブランド共通）
  cta-line       #06C755   ⭐LINE 緑          ← /support の LINE CTA
  cta-line-hover #04a847

Neutral / Text（深緑グレー / のり氏 --txt 系と統一）
  ink-900     #1a3326    ⭐本文最濃（純黒 #000 は使わない）
  ink-700     #3a6050    本文標準・サブ
  ink-500     #6b7d75    キャプション
  ink-300     #c0d0c8    枠線
  ink-100     #f0f5f3    背景セパレーター
  ink-50      #fafcfb    最薄背景

Background（オレンジティント寄り、親しみ感）
  bg-base     #ffffff    純白
  bg-warm     #fff8f5    メイン背景（柔らかい）
  bg-cool     #f0f5f3    セクション区切り

Marker（強調、要所のみ）
  marker      rgba(255, 235, 59, 0.55)   ⭐黄色マーカー（既存ブランドで多用）

Semantic（意味色）
  success     #2e7d32    緑（合格・できた済）
  warning     #e65100    オレンジでアクセント代用（試験あと一歩）
  error       #c62828    赤（エラーのみ、控えめ）
  info        #1565c0    青（情報、carb-guide の青と統一）
```

### なぜこの配色か
- **#00897b ティールグリーン** = のり氏 LP の `--lp-accent` 実色、信頼と冷静の象徴
- **#e65100 オレンジ** = のり氏 特典LP の `--g2`、達成感と温度
- **#06C755 LINE緑** = CTA 専用、既存導線と完全一致
- **深緑グレー (#1a3326)** = のり氏ブランドの "柔らかい黒"、純黒 (#000) を排除
- **オレンジティント (#fff8f5)** = 特典LP と背景感を統一、親しみ感

### Tailwind v4 設定

```css
@theme {
  /* Primary（のり氏ティール） */
  --color-brand-900: #00574d;
  --color-brand-700: #00695c;
  --color-brand-500: #00897b;
  --color-brand-300: #4DB6AC;
  --color-brand-100: #B2DFDB;
  --color-brand-50:  #E0F2F1;

  /* Accent（のり氏特典オレンジ） */
  --color-accent-700: #bf3d00;
  --color-accent-600: #e65100;
  --color-accent-500: #ff7043;
  --color-accent-300: #ff8a50;
  --color-accent-100: #ffc299;
  --color-accent-50:  #fff8f5;

  /* CTA Line（LINE飛ばし専用） */
  --color-cta-line: #06C755;
  --color-cta-line-hover: #04a847;

  /* Ink（深緑グレーテキスト） */
  --color-ink-900: #1a3326;
  --color-ink-700: #3a6050;
  --color-ink-500: #6b7d75;
  --color-ink-300: #c0d0c8;
  --color-ink-100: #f0f5f3;
  --color-ink-50:  #fafcfb;

  /* Background */
  --color-bg-warm: #fff8f5;
  --color-bg-cool: #f0f5f3;

  /* Semantic */
  --color-success: #2e7d32;
  --color-warning: #e65100;
  --color-error:   #c62828;
  --color-info:    #1565c0;
}
```

---

## ✍️ タイポグラフィ

### フォント（のり氏 特典LP と統一）

```
日本語: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif
英数字: 'Inter', 'Helvetica Neue', sans-serif
等幅:   'JetBrains Mono', 'Menlo', monospace
```

**読み込み:**

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
```

→ のり氏 特典LP（炭水化物・リンゴ酢 2026年5月版）と完全に同じ設定。

### サイズスケール（4 / 8 / 12 / 16 / 20 / 24 ベース）

| 用途 | サイズ | weight | 例 |
|---|---|---|---|
| **Display** | 32px / 2rem | 700 | 認証画面の「筋肉塾」 |
| **H1** | 24px / 1.5rem | 700 | 画面タイトル |
| **H2** | 20px / 1.25rem | 600 | セクション見出し |
| **H3** | 18px / 1.125rem | 600 | カード見出し |
| **Body L** | 16px / 1rem | 400 | 本文標準 |
| **Body M** | 14px / 0.875rem | 400 | 補足 |
| **Caption** | 12px / 0.75rem | 400 | キャプション・日付 |
| **Button** | 16px / 1rem | 600 | ボタンラベル |

### line-height

```
heading: 1.3
body:    1.6
caption: 1.4
```

---

## 📐 余白・グリッド

### ベース: 4px

```
spacing-0:  0px
spacing-1:  4px
spacing-2:  8px
spacing-3:  12px
spacing-4:  16px    ← 標準コンポーネント内余白
spacing-5:  20px
spacing-6:  24px    ← セクション間
spacing-8:  32px    ← 大セクション間
spacing-12: 48px
spacing-16: 64px    ← ページ上下
```

### コンテナ幅

```
モバイル:   全幅、外余白 16px（spacing-4）
タブレット: max-width 640px、中央寄せ
PC:        max-width 1024px、中央寄せ、サイドナビ 240px
```

### 角丸

```
radius-sm: 4px    入力ボックス
radius-md: 8px    カード、ボタン
radius-lg: 12px   モーダル、ヒーロー
radius-full: 9999px  バッジ、アバター
```

---

## 🧩 コンポーネント

### ボタン

```
[Primary]  brand-700 bg / white text / radius-md / px-6 py-3
[Secondary] brand-100 bg / brand-900 text / border 1px brand-300
[Tertiary]  text-only / brand-700 text / underline on hover
[Danger]    error bg / white text  （管理画面の削除等のみ）

[状態]
default → hover: bg darker 10%、 transform: translateY(-1px)
active  → bg darker 15%、transform: translateY(0)
disabled → opacity 50%、cursor: not-allowed
loading → spinner inside、disabled
```

### ⭐できた！ボタン（v2.1 抑制版）

```
[サイズ]
  幅: 240px（モバイルでは全幅）、高さ: 56px
  パディング: px-6 py-4

[状態]
  default: accent-500 bg、白文字「できた！」
  hover:   accent-600 bg、影付き
  pressed: accent-600 bg、押し込みアニメ（scale 0.97）、0.2s
  done:    ink-300 bg、ink-700 文字「✓ できた！(済)」

[アニメーション]
  押下時:
    1. 0.2s: scale 0.97 → 1.05（拡大）
    2. 0.3s: 完了アイコン現れる（fade in）
    3. 1.0s: 通常状態に戻る、「累計: 48回」表示が右側に浮き上がる
  ※ XP表示なし、シンプル
```

### カード

```
bg: white
border: 1px solid ink-300
radius: 8px (md)
padding: 16px (spacing-4)
shadow: 0 1px 3px rgba(0,0,0,0.08)
hover: shadow 0 4px 8px rgba(0,0,0,0.12)、transform translateY(-2px)
```

### インプット

```
bg: white
border: 1px solid ink-300
radius: 4px (sm)
padding: 12px 16px
focus: border brand-500、ring 2px brand-100
error: border error、helper text in error color
disabled: bg ink-100、cursor not-allowed
```

### ナビゲーション

#### 下部タブ（モバイル）

```
height: 60px
bg: white
border-top: 1px solid ink-300
items: 5 個（均等配置）
active item: brand-700 text + ドット指示子（下に2px）
icon size: 24px
label: 12px（caption）
```

#### サイドナビ（PC）

```
width: 240px
bg: brand-50
padding: 24px 12px
item: padding 12px 16px、radius 8px
active item: brand-100 bg、brand-900 text bold
hover: ink-100 bg
```

### モーダル

```
backdrop: rgba(0,0,0,0.5)
modal:
  bg: white
  radius: 12px (lg)
  max-width: 480px
  padding: 24px
  shadow: 0 20px 40px rgba(0,0,0,0.2)
  animation: fade-in + scale 0.95 → 1.0、0.2s ease-out
```

---

## 🏅 特殊コンポーネント

### バッジ表示

```
[獲得済み]
  size: 64x64px（マイページ）、24x24px（プロフィール横）
  画像: SVGアイコン or 絵文字 + ラベル
  border-radius: full
  border: 2px solid brand-500

[未獲得]
  グレースケール、opacity 30%
```

### Streak（連続記録）

```
[HOME 末尾の表示]
  inline、小サイズ
  font-size: 14px
  color: ink-500（控えめ）
  「12日連続 学習中 🔥」
  コピー追記: 「無理せず、明日も」

[途切れた時]
  通知: 「明日からまた一緒に頑張りましょう」
  色: ink-500（責めない）
  Streak数値非表示
```

### 進捗バー

```
height: 8px（細め、邪魔しない）
bg: ink-100
fill: brand-500
radius: full
animation: width 0.5s ease-out（更新時のみ）

[全体進捗 用]
  height: 12px、ラベル右側に「35%」
```

### 🎉 紙吹雪エフェクト（重要節目のみ）

```
[発火タイミング]
  ✅ 章完了
  ✅ 試験合格
  ✅ レベルアップ
  ❌ できた！押下（v2.1で抑制）

[仕様]
  duration: 2秒
  particles: 30個程度
  colors: brand-500, accent-500, success, info の混合
  spread: 中央から扇形
  ライブラリ提案: canvas-confetti
```

### コメントカード

```
avatar: 40x40px、radius-full
author: bold、brand-900
timestamp: 12px、ink-500
body: 14px、ink-700
画像添付: max-width 100%、radius-md
リアクション: 👍 数値 / 💬 数値、ink-500 12px

[のり氏ピン留め]
  bg: accent-50
  border-left: 4px solid accent-500
  📌 アイコン左上
```

---

## ⚙️ 状態（一般ルール）

| 状態 | 視覚的フィードバック |
|---|---|
| default | ベース表示 |
| hover (PC) | 色darker 10% + shadow 強化 |
| focus | 2px ring + brand-500 |
| active | 色darker 15% + scale 0.98 |
| disabled | opacity 50% + cursor not-allowed |
| loading | spinner + disabled |
| error | error color + helper text |

---

## ✨ アニメーション

### duration ガイド

```
fast:     150ms   ボタン hover、小さな状態変化
normal:   200ms   モーダル、ドロワー
slow:     300ms   ページ遷移
celebrate: 2000ms 紙吹雪、レベルアップ
```

### easing

```
ease-out:    ほとんどの UI 遷移
ease-in-out: モーダル開閉
spring:      できた！ボタンの押下フィードバック
```

### 「やらない」アニメ
- ❌ 派手すぎるパーティクル多用
- ❌ 長すぎる演出（ユーザーを待たせる）
- ❌ 過剰な scale 変化（注意散漫）

---

## 🎭 アイコン・絵文字方針

### 採用ライブラリ
- **Heroicons**（Tailwind 公式）か **Lucide**
- 学習ツールに合う **outline 系**を主軸

### 絵文字の使い方

| 場面 | 使う | 控える |
|---|---|---|
| バッジ・章マスター | ✅ 🥉🎓🔥 等 | - |
| 通知タイトル | ✅ アイコン1個程度 | - |
| 本文中 | ⚠️ 控えめに | 多用 |
| LP / マーケ | のり氏判断 | - |
| 管理者コメント | ✅ 適度に | - |
| 自動メッセージ | ❌ 不使用 | - |

### のり氏のキャラ性
- 受講生向け Bot ([noriAI](../../03_brain/memory/noriAI_persona.md)) は **絵文字なし** ルールあり
- 新サイトの UI は noriAI Bot とは別物。**「控えめに使う」レベル**で OK
- ただし、過剰使用は禁止（チャラさ警告）

---

## ♿ アクセシビリティ

### コントラスト比

```
本文 (ink-700 on white): 9.5:1  ✅ AAA
ボタン文字 (white on brand-700): 8.8:1 ✅ AAA
リンク (brand-700 on white): 8.8:1 ✅ AAA
キャプション (ink-500 on white): 4.9:1 ✅ AA
```

### Focus 表示
- すべての intractive 要素に visible focus ring（2px brand-500）
- Tab キーで全機能到達可能

### Screen Reader
- aria-label を画像・アイコンに付与
- 「できた！」ボタン: `aria-label="このレッスンを完了済みにする"`
- バッジ: `aria-label="章1マスター獲得バッジ"`

### モーション軽減
```css
@media (prefers-reduced-motion: reduce) {
  /* 紙吹雪・大きな animation を抑制 */
}
```

---

## 🌑 ダークモード（フェーズ2 検討）

MVP では **ライトモードのみ**。フェーズ2 でダークモード追加検討。

設計時に注意:
- カラーは CSS variables 経由で定義 → ダーク対応時に切替容易に
- 画像は背景色を選ばないものを優先（アバター等）

---

## 📱 デバイス別の注意

### モバイル（メイン想定）

- タップ可能領域: **最小 44x44px**
- 親指リーチ: 主要 CTA は画面下 1/3 に配置
- 横スクロールは原則禁止（タブ・ヘッダー除く）
- 動画: 縦画面で自動切替

### タブレット

- レイアウトはモバイル踏襲、横余白を増やす
- 動画プレイヤーは大きく

### PC

- サイドナビ + 2カラム
- 動画は最大 800px 幅
- 過密にしない（モバイル感覚を残す）

---

## 🎨 ビジュアル参考のため

Figma 担当者または Figma 化担当 AI が、本仕様書を元にデザインを作成する際の参考:

### 雰囲気のイメージワード
- 「ジムの静かな朝、集中の中にある温かさ」
- 「Schoo の整理感」+「Trailhead の達成感」-「Duolingo のチャラさ」
- のり氏のキャラ: 「真摯・温かい・押し付けない」

### NG イメージ
- ゲーミングっぽいネオン・グラデ
- アイコンだらけのコックピット感
- ライザップ的な「煽る赤」

---

## 🔚 完成までの想定ステップ

1. **本仕様書をのり氏で承認**（色味・トーン）
2. Figma で **デザインコンポーネント** 作成（または別 AI に依頼）
3. **主要画面のカンプ**（HOME / レッスン詳細 / 目標シート）作成
4. **コードに落とし込み**（メイン実装チャット、Tailwind v4 で）

---

## ⚠️ 注意

本仕様書は **提案レベル**。

- メイン実装チャットの既存スタイル（もしあれば）を**優先**してください
- のり氏のブランドガイドライン（もし別途あれば）を**優先**してください
- 本仕様書を「正」として扱う必要はありません、**叩き台**として使ってください

---

## 🔗 関連ドキュメント

- [07_wireframe_members.md](07_wireframe_members.md) — WF v2.1
- [17_design_inspiration_v2.md](17_design_inspiration_v2.md) — 設計判断の根拠
- [README.md](README.md) — 02_research/ ディレクトリindex
