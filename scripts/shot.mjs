/**
 * ログイン不要プレビュー用スクリーンショット (2026-07-07)
 *
 * 認証が要る画面(/admin/* や受講生ページ)を、きよむさんにログインさせずに
 * 実物のまま画像で見せるためのツール。
 *
 * 使い方:
 *   node scripts/shot.mjs <path> [outPng] [role]
 *   例) node scripts/shot.mjs /admin/learning shot.png admin
 *       node scripts/shot.mjs /record shot.png student
 *
 * 前提: dev サーバー(localhost:3000)稼働 + e2e/.auth/<role>.json が有効。
 *       認証が切れていたら: npx playwright test --project=setup で再生成。
 */
import { chromium } from "@playwright/test";
import path from "path";

const url = process.argv[2] || "/";
const out = process.argv[3] || path.resolve("shot.png");
const role = process.argv[4] || "admin";
const base = process.env.SHOT_BASE || "http://localhost:3000";
const state = path.resolve(`e2e/.auth/${role}.json`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: state,
  viewport: { width: 1440, height: 1400 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(base + url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);
const finalUrl = page.url();
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log("FINAL_URL:", finalUrl);
console.log("SAVED:", out);
// リダイレクトされていたら認証切れの可能性
if (/\/login|\/onboarding/.test(finalUrl)) {
  console.log("⚠ 認証切れの可能性 → npx playwright test --project=setup で再生成してください");
}
