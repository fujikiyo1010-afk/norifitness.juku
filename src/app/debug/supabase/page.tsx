import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

function maskHost(url: string | undefined): string {
  if (!url) return "(未設定)";
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return "(不正な URL)";
  }
}

function keyShape(key: string | undefined): string {
  if (!key) return "(未設定)";
  const prefix = key.slice(0, 12);
  return `${prefix}… (${key.length} chars)`;
}

export default async function SupabaseDebugPage() {
  // 防御 2 層目: admin 以外は / に追い返す
  // (middleware 側でも /debug は公開パスから外したので、未ログインは /login へ)
  await requireAdmin();

  const checks: CheckResult[] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL;

  checks.push({
    label: "環境変数: NEXT_PUBLIC_SUPABASE_URL",
    ok: Boolean(url),
    detail: maskHost(url),
  });
  checks.push({
    label: "環境変数: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ok: Boolean(anonKey),
    detail: keyShape(anonKey),
  });
  checks.push({
    label: "環境変数: SUPABASE_SERVICE_ROLE_KEY",
    ok: Boolean(serviceKey),
    detail: keyShape(serviceKey),
  });
  checks.push({
    label: "環境変数: RESEND_API_KEY",
    ok: Boolean(resendKey) && resendKey!.startsWith("re_"),
    detail: keyShape(resendKey),
  });
  checks.push({
    label: "環境変数: RESEND_FROM_EMAIL",
    ok: Boolean(resendFrom),
    detail: resendFrom ?? "(未設定)",
  });

  let supabaseOk = false;
  try {
    const supabase = await createClient();

    // 1) Auth 疎通: URL/ANON_KEY が無効なら 401 で返る
    const sessionRes = await supabase.auth.getSession();
    checks.push({
      label: "Auth エンドポイント (auth.getSession)",
      ok: !sessionRes.error,
      detail: sessionRes.error
        ? `❌ ${sessionRes.error.message}`
        : `✅ 応答 OK（現在のセッション: ${sessionRes.data.session ? "あり" : "なし"}）`,
    });

    // 2) Postgres 疎通 + 主要テーブル存在確認
    //    各テーブルに対して count クエリを投げる。head:true で行データを取らずに件数だけ取得。
    const tablesToProbe = [
      "users",
      "admin_users",
      "courses",
      "chapters",
      "lessons",
      "lesson_progress",
      "comments",
      "goal_sheets",
      "tests",
      "test_attempts",
      "invitations",
      "stripe_events",
      "notifications",
      "broadcast_notifications",
      "user_status_history",
      "user_profiles",
      "goal_sheet_revisions",
      "faqs",
      "faq_categories",
    ];

    const probeResults = await Promise.all(
      tablesToProbe.map(async (t) => {
        const { error } = await supabase
          .from(t)
          .select("*", { count: "exact", head: true });
        // RLS により行は見えなくてもよい。テーブル不在エラー (42P01 / PGRST205) だけが NG。
        const missing =
          error?.code === "42P01" ||
          error?.code === "PGRST205" ||
          /does not exist/i.test(error?.message ?? "") ||
          /could not find the table/i.test(error?.message ?? "");
        return { table: t, ok: !missing, code: error?.code, msg: error?.message };
      })
    );

    const missingTables = probeResults.filter((r) => !r.ok);
    checks.push({
      label: `Postgres スキーマ: 主要 ${tablesToProbe.length} テーブル存在確認`,
      ok: missingTables.length === 0,
      detail:
        missingTables.length === 0
          ? `✅ 全テーブル存在 (RLS により行データは見えないが、テーブル不在ではない = スキーマ適用済み)`
          : `❌ 不在: ${missingTables.map((m) => `${m.table}(${m.code})`).join(", ")}`,
    });

    // 3) シードデータ確認: faq_categories は authenticated ロール対象なので
    //    anon クライアントでは行は 0 件で返るのが正常 (エラーにならなければ OK)
    const seedCheck = await supabase
      .from("faq_categories")
      .select("*", { count: "exact", head: true });
    checks.push({
      label: "faq_categories クエリ実行可能性",
      ok: !seedCheck.error || /permission/i.test(seedCheck.error?.message ?? ""),
      detail: seedCheck.error
        ? `⚠️ ${seedCheck.error.code}: ${seedCheck.error.message}（RLS の挙動として妥当な場合あり）`
        : `✅ クエリ実行 OK (anon ロールでは行数 0 / RLS により非公開 = 想定通り)`,
    });

    supabaseOk = checks.slice(-3).every((c) => c.ok);
  } catch (e) {
    checks.push({
      label: "Supabase クライアント生成",
      ok: false,
      detail: `❌ 例外: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  const allOk = checks.every((c) => c.ok);

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            🔌 Supabase 接続テスト
          </h1>
          <p className="text-sm text-zinc-500">
            このページは疎通確認用です。フェーズ1 完了後は削除して構いません。
          </p>
        </header>

        <div
          className={`rounded-lg border p-4 text-sm ${
            allOk
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          }`}
        >
          {allOk ? (
            <p>
              ✅ 全チェック PASS — Supabase との疎通は正常です。マイグレーション SQL 作成に進めます。
            </p>
          ) : (
            <p>
              ⚠️ 失敗しているチェックがあります。詳細を確認してください。
            </p>
          )}
        </div>

        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.label}
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {c.ok ? "✅" : "❌"} {c.label}
                </span>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400 break-all">
                {c.detail}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-xs text-zinc-500">
          supabaseOk={String(supabaseOk)} / 生成日時:{" "}
          {new Date().toISOString()}
        </p>
      </div>
    </main>
  );
}
