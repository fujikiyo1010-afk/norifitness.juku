import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import {
  listPendingRequestsWithUserInfo,
  getCarteForAdmin,
} from "@/lib/workout/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { RequestReplyForm } from "./_components/RequestReplyForm";

export const dynamic = "force-dynamic";

type Search = { id?: string; type?: string };

/**
 * 管理画面 リクエスト処理 (流れ作業 / 即時モデル)
 *
 * モック: docs/03_design_mocks/recovered/管理画面_リクエスト_流れ作業.html
 *
 * 設計原則:
 *   - 左ペイン: 未対応リスト / 右ペイン: 選択中の詳細
 *   - URL ?id=xxx&type=carte|workout で右ペイン制御
 *   - 編集 → 返信 順番強制 (テキスト未入力時は送信ボタン disabled)
 *   - 完了形テンプレ標準 / 「次月反映」廃止
 *   - ステータス 2 値 pending / handled
 */
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const selectedId = sp.id ?? null;
  const selectedType =
    sp.type === "carte" || sp.type === "workout" ? sp.type : null;

  const { carte, workout } = await listPendingRequestsWithUserInfo();
  const totalPending = carte.length + workout.length;

  return (
    <div className="min-h-[calc(100vh-0px)] bg-zinc-50 flex">
      {/* ===== 左ペイン: リスト ===== */}
      <aside className="w-[340px] flex-shrink-0 bg-white border-r border-[#e8ebe9] flex flex-col">
        <div className="px-5 py-4 border-b border-[#e8ebe9]">
          <h1 className="text-base font-bold text-zinc-900">リクエスト処理</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            カルテ更新 / メニュー変更 ・ 即時処理
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500">未対応</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                totalPending > 0
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {totalPending} 件
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {totalPending === 0 && (
            <div className="px-5 py-8 text-center text-xs text-zinc-500">
              未対応のリクエストはありません
            </div>
          )}

          {carte.length > 0 && (
            <>
              <SectionLabel
                label="カルテ更新"
                count={carte.length}
                tone="carte"
              />
              {carte.map((req) => (
                <RequestRow
                  key={req.id}
                  active={selectedType === "carte" && selectedId === req.id}
                  type="carte"
                  request={req}
                />
              ))}
            </>
          )}

          {workout.length > 0 && (
            <>
              <SectionLabel
                label="メニュー変更"
                count={workout.length}
                tone="workout"
              />
              {workout.map((req) => (
                <RequestRow
                  key={req.id}
                  active={selectedType === "workout" && selectedId === req.id}
                  type="workout"
                  request={req}
                />
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ===== 右ペイン: 詳細 ===== */}
      <section className="flex-1 min-w-0 overflow-y-auto">
        {selectedId && selectedType ? (
          <DetailPane
            requestId={selectedId}
            type={selectedType}
          />
        ) : (
          <div className="h-full flex items-center justify-center px-6 py-16">
            <div className="text-center">
              <div className="text-sm font-semibold text-zinc-700 mb-1">
                左から処理するリクエストを選んでください
              </div>
              <div className="text-xs text-zinc-500">
                未対応の古い順に並んでいます
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// =====================================================================
// 左ペイン補助
// =====================================================================

function SectionLabel({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "carte" | "workout";
}) {
  const dotColor = tone === "carte" ? "bg-[#0369a1]" : "bg-[#00897b]";
  return (
    <div className="px-5 py-2 border-b border-[#e8ebe9] bg-zinc-50 flex items-center gap-2 text-[10px] font-bold text-zinc-500 tracking-widest">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {label}
      <span className="ml-auto bg-white border border-[#e8ebe9] text-zinc-700 px-2 py-0.5 rounded-full font-mono text-[10px]">
        {count}
      </span>
    </div>
  );
}

type AnyRequest = {
  id: string;
  user_id: string;
  user_info: { display_name: string };
  request_text: string;
  created_at: string;
};

function RequestRow({
  type,
  active,
  request,
}: {
  type: "carte" | "workout";
  active: boolean;
  request: AnyRequest;
}) {
  const dotColor = type === "carte" ? "bg-[#0369a1]" : "bg-[#00897b]";
  const dotText = type === "carte" ? "text-[#0369a1]" : "text-[#00897b]";
  const typeLabel = type === "carte" ? "カルテ更新" : "メニュー変更";
  const userName = request.user_info.display_name;
  const daysAgo = Math.floor(
    (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Link
      href={`/admin/requests?id=${request.id}&type=${type}`}
      className={`block px-5 py-3 border-b border-[#e8ebe9] transition-colors ${
        active
          ? "bg-[#00897b]/8 border-l-[3px] border-l-[#00897b] pl-[17px]"
          : "hover:bg-zinc-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-full bg-[#00897b] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
          {userName.charAt(0)}
        </div>
        <span className="text-[13px] font-bold text-zinc-900">
          {userName}
        </span>
      </div>
      <div
        className={`text-[10px] font-bold ${dotText} mb-1 flex items-center gap-1`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {typeLabel}
      </div>
      <div className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
        {request.request_text}
      </div>
      <div className="text-[10px] text-zinc-400 mt-1 font-mono">
        {new Date(request.created_at).toLocaleDateString("ja-JP")} ・ {daysAgo}{" "}
        日経過
      </div>
    </Link>
  );
}

// =====================================================================
// 右ペイン: 詳細
// =====================================================================

async function DetailPane({
  requestId,
  type,
}: {
  requestId: string;
  type: "carte" | "workout";
}) {
  const admin = createAdminClient();
  const table =
    type === "carte" ? "user_carte_request" : "user_workout_request";

  const { data: req } = await admin
    .from(table)
    .select("id, user_id, request_text, status, created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (!req) {
    return (
      <div className="px-6 py-10 text-center text-sm text-zinc-500">
        リクエストが見つかりません
      </div>
    );
  }

  const { data: user } = await admin
    .from("users")
    .select("id, name, joined_at")
    .eq("id", req.user_id)
    .maybeSingle();

  const carte = type === "carte" ? await getCarteForAdmin(req.user_id) : null;
  const editHref =
    type === "carte"
      ? `/admin/users/${req.user_id}/carte?from=request&requestId=${requestId}`
      : `/admin/users/${req.user_id}/menu/new?from=request&requestId=${requestId}`;

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="px-6 py-4 bg-white border-b border-[#e8ebe9] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00897b] text-white flex items-center justify-center font-bold text-sm">
            {user?.name?.charAt(0) ?? "?"}
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              {user?.name ?? "不明"}
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  type === "carte"
                    ? "bg-[#0369a1]/8 text-[#0369a1] border-[#0369a1]/20"
                    : "bg-[#00897b]/8 text-[#00897b] border-[#00897b]/20"
                }`}
              >
                {type === "carte" ? "カルテ更新" : "メニュー変更"}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {user?.joined_at &&
                new Date(user.joined_at).toLocaleDateString("ja-JP")}{" "}
              入塾 ・ 受信{" "}
              {new Date(req.created_at).toLocaleDateString("ja-JP")}
            </div>
          </div>
        </div>
        {user && (
          <Link
            href={`/admin/users/${user.id}`}
            className="text-[12px] text-[#00695c] hover:underline inline-flex items-center gap-1"
          >
            受講生ハブで詳細 →
          </Link>
        )}
      </div>

      {/* 詳細本体 */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
        {/* 要望 */}
        <div className="rounded-[10px] border border-[#e8ebe9] bg-white p-4">
          <div className="text-[10px] font-bold tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                type === "carte" ? "bg-[#0369a1]" : "bg-[#00897b]"
              }`}
            />
            受講生の要望
          </div>
          <div className="bg-zinc-50 border-l-[3px] border-l-[#00897b] rounded-r-md px-3 py-2.5 text-sm text-zinc-900 whitespace-pre-line">
            {req.request_text}
          </div>
        </div>

        {/* 提出済カルテ (カルテ更新時のみ表示) */}
        {type === "carte" && carte && (
          <div className="rounded-[10px] border border-[#e8ebe9] bg-white p-4">
            <div className="text-[10px] font-bold tracking-widest text-zinc-500 mb-2">
              提出済カルテ ・ 参考情報
            </div>
            <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 gap-x-3 text-[12px]">
              <dt className="text-zinc-500">性別</dt>
              <dd className="text-zinc-900 font-semibold m-0">{carte.gender}</dd>
              <dt className="text-zinc-500">使える環境</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.environments.length > 0
                  ? carte.environments.join(" ・ ")
                  : "—"}
              </dd>
              <dt className="text-zinc-500">理想の頻度</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.frequency_wish ?? "—"}
              </dd>
              <dt className="text-zinc-500">鍛えたい部位</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.focus_body_parts.length > 0
                  ? carte.focus_body_parts.join(" ・ ")
                  : "—"}
              </dd>
              <dt className="text-zinc-500">目的</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.purposes.length > 0 ? carte.purposes.join(" ・ ") : "—"}
              </dd>
              <dt className="text-zinc-500">運動経験</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.experience ?? "—"}
              </dd>
              <dt className="text-zinc-500">医師制限</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.medical_limits.length > 0
                  ? carte.medical_limits.join(" ・ ")
                  : "なし"}
              </dd>
              <dt className="text-zinc-500">目指す身体像</dt>
              <dd className="text-zinc-900 font-semibold m-0">
                {carte.ideal_body ?? "—"}
              </dd>
            </dl>
          </div>
        )}
      </div>

      {/* 返信フォーム */}
      <RequestReplyForm
        type={type}
        requestId={requestId}
        editHref={editHref}
      />
    </div>
  );
}
