#!/bin/bash
# 全試験 (question_box_id) を fetch して /tmp/saipon_exam_dump/exam_XX.json に保存
#
# 前提:
#   - /tmp/saipon_exam_curl_2.sh   (= exam/list endpoint ・ cookie 含む)
#   - /tmp/saipon_exam_curl_3.sh   (= exam?questionbox=72 endpoint ・ 雛形)
#
# 出力:
#   - /tmp/saipon_exam_dump/list.json
#   - /tmp/saipon_exam_dump/exam_<id>.json (各 question_box_id ぶん)

set -e

LIST_CURL="/tmp/saipon_exam_curl_2.sh"
DETAIL_CURL="/tmp/saipon_exam_curl_3.sh"
OUTDIR="/tmp/saipon_exam_dump"
SLEEP_SEC=1

mkdir -p "$OUTDIR"

if [ ! -f "$LIST_CURL" ] || [ ! -f "$DETAIL_CURL" ]; then
  echo "❌ curl template not found ($LIST_CURL or $DETAIL_CURL)"
  exit 1
fi

echo "[Step 1/2] 試験一覧 取得"
bash "$LIST_CURL" 2>/dev/null > "$OUTDIR/list.json"
COUNT=$(jq 'length' "$OUTDIR/list.json")
echo "  → $COUNT 件"

echo ""
echo "[Step 2/2] 各試験の詳細を取得"
IDS=$(jq -r '.[].question_box_id' "$OUTDIR/list.json")
i=0
for id in $IDS; do
  i=$((i+1))
  OUT="$OUTDIR/exam_${id}.json"
  if [ -f "$OUT" ] && [ "$(jq -r '.question_box_id // empty' "$OUT" 2>/dev/null)" = "$id" ]; then
    echo "  [$i/$COUNT] question_box_id=$id (既存スキップ)"
    continue
  fi
  # 雛形 URL の questionbox=72 を $id に置換して実行
  sed "s|questionbox=72|questionbox=${id}|" "$DETAIL_CURL" | bash > "$OUT" 2>/dev/null
  SIZE=$(wc -c < "$OUT")
  NAME=$(jq -r '.name // "(no name)"' "$OUT")
  Q_COUNT=$(jq -r '.list | length' "$OUT" 2>/dev/null || echo "?")
  echo "  [$i/$COUNT] qid=$id  ${SIZE}B  q=$Q_COUNT  name=$NAME"
  sleep "$SLEEP_SEC"
done

echo ""
echo "[完了] $OUTDIR に $COUNT 件保存"
