---
name: deploy-isolated
description: feat/body-metrics-section に未コミット作業が大量にある状態で、1つの機能・修正だけを巻き込まず main へ切り出して本番反映(Vercel自動デプロイ)する手順。コース画像などで繰り返した「commit対象だけ→stash→main→cherry-pick→push→戻す」フロー。本番反映の指示が出た時に使う。
---

# 切り出しデプロイ（isolated hotfix）

作業ブランチ `feat/body-metrics-section` には受講生向け未公開作業（体組成セクション等）や admin 作りかけが**未コミットで大量に混在**している。
`06_kinniku_juku_app` は **main を push すると Vercel が juku.norifitness.com へ自動デプロイ**する。
そのため「今直した1機能だけ」を、他の未コミット作業を巻き込まず main に載せる。

## 前提・鉄則
- **本番反映はユーザーの明示GOが必須**（お金/UX/本番運用に関わる）。勝手にpushしない。
- **feat を丸ごと main にマージしない**。体組成セクション等が意図せず本番公開されるため。必ず"切り出し"。
- push 前に型チェックが通ること：`npx tsc --noEmit -p tsconfig.json`（EXIT 0）。
- main が origin/main と同期しているか先に確認（ズレていたら止めて相談）。

## 手順（対象ファイルを `TARGETS` に列挙して実行）
```bash
cd ~/Desktop/norifitness/06_kinniku_juku_app
rm -f .git/index.lock 2>/dev/null

# 0) 事前確認
npx tsc --noEmit -p tsconfig.json          # EXIT 0 を確認
git rev-parse --short main origin/main       # 同期確認(一致していること)
git status --short                            # 巻き込み対象を目視

# 1) 対象ファイルだけを commit（TARGETS=今回反映する範囲のみ）
git add "path/to/changed-file.tsx" other/asset/dir/
git commit -q -m "<日本語の要約メッセージ>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
FEAT_COMMIT=$(git rev-parse HEAD)

# 2) 残りの未コミット作業を退避（-u で未追跡も含む）
git stash push -u -m "wip退避(切り出しデプロイ)"

# 3) main へ移り cherry-pick → push（=Vercel 本番デプロイ）
git checkout main
git cherry-pick "$FEAT_COMMIT"
git push origin main

# 4) feat へ戻して退避作業を復元
git checkout feat/body-metrics-section
git stash pop

# 5) 復元確認
git status --short
```

## チェックポイント
- **cherry-pick する commit は"本当に独立した変更"だけ**にする。他の未コミット作業に依存していないか確認（依存していたら切り出せない＝相談）。
- `git stash pop` 後、退避していた作業（admin/learning、home-design.html、UserHubTabs 等）が**元どおり全部戻っている**ことを `git status --short` で確認。
- `.git/index.lock` エラーが出たら `rm -f .git/index.lock` してリトライ。
- cherry-pick は main 上で新しいcommit hashになる（feat側の元commitと別hash）。正常。後で feat をmainに載せる時は重複解決される。
- 完了報告に「`旧hash → 新hash` push済み → Vercelデプロイ中（1〜2分）」「feat の未コミット作業は温存」を必ず添える。
- デプロイ後の本番URL（例: https://juku.norifitness.com/... ）を確認導線として提示する。

## 使わない場面
- feat 全体を正式に main へ統合する時（＝体組成公開の判断が済んでから、別途 merge を検討）。この場合はこのスキルではなく、公開可否をユーザーに確認してから通常マージ。
