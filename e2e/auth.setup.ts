import { test as setup, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * 受講生 / 管理者の認証状態を生成し、 storageState ファイルに保存。
 *
 * 流れ:
 *   0. seed_admin.js と seed_e2e_student.js を流し、 アカウント存在を保証
 *      (= ハーネスの一部として自動実行、 feedback-delegation-rules-2026-06-14 準拠)
 *   1. /login で 受講生としてログイン → student.json
 *   2. /login で 管理者としてログイン → admin.json
 *
 * 関連:
 *   - playwright.config.ts (= projects.setup から呼ばれる)
 *   - e2e/setup/seed_*.js
 *   - feedback-delegation-rules-2026-06-14
 */

// .env.local 読み込み (Playwright 経由実行時は process.env 経由で渡らない場合がある)
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
const E2E_STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "fujikiyo1010@gmail.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const AUTH_DIR = path.resolve(__dirname, ".auth");
const STUDENT_STATE = path.join(AUTH_DIR, "student.json");
const ADMIN_STATE = path.join(AUTH_DIR, "admin.json");

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

if (!E2E_STUDENT_PASSWORD) {
  throw new Error(
    "E2E_STUDENT_PASSWORD missing in .env.local — add it before running E2E"
  );
}
if (!ADMIN_PASSWORD) {
  throw new Error(
    "E2E_ADMIN_PASSWORD missing in .env.local — add it before running E2E"
  );
}

setup("seed admin + e2e student", async () => {
  // 管理者復活 (= R-1 違反による admin_users 行欠落に備えた保険)
  console.log("[setup] seed_admin.js を実行 (管理者ロール保証)");
  execSync(
    `node scripts/seed_admin.js ${ADMIN_EMAIL} きよむ superadmin`,
    { stdio: "inherit", cwd: path.resolve(__dirname, "..") }
  );

  // E2E 受講生作成 (冪等)
  console.log("[setup] seed_e2e_student.js を実行 (E2E 受講生作成)");
  execSync("node e2e/setup/seed_e2e_student.js", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
});

setup("authenticate as student", async ({ page }) => {
  await page.goto("/login");
  // id ベースで指定 (= 「パスワードを表示する」 checkbox との strict mode 衝突回避)
  await page.locator("#email").fill(E2E_STUDENT_EMAIL);
  await page.locator("#password").fill(E2E_STUDENT_PASSWORD!);
  await page.getByRole("button", { name: /ログイン/i }).click();

  // ログイン成功 = / にリダイレクト + 受講生ホームの何かが見える
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.locator("body")).toContainText(/こんにちは|筋肉塾/);

  // PWA インストールバナーを永続的に dismiss (= ボタンクリック妨害を防止)
  // 実装: src/components/PWAInstallBanner.tsx の LS_KEY = "pwa_banner_dismissed"
  await page.evaluate(() => {
    localStorage.setItem("pwa_banner_dismissed", new Date().toISOString());
  });

  await page.context().storageState({ path: STUDENT_STATE });
  console.log(`[setup] student storageState saved -> ${STUDENT_STATE}`);
});

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /ログイン/i }).click();

  // 管理者は / にリダイレクトされた後 /admin に手動アクセス可能
  await page.waitForURL("/", { timeout: 15_000 });
  // /admin/users にアクセスして 403 にならないことを確認
  await page.goto("/admin/users");
  await expect(page.locator("h1")).toContainText("受講生一覧");

  await page.context().storageState({ path: ADMIN_STATE });
  console.log(`[setup] admin storageState saved -> ${ADMIN_STATE}`);
});
