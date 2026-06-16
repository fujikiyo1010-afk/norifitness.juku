import { test, expect, type BrowserContext } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

/**
 * 17. 体組成 7 日途絶アラート 自動 E2E テスト (2026-06-15 線① 前倒し)
 *
 * 検証対象 (4 件):
 *   1. 受講生ホーム黄バナー「体組成の記録が止まっています (最後 N 日前) 。記録しましょう」
 *   2. /body-metrics サブタイトル「リアルタイムで共有されます」 並列表示
 *   3. /body-metrics 「変化を見る (推移グラフ)」 ボタン SVG (絵文字 📈 なし)
 *   4. 管理者 /admin で「アラート対象の受講生はいません」 (= 案 β topSeverity 計算除外)
 *
 * 検証範囲外 (= 元から表示する場所がない、 Phase 4 #20 #21 で線② 実装後に spec 拡張):
 *   - 受講生一覧 (/admin/users) のバッジ表示
 *   - 受講生ハブ概要タブのアラートタグ列挙
 *
 * Fixture:
 *   - beforeEach で reset_e2e_student.js (体組成全 delete 含む)
 *   - test 内で Service Role で 8 日前の body_metrics 1 件 INSERT
 *
 * 関連:
 *   - src/lib/member/alerts.ts
 *   - src/app/page.tsx ALERT_CONFIG.body_metrics_stalled
 *   - src/app/body-metrics/page.tsx (サブタイトル + TrendingUpIcon)
 *   - src/lib/admin/alerts.ts (actionableTags フィルタ)
 *   - docs/00_premises/admin_alert_tags_spec_2026-06-11.md (情報表示のみ化セクション)
 *   - memory: project_kinniku_juku_phase4_todo #19 (本テスト起票元)
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

const E2E_STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL || "e2e-student@test.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STUDENT_STATE = path.resolve(__dirname, ".auth/student.json");
const ADMIN_STATE = path.resolve(__dirname, ".auth/admin.json");

async function getE2EUserId(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const user = users.find((u) => u.email === E2E_STUDENT_EMAIL);
  if (!user) {
    throw new Error(`E2E user ${E2E_STUDENT_EMAIL} not found`);
  }
  return user.id;
}

async function insertStalledBodyMetric(userId: string, daysAgo: number) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const recordedAt = new Date();
  recordedAt.setDate(recordedAt.getDate() - daysAgo);
  const { error } = await supabase.from("body_metrics").insert({
    user_id: userId,
    recorded_at: recordedAt.toISOString(),
    weight_kg: 70.5,
    body_fat_percent: 18.0,
    waist_cm: 75.0,
    note: `E2E stalled fixture (${daysAgo} days ago)`,
  });
  if (error) throw new Error(`body_metrics INSERT failed: ${error.message}`);
}

test.beforeEach(async () => {
  execSync("node e2e/setup/reset_e2e_student.js", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
});

test("17. 体組成 7 日途絶アラート: 受講生バナー + サブタイトル + SVG + 管理者除外", async ({
  browser,
}) => {
  const e2eUserId = await getE2EUserId();
  await insertStalledBodyMetric(e2eUserId, 8);

  const studentContext: BrowserContext = await browser.newContext({
    storageState: STUDENT_STATE,
  });
  const adminContext: BrowserContext = await browser.newContext({
    storageState: ADMIN_STATE,
  });

  try {
    const studentPage = await studentContext.newPage();
    const adminPage = await adminContext.newPage();

    // =====================================================================
    // 1. 受講生ホーム: 黄バナー文言 + リンク先
    // =====================================================================
    await studentPage.goto("/");
    const banner = studentPage
      .locator('a[href="/body-metrics"]')
      .filter({ hasText: "体組成の記録が止まっています" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("最後 8 日前");
    await expect(banner).toContainText("記録しましょう");

    // =====================================================================
    // 2. /body-metrics サブタイトル (並列表示)
    // =====================================================================
    await studentPage.goto("/body-metrics");
    await expect(studentPage.locator("h1")).toContainText("体組成 記録");
    await expect(studentPage.locator("body")).toContainText(
      "毎日 or 週 1 で記録"
    );
    await expect(studentPage.locator("body")).toContainText(
      "リアルタイムで共有されます"
    );

    // =====================================================================
    // 3. 「変化を見る」 ボタン: SVG (絵文字 📈 なし)
    // =====================================================================
    const changeButton = studentPage.locator(
      'a[href="/body-metrics/chart"]'
    );
    await expect(changeButton).toBeVisible();
    await expect(changeButton).toContainText("変化を見る");
    await expect(changeButton).not.toContainText("📈");
    await expect(changeButton.locator("svg")).toBeVisible();

    // =====================================================================
    // 4. 管理者ホームダッシュ: 「アラート対象の受講生はいません」
    //    = body_metrics_stalled を topSeverity 計算から除外している証拠
    // =====================================================================
    await adminPage.goto("/admin");
    await expect(adminPage.locator("body")).toContainText(
      "アラート対象の受講生はいません"
    );
  } finally {
    await studentContext.close();
    await adminContext.close();
  }
});
