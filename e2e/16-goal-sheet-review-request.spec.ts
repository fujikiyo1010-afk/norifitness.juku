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

  const content: Record<string, unknown> = {
    current_status: { weight_kg: 70 },
    goal_selection: { short_term: "テスト目標", target_weight_kg: 65 },
    nutrition: {},
    positive_goals: {},
    self_image: [],
    filled_sections: ["current_status", "goal_selection"],
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

// 16-2 (2 回目フロー / 動的文言「再添削を依頼」) は 2026-06-17 きよむさん判断で機能撤回 ・ test 削除済
// ボタン文言は常時「送信して添削を依頼」 で統一
