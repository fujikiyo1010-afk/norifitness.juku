# 食事メニューPDF 原本（テンプレート）

1週間食事メニューPDFの作り方の原本。企画書＝ `norifitness/_食事メニュー機能_企画メモ.md`。

## ファイル
- `template_資料版.html` … A4縦の冊子（表紙＋作り置き＋7日×各1P）。各食に材料・作り方・kcal/PFC、日計PFC、表紙に条件＋1日の目標。
- `template_給食版.html` … A4横の1週間一覧表（給食献立表スタイル）。

## PDFの作り方（原本手順）
1. 各HTMLの中身を対象者のデータで差し替える（献立・数値・条件）。
2. Chrome ヘッドレスで各HTMLをPDF化（背景色を出すため print-color-adjust を各テンプレに内蔵済み）:
   ```
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="資料版.pdf" "file://$PWD/template_資料版.html"
   "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="給食版.pdf" "file://$PWD/template_給食版.html"
   ```
3. 縦冊子＋給食横1枚を結合（venv の pypdf を使用）:
   ```
   ~/Desktop/norifitness/.venv/bin/python - << 'PY'
   from pypdf import PdfWriter, PdfReader
   w=PdfWriter()
   for f in ["資料版.pdf","給食版.pdf"]:
       for p in PdfReader(f).pages: w.add_page(p)
   with open("完成.pdf","wb") as fp: w.write(fp)
   PY
   ```
4. 完成PDFを のり添削 → 承認版を「食事メニュー｜献立ライブラリ」ドライブフォルダへ。

## 数値ルール（案B：ミニ成分表＋コード計算）
- P＝体重×2 ／ F＝カロリー×脂質比率(25%)÷9 ／ C＝残り。
- カーボサイクル：P・F固定、糖質のみ 高1.85／中1.0／低0.5 で配分、週合計は一定に正規化。
- 食物繊維は毎日20〜25g。数値は日本食品標準成分表(八訂)準拠のミニ成分表で計算。

## 高中低（カーボサイクル強度）の取得元
`user_workout_menu`（受講生に割当て済みの7日筋トレメニュー）の日ごとの主部位／種別から自動判定できる:
- 脚・背中・全身 → 高
- 胸・腕・肩・お尻・体幹・有酸素 → 中
- 種別=休息 → 低
※これは「割当てメニュー(予定)」で、実施記録は不要。メニュー未割当の場合はフォールバック（カルテ頻度から自動配分／注文票で週の予定を聞く／既定パターン）。
