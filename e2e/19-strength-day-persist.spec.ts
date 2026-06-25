import { test, expect } from "@playwright/test";
import path from "path";

/**
 * タスク3 回帰テスト: 強度(小/中/大)を切り替えても「今見ている日」が維持される。
 *
 * 背景: handleCycleChange が activeDayIdx を 0 にリセットしていたため、
 *       Cメニューを見ていて強度を切り替えると Bメニュー(先頭)に飛んでいた。
 *       修正後は日を維持する。
 *
 * 対象: /admin/users/[id]/menu/new?template=...
 *   - 管理者 storageState を使用
 *   - HIRO テンプレ (3強度 小/中/大 × 2日 Bメニュー/Cメニュー)
 */
test.use({
  storageState: path.resolve(__dirname, ".auth/admin.json"),
});

const USER_ID = "f0c48fd1-bc43-4b64-8e01-b9d32b2aa172"; // きよむ(テスト招待)
const TEMPLATE_ID = "15edb41c-c70a-43d1-afdc-56078c17a52c"; // HIRO (3強度×2日)

test("強度を切り替えても選択中の日(Cメニュー)が維持される", async ({ page }) => {
  await page.goto(
    `/admin/users/${USER_ID}/menu/new?template=${TEMPLATE_ID}`
  );

  // 編集画面が表示される
  await expect(
    page.getByRole("heading", { name: "メニュー配布" })
  ).toBeVisible();

  const dayB = page.getByRole("button", { name: /Bメニュー/ });
  const dayC = page.getByRole("button", { name: /Cメニュー/ });
  const strengthMid = page.getByRole("button", { name: /中/ }).first();

  // 初期は Bメニュー(先頭)が選択されている
  await expect(dayB).toHaveClass(/border-\[#00897b\]/);

  // Cメニュー(2日目)を選択 → アクティブになる
  await dayC.click();
  await expect(dayC).toHaveClass(/border-\[#00897b\]/);

  // 強度「中」に切替
  await strengthMid.click();

  // ★修正の核: 日は Cメニュー のまま維持される(Bに戻らない)
  await expect(dayC).toHaveClass(/border-\[#00897b\]/);
  await expect(dayB).not.toHaveClass(/border-\[#00897b\]/);
});
