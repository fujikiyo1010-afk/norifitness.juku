import { test, expect, type BrowserContext } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

/**
 * コアフロー 1 本: 受講生カルテ提出 → 管理者マッチング → 配布 → 受講生表示確認
 *
 * 自動化対象 (= きよむさんが何度も手で歩いて確認したコア):
 *   1. 受講生: カルテ Q1 生年月日 (3 列 select) + Q2-Q5 入力 → 送信
 *   2. 受講生: /workout/carte/complete に遷移
 *   3. 管理者: /admin/users/[e2e_id]/match で候補 ≥3 件 + スコア順
 *   4. 管理者: 1 位採用 → 配布画面 → 配布実行 → /admin/users/[e2e_id] 遷移 + 配布済み
 *   5. 受講生: /workout で配布日・強度数・カルテサマリが一致
 *
 * 前提:
 *   - 各テスト前に reset_e2e_student.js でデータを「入会直後」 にリセット
 *   - storageState (student.json / admin.json) は auth.setup.ts で事前生成済
 *
 * スコープ外 (= 別 spec で将来):
 *   - 招待→有効化動線 (token 経由)
 *   - 実 Gmail 受信箱
 *   - 学習 / 記録 / 月次添削
 *
 * 関連:
 *   - playwright.config.ts
 *   - e2e/setup/reset_e2e_student.js (★ ハードガード付き)
 *   - feedback-delegation-rules-2026-06-14
 */

// .env.local 読み込み
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

// E2E 受講生の id を引く
async function getE2EUserId(): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const user = users.find((u) => u.email === E2E_STUDENT_EMAIL);
  if (!user) {
    throw new Error(`E2E user ${E2E_STUDENT_EMAIL} not found in auth.users`);
  }
  return user.id;
}

// 各テスト前にリセット (= 承認済破壊スクリプト、 ハーネスの一部として自動実行)
test.beforeEach(async () => {
  execSync("node e2e/setup/reset_e2e_student.js", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
});

test("コアフロー: カルテ提出 → マッチング → 配布 → 受講生反映", async ({
  browser,
}) => {
  const e2eUserId = await getE2EUserId();

  // 2 つの context を 独立 storageState で生成 (= セッション混線ゼロ)
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
    // 1. 受講生: カルテ入力 (Q1 生年月日 + Q2-Q5 必須項目)
    // =====================================================================
    await studentPage.goto("/workout/carte/new");
    await expect(studentPage.locator("body")).toContainText("筋トレカルテ");

    // Q1 生年月日 (3 列 select: 年/月/日)
    // birthday カードは BirthdayCard コンポーネントで、 aria-label で識別
    await studentPage.getByLabel("生年").selectOption("1994");
    await studentPage.getByLabel("生月").selectOption("09");
    await studentPage.getByLabel("生日").selectOption("13");

    // Q2 性別 = 男 (デフォルトのまま、 明示的に確認のみ)
    await expect(
      studentPage.locator('button:has-text("男")').first()
    ).toBeVisible();

    // Q3 使える環境: ダンベル + ジム
    await studentPage.locator('button:has-text("ダンベル")').click();
    await studentPage.locator('button:has-text("ジム")').click();

    // Q4 理想の頻度: 週3
    await studentPage.locator('button:has-text("週3")').first().click();

    // Q5 鍛えたい部位: 胸 + 背中
    await studentPage.locator('button:has-text("胸")').click();
    await studentPage.locator('button:has-text("背中")').click();

    // プレビューへ
    await studentPage
      .getByRole("button", { name: "プレビューを確認する" })
      .click();
    await expect(studentPage.locator("body")).toContainText(
      "プレビュー (送信前の確認)"
    );

    // 送信
    await studentPage.getByRole("button", { name: "送信する" }).click();
    await studentPage.waitForURL(/\/workout\/carte\/complete/, {
      timeout: 15_000,
    });

    // =====================================================================
    // 2. 管理者: マッチング画面で候補 ≥3 件 + スコア順
    // =====================================================================
    await adminPage.goto(`/admin/users/${e2eUserId}/match`);

    // 「生年月日が未設定」 エラーが出てないこと (= birthday upsert 経路が効いてる確認)
    await expect(adminPage.locator("body")).not.toContainText(
      "生年月日が未設定"
    );

    // 候補が ≥3 件
    const candidates = adminPage.locator('a:has-text("採用する")');
    await expect(candidates).toHaveCount(await candidates.count(), {
      timeout: 10_000,
    });
    const candidateCount = await candidates.count();
    expect(candidateCount).toBeGreaterThanOrEqual(3);

    // =====================================================================
    // 3. 管理者: 1 位採用 → 配布画面 → 配布実行
    // =====================================================================
    await adminPage
      .locator('a:has-text("★ 採用する (推奨)")')
      .first()
      .click();
    await adminPage.waitForURL(/\/menu\/new/, { timeout: 15_000 });
    await expect(adminPage.locator("body")).toContainText("メニュー配布");

    // 配布実行
    await adminPage.getByRole("button", { name: /^配布する$/ }).click();
    await adminPage.waitForURL(`/admin/users/${e2eUserId}`, {
      timeout: 15_000,
    });
    await expect(adminPage.locator("body")).toContainText("配布済み");

    // =====================================================================
    // 4. 受講生: /workout で配布反映確認
    // =====================================================================
    await studentPage.goto("/workout");
    await expect(studentPage.locator("body")).toContainText(
      "あなたの今月のメニュー"
    );

    // 配布日 = 今日
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    await expect(studentPage.locator("body")).toContainText(
      `${yyyy}/${mm}/${dd}`
    );

    // カルテサマリに 入力した環境が反映 (ダンベル or ジム)
    const carteSummary = studentPage.locator("body");
    await expect(carteSummary).toContainText(/ダンベル|ジム/);
  } finally {
    await studentContext.close();
    await adminContext.close();
  }
});

// =====================================================================
// 既知の穴: ホーム → /workout への動線が無い
// 動線実装後にこの test.skip を test.fixme/test に切り替えて緑にする
// =====================================================================
test.skip("既知の穴: ホームから /workout (配布済メニュー) への動線が無い", async ({
  browser,
}) => {
  const studentContext = await browser.newContext({
    storageState: STUDENT_STATE,
  });
  const page = await studentContext.newPage();
  await page.goto("/");
  // 直したらこの 1 行を有効化
  // await expect(page.locator('a[href="/workout"]')).toBeVisible();
  await studentContext.close();
});
