import { test, expect, type BrowserContext } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

/**
 * 16. 目標管理シート 再添削依頼 機能 自動 E2E テスト (2026-06-16 線① 前倒し)
 *
 * 検証対象:
 *   1. 初回 (audits なし) = 「送信して添削を依頼」 ボタン文言
 *   2. 2 回目以降 (audits あり) = 「送信して再添削を依頼」 ボタン文言
 *   3. 旧「のりに再添削を依頼する」 alert ボタンが削除済
 *   4. ボタン押下 → /goal-sheet (閲覧モード) に遷移
 *   5. 管理者ホームダッシュで「目標シート 再添削依頼」 タグ + 受講生名表示 (urgent)
 *
 * Fixture:
 *   - beforeEach で reset_e2e_student.js (goal_sheets 全 delete 含む)
 *   - test 内で Service Role で goal_sheets を seed (audits あり/なし切替)
 *
 * 関連:
 *   - src/lib/goal-sheet/actions.ts saveMyGoalSheet { notify: true }
 *   - src/app/goal-sheet/edit/GoalSheetEditor.tsx ボタン文言動的化
 *   - src/lib/admin/alerts.ts goal_sheet_review_requested
 *   - supabase/migrations/20260616000001_goal_sheets_review_requested.sql
 *   - docs/00_premises/admin_alert_tags_spec_2026-06-11.md #9
 *   - memory: project_kinniku_juku_phase4_todo #16 (本テスト起票元)
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
  if (!user) throw new Error(`E2E user ${E2E_STUDENT_EMAIL} not found`);
  return user.id;
}

/**
 * 目標シートを seed する。
 * - withAudits=false → 初回フィクスチャ (= audits なし、 reviewed_at NULL)
 * - withAudits=true  → 2 回目フィクスチャ (= audits あり、 reviewed_at = 過去日)
 */
async function seedGoalSheet(userId: string, withAudits: boolean) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 2026-06-25: 全項目必須ガード導入に伴い、 happy-path (送信→遷移) を通すため
  // 完全入力のシートを seed する (= 未入力ガードに引っかからない状態)。
  const content: Record<string, unknown> = {
    current_status: {
      weight_kg: 70,
      height_cm: 170,
      waist_cm: 80,
      neck_cm: 38,
      body_fat_pct: 18,
      maintenance_kcal: 2200,
    },
    goal_selection: {
      target_weight_kg: 65,
      short_term: "テスト短期目標",
      long_term: "テスト長期目標",
      process: "テストプロセス",
      target_date: "2026-12-31",
    },
    nutrition: { target_calorie: 2000, pfc: { p: 150, f: 50, c: 200 } },
    positive_goals: { achievement_feeling: "テスト達成時の気持ち" },
    self_image: Array.from({ length: 8 }, (_, i) => ({
      key: `item_${i + 1}`,
      label: `項目${i + 1}`,
      before: 3,
      after: 8,
    })),
    filled_sections: [
      "current_status",
      "goal_selection",
      "nutrition",
      "positive_goals",
      "self_image",
    ],
  };
  if (withAudits) {
    content.audits = {
      summary: {
        who: "のり氏",
        date: "2026-06-01",
        text: "テスト添削コメント (audits ありフィクスチャ)",
      },
    };
  }

  // reviewed_at は audits あり時のみ (= 1 週間前に reviewed されたとする)
  const reviewedAt = withAudits
    ? new Date(Date.now() - 7 * 86400000).toISOString()
    : null;

  const { error } = await supabase.from("goal_sheets").upsert(
    {
      user_id: userId,
      content,
      reviewed_at: reviewedAt,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`goal_sheets seed failed: ${error.message}`);
}

test.beforeEach(async () => {
  execSync("node e2e/setup/reset_e2e_student.js", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
});

test("16-1. 初回フロー: 送信して添削を依頼 → /goal-sheet 遷移 → 管理者ホームに urgent タグ", async ({
  browser,
}) => {
  const e2eUserId = await getE2EUserId();
  await seedGoalSheet(e2eUserId, /* withAudits */ false);

  const studentContext: BrowserContext = await browser.newContext({
    storageState: STUDENT_STATE,
  });
  const adminContext: BrowserContext = await browser.newContext({
    storageState: ADMIN_STATE,
  });

  try {
    const studentPage = await studentContext.newPage();
    const adminPage = await adminContext.newPage();

    // 1. 編集画面 → 「送信して添削を依頼」 ボタン文言 (初回)
    await studentPage.goto("/goal-sheet/edit");
    const submitButton = studentPage.locator(
      'button:has-text("送信して添削を依頼")'
    );
    await expect(submitButton).toBeVisible();
    await expect(submitButton).not.toContainText("再添削");

    // 2. 旧「のりに再添削を依頼する」 alert ボタンが削除済
    await expect(
      studentPage.locator('button:has-text("のりに再添削を依頼する")')
    ).toHaveCount(0);

    // 3. 送信ボタン押下 → /goal-sheet (閲覧モード) に遷移
    await submitButton.click();
    await studentPage.waitForURL(/\/goal-sheet$/, { timeout: 15_000 });

    // 4. (2026-06-17 撤回) 「再添削依頼」 タグ機能は撤回 ・ B 案によりここでは検証しない
    // 旧期待: 管理者ホームに「目標シート 再添削依頼」 + 受講生名表示
  } finally {
    await studentContext.close();
    await adminContext.close();
  }
});

// 旧 16-2 (2 回目フロー / 動的文言「再添削を依頼」) は 2026-06-17 きよむさん判断で機能撤回 ・ test 削除済
// ボタン文言は常時「送信して添削を依頼」 で統一

test("16-2. 未入力ガード: 必須が空のまま送信 → 遷移せず未入力リストを表示", async ({
  browser,
}) => {
  // beforeEach の reset で goal_sheets は空 (= 全項目未入力の新規状態)
  const studentContext: BrowserContext = await browser.newContext({
    storageState: STUDENT_STATE,
  });
  try {
    const studentPage = await studentContext.newPage();
    await studentPage.goto("/goal-sheet/edit");

    const submitButton = studentPage.locator(
      'button:has-text("送信して添削を依頼")'
    );
    await expect(submitButton).toBeVisible();

    // 押下 → 全項目必須ガードで止まる (遷移しない)
    await submitButton.click();

    // 1. /goal-sheet (閲覧) へは遷移していない = 編集画面に留まる
    await expect(studentPage).toHaveURL(/\/goal-sheet\/edit$/);

    // 2. 未入力エラー + 不足項目リストが表示される
    await expect(studentPage.locator("body")).toContainText(
      "未入力の項目があります"
    );
    await expect(studentPage.locator("body")).toContainText("現状を把握");
    await expect(studentPage.locator("body")).toContainText("セルフイメージ改善");
  } finally {
    await studentContext.close();
  }
});
