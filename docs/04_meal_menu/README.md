# 食事メニューPDF 原本（テンプレート）

1週間食事メニューPDFの作り方の原本。企画書＝ `norifitness/_食事メニュー機能_企画メモ.md`。作成キット＝ `献立作成キット_Claude用.md`。

## ファイル
- `template_資料版.html` … A4縦の冊子（表紙＋作り置き＋7日×各1P）。**最終デザイン反映済み**（下記）。
- `template_給食版.html` … A4横の1週間一覧表（給食献立表スタイル）。
- `generate_menu.py` … 献立データ(JSON)＋成分表から資料版/給食版HTMLを生成するスクリプト（横下さん版が原型。`DISH`・`cover` を対象者に差し替えて使う）。
- `food_table.py` … ミニ成分表（八訂）＋ `calc()`。
- `sample_plan_yokoshita.py` … 横下さん版の献立プラン（食材×g）＋計算のサンプル。新規は これを複製して食材/g を編集。

## 確定デザイン（2026-07 反映済み・今後の標準）
1. **給食スタイル1枚（A4横）を冊子の最後に結合**（1枚で1週間を見渡す）
2. 文字は大きめ（料理名20px・kcal/PFCチップ16px・日計kcal34px 等）
3. 色は抑える（テール緑1色。強い差し色なし）
4. フッターの帯は無し（`.pfoot{display:none}`）
5. タイトルは「**◯◯さんの1週間メニュー**」
6. サブコピー＝「のりfitness監修のもと、のりfitness AI とともに 動画455本・論文308本を読み込み、一食ずつ組み上げました。過去動画内のレシピを参考の軸に、専用メニューに仕上げました。」
7. 表紙「あなたの条件」は全項目（からだ・目標／運動／目的／食べないもの／好き／生活／やる気）
8. 表紙「1日の目標」にエネルギー＋PFCを明示（カーボサイクル時は高低カロリーも）
9. 目標は2行（1行目エネルギー、2行目たんぱく質から）
10. 各日ページ下部に運用ノート（例：食後りんご酢・もち麦・味噌汁 等、対象者に応じて）

## PDFの作り方（手順）
1. `sample_plan_yokoshita.py` を複製し、対象者の食材×g を編集 → 実行して `〇〇_out.json` を出力（数値検算つき）。
2. `generate_menu.py` の `DISH`（料理名・作り方）と `cover`（条件・目標）を対象者に差し替え、実行 → `menu.html` / `kyushoku.html` を出力。
3. Chrome ヘッドレスでPDF化（背景色を出す print-color-adjust は内蔵済み）:
   ```
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="shiryo.pdf" "file://$PWD/menu.html"
   "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="kyushoku.pdf" "file://$PWD/kyushoku.html"
   ```
4. 縦冊子＋給食横1枚を結合（venv の pypdf）:
   ```
   ~/Desktop/norifitness/.venv/bin/python - << 'PY'
   from pypdf import PdfWriter, PdfReader
   w=PdfWriter()
   for f in ["shiryo.pdf","kyushoku.pdf"]:
       for p in PdfReader(f).pages: w.add_page(p)
   with open("完成.pdf","wb") as fp: w.write(fp)
   PY
   ```
5. 完成PDFを のり添削 → 承認版を「食事メニュー｜献立ライブラリ」ドライブフォルダへ。

## 数値ルール（案B：ミニ成分表＋コード計算）
- P＝体重×2 ／ F＝カロリー×脂質比率(25%)÷9 ／ C＝残り。
- カーボサイクル：P・F固定、糖質のみ 高1.85／中1.0／低0.5 で配分、週合計は一定に正規化。
- **均一**：毎日同じ（糖質も固定）。「均一」希望 or 筋トレ予定が取れない時の既定。
- 食物繊維は毎日20〜25g。数値は日本食品標準成分表(八訂)準拠のミニ成分表で計算。
- のりが目標シートでPFC・カロリー・カーボパターンを指定済みの場合は**それを最優先**で使う。

## 高中低（カーボサイクル強度）の取得元
`user_workout_menu`（受講生に割当て済みの7日筋トレメニュー）の日ごとの主部位／種別から自動判定できる:
- 脚・背中・全身 → 高 ／ 胸・腕・肩・お尻・体幹・有酸素 → 中 ／ 種別=休息 → 低
※「割当てメニュー(予定)」で実施記録は不要。未割当の場合は**均一**を既定にする。

## データ取得（本番）
prod Supabase（`fqfsgkzyotvpcxmszkax`）から SELECT で対象者の `user_workout_carte` / `goal_sheets` / `body_metrics` / `user_profiles` / `user_workout_menu` を取得（service_role キーを `/tmp/.env.prod` に置いて curl）。詳細手順はチャット履歴／memory参照。
