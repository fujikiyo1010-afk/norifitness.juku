import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 設定 (筋肉塾 E2E)
 *
 * 設計:
 *   - 単一 baseURL = ローカル dev サーバー (localhost:3000)
 *   - 受講生 / 管理者の 2 プロジェクトで storageState を切り替え
 *   - auth.setup プロジェクト (依存元) でログイン → .auth/*.json 保存
 *   - core-flow プロジェクトでテスト本体 (storageState を切替えながら使用)
 *
 * 関連:
 *   - e2e/auth.setup.ts (storage state 生成)
 *   - e2e/setup/seed_e2e_student.js (E2E 受講生作成)
 *   - e2e/setup/reset_e2e_student.js (各テスト前リセット、 ハードガード付き)
 *   - feedback-delegation-rules-2026-06-14 (Supabase 操作許可・破壊スクリプト承認時ゲート)
 *
 * 並列実行は将来課題 (まずは serial で 1 本通す)。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // セットアップ: ログイン → storageState 生成
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // テスト本体: 受講生 / 管理者の context を必要に応じて切替
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  // dev サーバーは事前起動済と仮定 (既存 PID 25461 等)
  // 起動してない場合は明示的に npm run dev を別タブで実行
  // webServer 設定は将来 (CI 等で必要になったら追加)
});
