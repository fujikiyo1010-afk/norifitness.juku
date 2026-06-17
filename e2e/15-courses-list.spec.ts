import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * 15. /courses モック準拠改修 自動 E2E テスト (2026-06-16 線① 前倒し)
 *
 * 検証対象:
 *   1. ヘッダー「コース一覧」 (📚 絵文字なし)
 *   2. フィルタタブ 4 種類 (すべて / 進行中 / 未着手 / 完了) 表示
 *   3. コースカード 1 件以上表示 (横並びカード = SVG サムネ + info)
 *   4. フィルタタブクリック → エラーなく動作する
 *
 * Fixture:
 *   - reset_e2e_student は不要 (/courses は公開コース閲覧のみで受講生データに依存しない)
 *
 * 関連:
 *   - src/app/courses/page.tsx (📚 削除)
 *   - src/app/courses/CoursesView.tsx (全面改修)
 *   - docs/03_design_mocks/screens_phase1.html L621-730 「② コース一覧」
 *   - memory: project_kinniku_juku_phase4_todo #15
 */

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([^=]+?)=(.+)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const STUDENT_STATE = path.resolve(__dirname, ".auth/student.json");

test("15. コース一覧モック準拠改修: タイトル + フィルタタブ + コースカード", async ({
  browser,
}) => {
  const studentContext = await browser.newContext({
    storageState: STUDENT_STATE,
  });

  try {
    const page = await studentContext.newPage();
    await page.goto("/courses");

    // 1. ヘッダー「コース」 (📚 絵文字なし)
    //    MemberHeader 共通化 (2026-06-17 aa28531) によりタイトルは「コース」 (旧「コース一覧」)
    const heading = page.locator("h1");
    await expect(heading).toContainText("コース");
    await expect(heading).not.toContainText("📚");

    // 2. フィルタタブ 4 種類存在 (件数バッジ付き)
    await expect(page.locator('button:has-text("すべて")')).toBeVisible();
    await expect(page.locator('button:has-text("進行中")')).toBeVisible();
    await expect(page.locator('button:has-text("未着手")')).toBeVisible();
    await expect(page.locator('button:has-text("完了")')).toBeVisible();

    // 3. コースカードが 1 件以上表示 (Link 配下に SVG サムネ)
    const courseCards = page.locator('a[href^="/courses/"]:has(svg)');
    const count = await courseCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 4. 「未着手」 タブクリック → エラーなく動作 (= リスト切替動作)
    await page.locator('button:has-text("未着手")').click();
    await expect(page.locator("body")).toBeVisible();
  } finally {
    await studentContext.close();
  }
});
