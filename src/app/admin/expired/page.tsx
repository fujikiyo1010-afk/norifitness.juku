import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeServiceState,
  SERVICE_PERIOD_DAYS,
  type ServiceState,
} from "@/lib/auth/service-expired";
import { setGraceAction, clearGraceAction, restartServiceAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * 管理画面 ・ 満了 (/admin/expired) ・ C2 2026-08-26
 *
 * サポート期間(180日)が終わった受講生の棚。枝は2つ:
 *   特別 … grace(期限つきの延長)が付いている人。期限が来ると自動で満了へ移る
 *   満了 … 純満了版(記録・学習・過去閲覧のみ)。添削キューには出ない
 * おまけで「まもなく満了(30日以内)」も一覧(特別を付けるかの都度判断用)。
 * デスクトップ PC 専用 (memory: feedback_admin_desktop_only)。
 */

type Row = {
  id: string;
  name: string;
  started: string | null;
  graceUntil: string | null;
  graceScope: string | null;
  state: ServiceState;
  expireDate: string | null; // 開始+180日
  daysPast: number | null; // 満了からの経過(+)/満了までの残り(-)
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const STATE_CHIP: Record<string, { label: string; cls: string }> = {
  grace_full: { label: "特別(全機能)", cls: "bg-[#e0f2f1] text-[#00695c]" },
  grace_meal: { label: "特別(食事添削のみ)", cls: "bg-[#fff3e0] text-[#b26a00]" },
  expired: { label: "満了", cls: "bg-zinc-200 text-zinc-600" },
};

export default async function AdminExpiredPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, name, service_started_at, grace_until, grace_scope, status")
    .eq("status", "active")
    .order("service_started_at", { ascending: true });

  const now = Date.now();
  const rows: Row[] = (data ?? []).map((u) => {
    const started = u.service_started_at as string | null;
    const state = computeServiceState(
      started,
      u.grace_until as string | null,
      u.grace_scope as string | null,
      now
    );
    const expireMs = started
      ? new Date(started).getTime() + SERVICE_PERIOD_DAYS * 86_400_000
      : null;
    return {
      id: u.id as string,
      name: (u.name as string) ?? "?",
      started,
      graceUntil: u.grace_until as string | null,
      graceScope: u.grace_scope as string | null,
      state,
      expireDate: expireMs ? new Date(expireMs).toISOString() : null,
      daysPast: expireMs ? Math.floor((now - expireMs) / 86_400_000) : null,
    };
  });

  const special = rows.filter(
    (r) => r.state === "grace_full" || r.state === "grace_meal"
  );
  const expired = rows.filter((r) => r.state === "expired");
  // まもなく満了(30日以内・アクティブ)。特別を付けるかの都度判断用
  const soon = rows.filter(
    (r) => r.state === "active" && r.daysPast != null && r.daysPast >= -30
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <h1 className="text-lg font-bold text-zinc-900">満了</h1>
      <p className="mt-1 text-xs text-zinc-500">
        サポート期間(180日)が終わった受講生の棚です。特別(期限つき延長)は期限が来ると自動で満了へ移ります。
        満了の人はデイリー添削のキューに出ません。
      </p>

      <Section
        title={`特別 (${special.length}人)`}
        hint="期限つきの延長中。期限日は自動で効きます"
      >
        <Table rows={special} showGraceEdit />
      </Section>

      <Section
        title={`満了 (${expired.length}人)`}
        hint="記録・学習・過去の閲覧だけ使える状態"
      >
        <Table rows={expired} showGraceEdit />
      </Section>

      <Section
        title={`まもなく満了 (30日以内・${soon.length}人)`}
        hint="通常版のまま。特別を付けるかは記録の様子を見て都度判断"
      >
        <Table rows={soon} showGraceEdit />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-zinc-800">{title}</h2>
        <span className="text-[11px] text-zinc-400">{hint}</span>
      </div>
      <div className="mt-2 overflow-hidden rounded-[11px] border border-zinc-200 bg-white">
        {children}
      </div>
    </section>
  );
}

function Table({ rows, showGraceEdit }: { rows: Row[]; showGraceEdit?: boolean }) {
  if (rows.length === 0) {
    return <p className="px-4 py-5 text-xs text-zinc-400">該当者はいません</p>;
  }
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-zinc-100 bg-zinc-50 text-[11px] text-zinc-500">
          <th className="px-4 py-2 font-medium">名前</th>
          <th className="px-2 py-2 font-medium">開始日</th>
          <th className="px-2 py-2 font-medium">満了日</th>
          <th className="px-2 py-2 font-medium">状態</th>
          <th className="px-2 py-2 font-medium">特別の期限</th>
          {showGraceEdit && <th className="px-2 py-2 font-medium">操作</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const chip = STATE_CHIP[r.state];
          return (
            <tr key={r.id} className="border-b border-zinc-100 last:border-b-0">
              <td className="px-4 py-2.5 font-bold text-zinc-800">{r.name}</td>
              <td className="px-2 py-2.5 font-mono text-zinc-600">{fmtDate(r.started)}</td>
              <td className="px-2 py-2.5 font-mono text-zinc-600">
                {fmtDate(r.expireDate)}
                {r.daysPast != null && (
                  <span className="ml-1 text-[10px] text-zinc-400">
                    {r.daysPast >= 0 ? `+${r.daysPast}日` : `あと${-r.daysPast}日`}
                  </span>
                )}
              </td>
              <td className="px-2 py-2.5">
                {chip ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>
                    {chip.label}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-400">通常</span>
                )}
              </td>
              <td className="px-2 py-2.5 font-mono text-zinc-600">
                {r.graceUntil ?? "—"}
                {r.graceScope === "meal" && (
                  <span className="ml-1 text-[10px] text-[#b26a00]">食事のみ</span>
                )}
              </td>
              {showGraceEdit && (
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <form action={setGraceAction} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={r.id} />
                      <input
                        type="date"
                        name="until"
                        defaultValue={r.graceUntil ?? ""}
                        className="rounded border border-zinc-300 px-1 py-0.5 text-[11px]"
                        required
                      />
                      <select
                        name="scope"
                        defaultValue={r.graceScope ?? "full"}
                        className="rounded border border-zinc-300 px-1 py-0.5 text-[11px]"
                      >
                        <option value="full">全機能</option>
                        <option value="meal">食事のみ</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded bg-[#00897b] px-2 py-1 text-[11px] font-bold text-white"
                      >
                        特別を設定
                      </button>
                    </form>
                    {r.graceUntil && (
                      <form action={clearGraceAction}>
                        <input type="hidden" name="userId" value={r.id} />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600"
                        >
                          特別を外す
                        </button>
                      </form>
                    )}
                    <form action={restartServiceAction}>
                      <input type="hidden" name="userId" value={r.id} />
                      <button
                        type="submit"
                        className="rounded border border-[#00897b]/40 px-2 py-1 text-[11px] font-bold text-[#00897b]"
                      >
                        通常へ戻す(開始日を今日に)
                      </button>
                    </form>
                  </div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
