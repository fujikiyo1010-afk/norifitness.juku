import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { isBetaUser } from "@/lib/auth/beta";

export const dynamic = "force-dynamic";

/**
 * 受講生 プロフィール画面 (/profile ・ 層2 2026-06-29)
 *
 * 個人データのハブ:
 *   - 基本情報 (氏名 / メール / アバター / 入会日) + 氏名編集
 *   - カルテ (提出済み要約 + 「カルテを見る」「変更をリクエスト」)
 *   - プロテイン発送 (発送準備中=住所変更可 / 発送済み=ロック)
 *
 * 下ナビ右端「プロフィール」+ オンボ後の到達先。
 * 目標シート/体組成はホーム/記録タブのまま (= プロフィールに集約しない方針)。
 */
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const [{ data: profile }, { data: carte }, { data: shipment }] =
    await Promise.all([
      supabase
        .from("users")
        .select("name, email, joined_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_workout_carte")
        .select("gender, focus_body_parts, environments, frequency_wish, created_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("shipments")
        .select("postal_code, address_line, recipient_name, status, shipped_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const name = (profile?.name as string | null) ?? "受講生";
  const email = (profile?.email as string | null) ?? user.email ?? "";
  const joined = fmtDate((profile?.joined_at as string | null) ?? null);

  const focus = ((carte?.focus_body_parts as string[] | null) ?? []).join(" ・ ");
  const envs = ((carte?.environments as string[] | null) ?? []).join(" ・ ");

  // B11: プロフィール最下部に「アカウント設定」への導線(ベータ限定)
  const isBeta = await isBetaUser();

  return (
    <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
      <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
        <MemberHeader title="プロフィール" />

        <div className="flex flex-col gap-3 px-4 py-4">
          {/* 基本情報 */}
          <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-[54px] h-[54px] rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[22px] font-bold flex-shrink-0">
              {name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold text-[#2b2620] truncate">
                {name}
              </div>
              <div className="text-[11px] text-[#6a6256] font-mono truncate mt-0.5">
                {email}
              </div>
              <div className="text-[10.5px] text-[#a59b8c] mt-0.5">
                入会日 {joined}
              </div>
            </div>
            <Link
              href="/account/profile"
              className="flex-shrink-0 border border-[#d8d2c4] bg-white rounded-lg px-3 py-1.5 text-[11px] font-bold text-[#4a4034]"
            >
              氏名を編集
            </Link>
          </div>

          {/* カルテ */}
          <div>
            <div className="text-[10.5px] font-bold text-[#6a6256] tracking-wider px-1 pb-1.5">
              カルテ
            </div>
            <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
              {carte ? (
                <>
                  <div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
                    <span className="text-[13.5px] font-bold text-[#2b2620]">
                      筋トレカルテ
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#e8f3ec] text-[#2f6b45]">
                      提出済み ・ {fmtDate((carte.created_at as string | null) ?? null)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-4 pb-3 text-[11.5px]">
                    <span className="text-[#a59b8c]">性別</span>
                    <span className="font-semibold">{(carte.gender as string) ?? "—"}</span>
                    <span className="text-[#a59b8c]">重点部位</span>
                    <span className="font-semibold">{focus || "—"}</span>
                    <span className="text-[#a59b8c]">環境</span>
                    <span className="font-semibold">{envs || "—"}</span>
                    <span className="text-[#a59b8c]">頻度</span>
                    <span className="font-semibold">
                      {(carte.frequency_wish as string | null) ?? "—"}
                    </span>
                  </div>
                  <div className="flex gap-2 px-4 pb-4">
                    <Link
                      href="/workout/carte"
                      className="flex-1 text-center py-2.5 rounded-xl text-[11.5px] font-bold border border-[#4a875b] text-[#34603f] bg-white"
                    >
                      カルテを見る
                    </Link>
                    <Link
                      href="/workout/carte/request"
                      className="flex-1 text-center py-2.5 rounded-xl text-[11.5px] font-bold btn3d text-white"
                    >
                      変更をリクエスト
                    </Link>
                  </div>
                </>
              ) : (
                <div className="px-4 py-5 text-center">
                  <div className="text-[12px] text-[#6a6256] mb-3">
                    カルテがまだ未入力です
                  </div>
                  <Link
                    href="/workout/carte/new"
                    className="inline-block px-5 py-2.5 rounded-xl text-[12px] font-bold btn3d text-white"
                  >
                    カルテを入力する
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* プロテイン発送 */}
          {shipment && (
            <div>
              <div className="text-[10.5px] font-bold text-[#6a6256] tracking-wider px-1 pb-1.5">
                プロテイン発送
              </div>
              <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
                  <span className="text-[13.5px] font-bold text-[#2b2620]">
                    入塾特典プロテイン
                  </span>
                  {shipment.status === "pending" ? (
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#fff3e0] text-[#a5631f]">
                      発送準備中
                    </span>
                  ) : shipment.status === "shipped" ? (
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#e8f3ec] text-[#2f6b45]">
                      ✓ 発送済み ・ {fmtDate((shipment.shipped_at as string | null) ?? null)}
                    </span>
                  ) : null}
                </div>
                <div className="px-4 pt-1 pb-3">
                  <div className="text-[11px] text-[#6a6256] font-mono">
                    〒{(shipment.postal_code as string | null) ?? "—"}
                  </div>
                  <div className="text-[12px] text-[#2b2620] leading-relaxed">
                    {(shipment.address_line as string | null) ?? "—"}
                  </div>
                  <div className="text-[10.5px] text-[#a59b8c] mt-0.5">
                    宛名: {(shipment.recipient_name as string | null) ?? "—"}
                  </div>
                </div>
                {shipment.status === "pending" ? (
                  <>
                    <Link
                      href="/profile/address"
                      className="flex items-center gap-2 px-4 py-3 border-t border-[#f0ead9]"
                    >
                      <span className="flex-1 text-[13px] font-semibold text-[#2b2620]">
                        住所を変更
                      </span>
                      <span className="text-[#c9bfa9] text-sm">›</span>
                    </Link>
                    <div className="px-4 pb-3 text-[10px] text-[#a59b8c] leading-relaxed">
                      発送前なら変更できます（変更はすぐ反映されます）。発送後は変更できません。
                    </div>
                  </>
                ) : (
                  <div className="px-4 pb-3 text-[10px] text-[#a59b8c]">
                    発送が完了したため、住所の変更はできません。
                  </div>
                )}
              </div>
            </div>
          )}

          {/* B11: アカウント設定への導線(ベータ) */}
          {isBeta && (
            <Link
              href="/account"
              className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl px-4 py-3.5 flex items-center justify-between hover:bg-[#f0e6d3]/40 transition-colors"
            >
              <span className="text-[13px] font-bold text-[#2b2620]">
                アカウント設定
              </span>
              <span className="text-[12px] text-[#a59b8c]">
                通知・パスワード・ログアウト →
              </span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
