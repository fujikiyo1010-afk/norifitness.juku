import { test, expect, type BrowserContext } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

/**
 * 20. 受講生メニュー表示 W4 自動 E2E (2026-06-26)
 *
 * 検証対象:
 *   1. スーパーセットのペア表示 (「スーパーセット」ラベル)
 *   2. 動画あり種目の ▶ + タップで動画ライトボックス (Vimeo iframe)
 *   3. 休息日タブ → 休息日カード
 *   4. パーソナル日タブ → パーソナル日カード
 *
 * Fixture: reset_e2e_student → カルテ + 現役メニュー(種別/superset/video含む) を seed
 */
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^=]+?)=(.+)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}
const E2E_STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL || "e2e-student@test.local";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STUDENT_STATE = path.resolve(__dirname, ".auth/student.json");

function svc() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
async function getE2EUserId(): Promise<string> {
  const { data: { users } } = await svc().auth.admin.listUsers({ perPage: 200 });
  const u = users.find((x) => x.email === E2E_STUDENT_EMAIL);
  if (!u) throw new Error(`E2E user ${E2E_STUDENT_EMAIL} not found`);
  return u.id;
}

async function seedCarteAndMenu(userId: string) {
  const s = svc();
  const { error: cErr } = await s.from("user_workout_carte").upsert(
    {
      user_id: userId,
      gender: "男",
      environments: ["ダンベル", "家トレ"],
      frequency_wish: "週3",
      focus_body_parts: ["胸", "背中"],
      purposes: ["筋肉増"],
      experience: "たまに",
      medical_limits: [],
      ideal_body: "細マッチョ",
    },
    { onConflict: "user_id" }
  );
  if (cErr) throw new Error(`carte seed failed: ${cErr.message}`);

  const cycles = [
    {
      段階: "小",
      シート名: "",
      週: [
        {
          日: "1日目",
          種目: [
            { 順番: "1", 種目名: "膝つき腕立て伏せ", 回数: "10回 2セット", インターバル: "2分", 主部位: ["胸"], 補部位: [], superset: true },
            { 順番: "2", 種目名: "ペットボトルでローイング", 回数: "10回 2セット", インターバル: "2分", 主部位: ["背中"], 補部位: [] },
            { 順番: "3", 種目名: "スクワット", 回数: "15回 3セット", インターバル: "2分", 主部位: ["脚"], 補部位: [] },
          ],
        },
        { 日: "2日目", 種別: "休息", 種目: [] },
        { 日: "3日目", 種別: "パーソナル", 種目: [] },
      ],
    },
  ];
  const { error: mErr } = await s.from("user_workout_menu").insert({
    user_id: userId,
    cycles,
    notes: "テストメモ",
    is_current: true,
  });
  if (mErr) throw new Error(`menu seed failed: ${mErr.message}`);
}

test.beforeEach(async () => {
  execSync("node e2e/setup/reset_e2e_student.js", { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
});

test("20. 受講生メニュー: スーパーセット/動画ライトボックス/休息・パーソナル", async ({ browser }) => {
  const userId = await getE2EUserId();
  await seedCarteAndMenu(userId);

  const ctx: BrowserContext = await browser.newContext({ storageState: STUDENT_STATE });
  try {
    const page = await ctx.newPage();
    await page.goto("/workout");

    // 1. スーパーセット ペア表示
    await expect(page.getByText("スーパーセット")).toBeVisible();

    // 2. 動画あり種目の ▶
    await expect(page.locator('[aria-label="動画あり"]').first()).toBeVisible();

    // 2b. 種目タップ → 動画ライトボックス (Vimeo iframe)
    await page.getByText("膝つき腕立て伏せ").click();
    await expect(page.locator('iframe[src*="vimeo"]')).toBeVisible();
    // 閉じる
    await page.getByRole("button", { name: "閉じる" }).click();
    await expect(page.locator('iframe[src*="vimeo"]')).toHaveCount(0);

    // 3. 休息日タブ → 休息日カード
    await page.locator('button:has-text("2日目")').click();
    await expect(page.getByText("休息日")).toBeVisible();

    // 4. パーソナル日タブ → パーソナル日カード
    await page.locator('button:has-text("3日目")').click();
    await expect(page.getByText("パーソナル日")).toBeVisible();
    await expect(page.getByText("外部のパーソナル指導")).toBeVisible();
  } finally {
    await ctx.close();
  }
});
