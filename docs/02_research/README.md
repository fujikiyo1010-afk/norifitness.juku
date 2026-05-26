# 02_research/ ディレクトリ index

**最終更新**: 2026-05-19
**作成者**: 別チャット（リサーチ専任）
**目的**: 筋肉塾 新サイト構築における **UI/UX・デザイン・動線の参考素材**

---

## 🎯 このディレクトリの位置づけ

`00_premises/` が **プロジェクトの「前提」**（社長確認済み、DB設計、サイトマップ等）であるのに対し、
本 `02_research/` は **「他社事例から学んだ UI/UX の素材」** を集めたもの。

→ メイン実装チャットは、`00_premises/` を主とし、ここを **設計判断時の参考** として使う。

---

## 🟢 ライブ（参照推奨）

### 🎯 まず読むべき2ファイル

| ファイル | 役割 |
|---|---|
| [07_wireframe_members.md](07_wireframe_members.md) | **受講生サイト 全画面のワイヤーフレーム（v2.1 学習ツール最優先版）** |
| [17_design_inspiration_v2.md](17_design_inspiration_v2.md) | 6社からの「いいとこどり」設計判断の根拠 |

### 実装に直結する提案ファイル

| ファイル | 役割 |
|---|---|
| [18_supabase_schema_additions.md](18_supabase_schema_additions.md) | **+3 DBテーブルの SQL 提案**（lesson_reviews / lesson_bookmarks / real_world_actions） |
| [19_design_spec.md](19_design_spec.md) | **デザイン仕様書**（色・タイポ・余白・コンポーネント・状態・アニメ）— v1.1 のり氏ブランド準拠 |
| [20_norisan_brand_analysis.md](20_norisan_brand_analysis.md) | **のり氏 既存ブランド分析**（既存LPの実色・トーン抽出、19の根拠） |
| [21_microcopy_tone_guide.md](21_microcopy_tone_guide.md) | **マイクロコピー & トーンガイド**（言葉遣い・コピーカタログ） |
| [22_error_empty_loading_patterns.md](22_error_empty_loading_patterns.md) | **エラー・空状態・ローディングのUIパターン** |

### 補足参考ファイル

| ファイル | 内容 |
|---|---|
| [10_deepdive_schoo.md](10_deepdive_schoo.md) | Schoo 深掘り（学習時間グラフ・ノート・コメント） |
| [11_deepdive_shelikes.md](11_deepdive_shelikes.md) | SHElikes 深掘り（マイページ3ハブ構成） |
| [12_deepdive_skool.md](12_deepdive_skool.md) | Skool 深掘り（ゲーミフィケーション元ネタ、抑制適用） |
| [13_deepdive_kajabi.md](13_deepdive_kajabi.md) | Kajabi 深掘り（コース構造・ドリップ配信） |
| [14_deepdive_duolingo.md](14_deepdive_duolingo.md) | Duolingo 深掘り（継続率設計、抑制適用） |
| [15_deepdive_trailhead.md](15_deepdive_trailhead.md) | Trailhead 深掘り（バッジ・ランク、抑制適用） |
| [16_ui_patterns.md](16_ui_patterns.md) | 機能別UIパターン横断（できた！/試験/目標シート/進捗等） |

---

## ⚠️ 非推奨（読まなくてOK・履歴として保管）

これらは **コーチング型サービス前提**で書かれたもので、後に **サクセスラーニング型 学習プラットフォーム**という正しい前提を [handoff_2026-05-19.md](../00_premises/handoff_2026-05-19.md) から把握した結果、**前提ズレ**として非推奨化。

