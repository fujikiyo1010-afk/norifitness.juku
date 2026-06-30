# 作業再開メモ（Claude Code 用）

まず `06_kinniku_juku_app/CLAUDE.md` と `.cursor/rules/` の正典ルールを読んでから着手すること。

## 状況
直前まで、コース一覧の「導入チャプター（動画）」の削除と、テキストレッスン（モンクモード）対応を進めていた。未コミットで以下が残っているはず：
- `scripts/delete_intro_chapter_READY.sql`（章削除）
- `scripts/inspect_chapter_to_delete.sql`（削除対象の確認）
- `scripts/seed_monk_mode_READY.sql`

## お願い（この順で）
1. `git status` と `git log --oneline -5` で現状を確認し、どこまで進んでいたか整理して報告する。
2. 削除系（`delete_intro_chapter`）は本番DBに関わるので、**いきなり実行しない**。対象を SELECT で見せ、承認を得てから実行する。
3. 残りのUI変更があれば、何が残っているか先に提示する。

**まず現状整理だけして、一旦止まること。**
