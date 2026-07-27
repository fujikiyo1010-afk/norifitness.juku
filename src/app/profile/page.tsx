import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberHeader } from "@/components/MemberHeader";
import { isBetaUser } from "@/lib/auth/beta";
import { isStaffPreviewUser } from "@/lib/auth/staff-preview";
import { LogoutButton } from "@/app/account/LogoutButton";

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

  // 2026-07-27 プロフィール再設計(森川さん要望): 文字大きめ / 入塾特典を脇役に畳む /
  // お問い合わせを表に。まず社員4人(staff-preview)に仮反映。全公開時はこの分岐を外す。
  const staffPreview = await isStaffPreviewUser();
  if (staffPreview) {
    const shipped = shipment?.status === "shipped";
    return (
      <main className="flex flex-1 flex-col bg-[#f9f5ed] min-h-screen">
        <div className="mx-auto w-full max-w-[460px] flex flex-1 flex-col border-x border-[#e7dcc9]">
          <MemberHeader title="プロフィール" />

          <div className="flex flex-col gap-4 px-4 py-4">
            {/* 基本情報 */}
            <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl p-[18px] flex flex-wrap items-center gap-3.5">
              <div className="w-16 h-16 rounded-full bg-[#4a875b] text-white flex items-center justify-center text-[28px] font-bold flex-shrink-0">
                {name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[20px] font-bold text-[#2b2620] truncate leading-tight">
                  {name}
                </div>
                <div className="text-[12.5px] text-[#6a6256] font-mono truncate mt-0.5">
                  {email}
                </div>
                <div className="text-[12px] text-[#a59b8c] mt-0.5">入会日 {joined}</div>
              </div>
              <Link
                href="/account/profile"
                className="w-full mt-2 flex items-center justify-center gap-1.5 border border-[#d8d2c4] bg-white rounded-xl py-3 text-[14.5px] font-bold text-[#4a4034]"
              >
                <EditIcon />
                プロフィールを編集
              </Link>
            </div>

            {/* カルテ(主役) */}
            <div>
              <div className="text-[12px] font-bold text-[#6a6256] tracking-wider px-1 pb-1.5">
                筋トレカルテ
              </div>
              <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
                {carte ? (
                  <>
                    <div className="flex items-center gap-2 px-[18px] pt-4 pb-1 flex-wrap">
                      <span className="text-[17px] font-bold text-[#2b2620]">
                        筋トレカルテ
                      </span>
                      <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-[#e8f3ec] text-[#2f6b45]">
                        提出済み ・ {fmtDate((carte.created_at as string | null) ?? null)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 px-[18px] pt-2.5 pb-1 text-[14.5px]">
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
                    <div className="flex gap-2.5 px-[18px] py-4">
                      <Link
                        href="/workout/carte"
                        className="flex-1 text-center py-3.5 rounded-xl text-[14.5px] font-bold border border-[#4a875b] text-[#34603f] bg-white"
                      >
                        カルテを見る
                      </Link>
                      <Link
                        href="/workout/carte/request"
                        className="flex-1 text-center py-3.5 rounded-xl text-[14.5px] font-bold btn3d text-white"
                      >
                        変更をリクエスト
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-6 text-center">
                    <div className="text-[14px] text-[#6a6256] mb-4">
                      カルテがまだ未入力です
                    </div>
                    <Link
                      href="/workout/carte/new"
                      className="inline-block px-6 py-3 rounded-xl text-[14.5px] font-bold btn3d text-white"
                    >
                      カルテを入力する
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* 入塾特典プロテイン(脇役): 発送済み=1行 / 発送準備中=住所つき */}
            {shipment &&
              (shipped ? (
                <div className="flex items-center gap-3 px-4 py-3.5 bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl">
                  <GiftIcon />
                  <div className="flex-1 text-[13.5px] text-[#6a6256] leading-snug">
                    <b className="text-[#2b2620] font-bold">入塾特典プロテイン</b>
                    は発送済みです（{fmtDate((shipment.shipped_at as string | null) ?? null)}）
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[12px] font-bold text-[#6a6256] tracking-wider px-1 pb-1.5">
                    入塾特典
                  </div>
                  <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1.5">
                      <GiftIcon />
                      <span className="text-[14.5px] font-bold text-[#2b2620]">
                        入塾特典プロテイン
                      </span>
                      <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-[#fff3e0] text-[#a5631f]">
                        発送準備中
                      </span>
                    </div>
                    <div className="px-4 pb-2.5 pl-12 text-[13px] text-[#6a6256] leading-relaxed">
                      <div className="font-mono">
                        〒{(shipment.postal_code as string | null) ?? "—"}
                      </div>
                      <div className="text-[#2b2620]">
                        {(shipment.address_line as string | null) ?? "—"}
                      </div>
                      <div>宛 {(shipment.recipient_name as string | null) ?? "—"}</div>
                    </div>
                    <Link
                      href="/profile/address"
                      className="flex items-center gap-2 px-4 py-3.5 border-t border-[#f0ead9]"
                    >
                      <span className="flex-1 text-[14.5px] font-bold text-[#2b2620]">
                        住所を変更
                      </span>
                      <span className="text-[#c9bfa9] text-lg">›</span>
                    </Link>
                    <div className="px-4 pb-3.5 text-[11.5px] text-[#a59b8c] leading-relaxed">
                      発送前ならお届け先を変更できます（変更はすぐ反映されます）。発送後は変更できません。
                    </div>
                  </div>
                </div>
              ))}

            {/* 各種メニュー(主役の並び) */}
            <div>
              <div className="text-[12px] font-bold text-[#6a6256] tracking-wider px-1 pb-1.5">
                各種メニュー
              </div>
              <div className="bg-[#fffdf8] border border-[#e7dcc9] rounded-2xl overflow-hidden">
                <Link
                  href="/account"
                  className="flex items-center gap-3.5 px-[18px] py-4 border-b border-[#eee2cc] hover:bg-[#f0e6d3] transition-colors"
                >
                  <GearIcon />
                  <span className="flex-1 text-[15.5px] font-semibold text-[#2b2620]">
                    設定（通知・パスワード）
                  </span>
                  <span className="text-[#c9bfa9] text-lg">›</span>
                </Link>
                <Link
                  href="/account/help"
                  className="flex items-center gap-3.5 px-[18px] py-4 border-b border-[#eee2cc] hover:bg-[#f0e6d3] transition-colors"
                >
                  <ChatIcon />
                  <span className="flex-1 text-[15.5px] font-semibold text-[#2b2620]">
                    お問い合わせ
                  </span>
                  <span className="text-[#c9bfa9] text-lg">›</span>
                </Link>
                <LogoutButton variant="row" />
              </div>
            </div>

            <p className="text-center text-[11px] text-[#a59b8c] font-mono mt-1 mb-4">
              のりfitness 筋肉塾 ・ v1.0.0
            </p>
          </div>
        </div>
      </main>
    );
  }

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

// =====================================================================
// 線画SVGアイコン (再設計版・絵文字禁止ルール準拠)
// =====================================================================

function EditIcon() {
  return (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="w-[22px] h-[22px] text-[#a5631f] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="w-[21px] h-[21px] text-[#4a4034] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-[21px] h-[21px] text-[#4a4034] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
