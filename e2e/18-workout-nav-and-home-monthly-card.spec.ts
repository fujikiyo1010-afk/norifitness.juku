import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * 18. 下部ナビ 「筋トレ」 + ホーム 月次添削カード 動線テスト (2026-06-18 当日追加)
 *
 * 検証対象:
 *   1. ホーム /  に 「目標管理シート」 + 「月次添削」 の 2 枚の横長カードが並ぶ
 *   2. 月次添削カード タップで /monthly-review に遷移する
 *   3. 下部ナビに 「筋トレ」 タブが存在する (4 番目、 旧 「月次添削」 を置換)
 *   4. 「筋トレ」 タブ タップで /workout (= カルテ未提出なら /workout/carte/new) に到達する
 *   5. /workout 画面で カルテ表示 or 配布済メニュー or 「メニュー作成中」 のいずれかが表示される
 *
 * 関連:
 *   - src/components/MemberBottomNav.tsx (4 番目: 月次添削 → 筋トレ + DumbbellIcon)
 *   - src/app/page.tsx (目標管理シート直下に月次添削カード追加)
 *   - src/lib/member/monthly-audit-status.ts (新規)
 *   - src/app/workout/page.tsx + MenuView.tsx (色 F 統一)
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

test("18. ホーム 月次添削カード + 下部ナビ 筋トレタブ + /workout 到達", async ({
  browser,
}) => {
  const studentContext = await browser.newContext({
    storageState: STUDENT_STATE,
  });

  try {
    const page = await studentContext.newPage();

    // ─── ① ホーム到達 ───
    await page.goto("/");
    await expect(page).toHaveURL("/");

    // ─── ② 目標管理シート + 月次添削 の 2 カードが並ぶ ───
    //     アラートバナー (上部) も同じ href を持つので .last() で「下段の横長カード」 を狙う。
    const goalSheetCard = page.locator('a[href="/goal-sheet"]').last();
    await expect(goalSheetCard).toBeVisible();
    await expect(goalSheetCard).toContainText("目標管理シート");

    const monthlyCard = page.locator('a[href="/monthly-review"]').last();
    await expect(monthlyCard).toBeVisible();
    await expect(monthlyCard).toContainText("月次添削");

    // ─── ③ 月次添削カード タップで /monthly-review に遷移 ───
    await monthlyCard.click();
    await expect(page).toHaveURL("/monthly-review");
    await expect(page.locator("body")).toContainText("月次添削");

    // ─── ④ 戻ってナビ確認 ───
    await page.goto("/");

    // 下部ナビ 「筋トレ」 タブが存在 (4 番目、 旧月次添削を置換)
    const workoutTab = page.locator('nav a[href="/workout"]', {
      hasText: "筋トレ",
    });
    await expect(workoutTab).toBeVisible();

    // 旧 「月次添削」 タブが下部ナビにないこと
    const oldMonthlyTab = page.locator('nav a[href="/monthly-review"]');
    await expect(oldMonthlyTab).toHaveCount(0);

    // ─── ⑤ 筋トレ タブ タップ → /workout 系に到達 ───
    await workoutTab.click();
    // カルテ未提出なら /workout/carte/new、 提出済なら /workout
    await expect(page).toHaveURL(/\/workout(\/carte\/new)?$/);

    // ─── ⑥ 到達ページが何かしらの workout 系コンテンツを含む ───
    const body = page.locator("body");
    const text = await body.innerText();
    const hasWorkoutContent =
      text.includes("カルテ") ||
      text.includes("メニュー") ||
      text.includes("筋トレ");
    expect(hasWorkoutContent).toBe(true);
  } finally {
    await studentContext.close();
  }
});