| ファイル | 非推奨理由 |
|---|---|
| [01_longlist.md](01_longlist.md) | 旧30社リスト、軸がコーチング型 |
| [02_midlist.md](02_midlist.md) | 旧10社中レベル調査 |
| [03_deepdive_compass.md](03_deepdive_compass.md) | コーチ養成スクール |
| [03_deepdive_future.md](03_deepdive_future.md) | オンラインPT、コーチング型 |
| [03_deepdive_rizap.md](03_deepdive_rizap.md) | パーソナルジム、コーチング型 |
| [03_deepdive_stu_mclaren_tribe.md](03_deepdive_stu_mclaren_tribe.md) | 販売戦略軸（LP用途で将来活用可） |
| [04_summary_and_recommendations.md](04_summary_and_recommendations.md) | 旧サマリー |
| [05_design_inspiration.md](05_design_inspiration.md) | 旧いいとこどり（17_v2 に置き換え） |
| [08_supabase_schema.md](08_supabase_schema.md) | 旧スキーマ案（[database_design_draft.md](../00_premises/database_design_draft.md) が正） |

---

## 🔄 主要な設計指針（v2.1 で確定）

### 順位
```
🥇 学習ツールであること（絶対）
🥈 使いやすさ・満足度・実施完工率
🥉 ゲーミフィケーション（学びの邪魔をしない範囲）
```

### v2.1 で抑制した要素
- ❌ XP表示の全廃（「+10 XP獲得！」等）
- ❌ レベル名「達人」「師範」等の廃止
- ❌ コメントに👍で+XP のルール廃止
- 🔽 連続記録（Streak）をヘッダーから外し、HOME 末尾に小さく
- 🔽 バッジ 20〜50個 → 12個に絞る
- 🔽 紙吹雪演出 → 章完了・試験合格の重要節目のみ

### v2.1 で統合した「学びを深める」5機能（画期的案）
1. 📝 **3行 振り返り**（レッスン後の学びの言語化、Feynman技法）
2. 🔖 **動画の瞬間スクラップ**（学びのハイライト保存）
3. 💪 **実生活への落とし込み**（学習→行動の橋渡し、目標シート連動）
4. 🌟 **先輩からの一言**（卒業生実体験、社会的学習）
5. 🔁 **逆向き学習モード**（試験を先に受けて苦手を狙い撃ち）

---

## 🆕 DB スキーマへの追加提案

[database_design_draft.md](../00_premises/database_design_draft.md) の 16テーブルに **+3 テーブル** 提案:

```
lesson_reviews         3行振り返り
lesson_bookmarks       動画の瞬間スクラップ
real_world_actions     実生活への落とし込み
```

詳細は [07_wireframe_members.md](07_wireframe_members.md) の最終セクション参照。

---

## 📍 統合作業の進め方（メインチャット向け）

⚠️ **重要**: メイン側の慣習・構造・意図を**絶対に壊さない**ように、本リサーチ成果は**参考程度**で取捨選択しながら採用してください。

1. **本ファイル（README.md）で全体像を把握**
2. **[07_wireframe_members.md](07_wireframe_members.md) を読む**（最重要）
3. **[17_design_inspiration_v2.md](17_design_inspiration_v2.md) で設計判断の根拠を確認**
4. **既存の [sitemap_draft.md](../00_premises/sitemap_draft.md) と突き合わせ、矛盾あれば調整**
5. **+3 DB テーブル追加の要否判断**（[18_supabase_schema_additions.md](18_supabase_schema_additions.md) の SQL 提案を参考に）
6. **デザイン着手前に [19_design_spec.md](19_design_spec.md) と [20_norisan_brand_analysis.md](20_norisan_brand_analysis.md) を確認**（のり氏ブランド準拠の色・タイポ・コンポーネント）
7. **実装時のコピー文言は [21_microcopy_tone_guide.md](21_microcopy_tone_guide.md) を参照**（学習ツール最優先のトーン）
8. **エラー・空状態・ローディングの実装時は [22_error_empty_loading_patterns.md](22_error_empty_loading_patterns.md) を参照**
9. **個別の深掘りファイル（10〜15）は必要時のみ参照**

---

## ⏭ 残タスク（任意）

本ディレクトリでは未着手:
- 管理画面 WF（**やらない判定済み**、管理側デザインは何でもよい・社長判断）
- LP の WF（社長意向で後回し）
- Figma 等での具体ビジュアル化（フェーズ2）— ただし [19_design_spec.md](19_design_spec.md) で叩き台あり
