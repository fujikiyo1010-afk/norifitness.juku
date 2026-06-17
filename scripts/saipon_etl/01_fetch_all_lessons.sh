#!/bin/bash
# scripts/saipon_etl/01_fetch_all_lessons.sh
#
# サイポン (saipon.jp/h/dyz555/4) の全コース/章/レッスン + Vimeo URL を取得
#
# 248 リクエスト構成:
#   - 1 件 ・ コース + 章 一覧 (取得済 /tmp/lessons.json を流用)
#   - 23 件 ・ 各 course_no で章のレッスン一覧
#   - ~224 件 ・ 各 lesson_no で動画 URL 含むレッスン詳細
#
# 前提:
#   - /tmp/saipon_curl.sh が存在 (Cookie/Header 流用)
#   - /tmp/lessons.json が存在 (1 回目 fetch 結果)
#
# 出力: /tmp/saipon_dump/

set -e

CURL_SH="/tmp/saipon_curl.sh"
OUTDIR="/tmp/saipon_dump"
SLEEP_SEC=1   # サーバー負荷配慮

mkdir -p "$OUTDIR"

if [ ! -f "$CURL_SH" ]; then
  echo "❌ $CURL_SH not found"
  exit 1
fi
if [ ! -f /tmp/lessons.json ]; then
  echo "❌ /tmp/lessons.json not found"
  exit 1
fi

# Step 1: categories.json (取得済を流用)
echo "[Step 1/3] categories.json 流用"
cp /tmp/lessons.json "$OUTDIR/categories.json"

# Step 2: course_no 別 レッスン一覧 (23 章)
echo "[Step 2/3] course_no 別レッスン一覧 (23 章)"
COURSE_NOS=$(jq -r '.categories[].courses[].course_no' "$OUTDIR/categories.json")
CCOUNT=0
for cno in $COURSE_NOS; do
  CCOUNT=$((CCOUNT+1))
  OUT="$OUTDIR/course_${cno}.json"
  if [ -f "$OUT" ]; then
    echo "  [$CCOUNT] course_no=$cno (既存スキップ)"
    continue
  fi
  sed "s|/site_api/lessons?site_code=|/site_api/lessons?course_no=${cno}\&site_code=|" "$CURL_SH" | bash > "$OUT" 2>/dev/null
  SIZE=$(wc -c < "$OUT")
  echo "  [$CCOUNT] course_no=$cno → $SIZE bytes"
  sleep $SLEEP_SEC
done

# Step 3: lesson_no 別 動画 URL 含むレッスン詳細 (~224 件)
echo "[Step 3/3] lesson_no 別レッスン詳細 (動画URL取得)"
LESSON_NOS=$(cat $OUTDIR/course_*.json | jq -r '.lessons[].lesson_no' | sort -un)
TOTAL=$(echo "$LESSON_NOS" | wc -w | tr -d ' ')
COUNT=0
for lno in $LESSON_NOS; do
  COUNT=$((COUNT+1))
  OUT="$OUTDIR/lesson_${lno}.json"
  if [ -f "$OUT" ]; then
    continue
  fi
  sed "s|/site_api/lessons?site_code=|/site_api/lessons?lesson_no=${lno}\&site_code=|" "$CURL_SH" | bash > "$OUT" 2>/dev/null
  if [ $((COUNT % 20)) -eq 0 ]; then
    echo "  [$COUNT/$TOTAL] lesson_no=$lno..."
  fi
  sleep $SLEEP_SEC
done

echo ""
echo "✅ 全データ取得完了"
echo "  categories: 1 file"
echo "  courses: $(ls $OUTDIR/course_*.json 2>/dev/null | wc -l | tr -d ' ') files"
echo "  lessons: $(ls $OUTDIR/lesson_*.json 2>/dev/null | wc -l | tr -d ' ') files"
echo "  合計: $(du -sh $OUTDIR | cut -f1)"
