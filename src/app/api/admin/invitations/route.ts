import { NextResponse, type NextRequest } from "next/server";
import { createInvitation } from "@/lib/invitations/create";

// POST /api/admin/invitations
// Bootstrap auth: Authorization Bearer に SUPABASE_SERVICE_ROLE_KEY が一致すること。
// UI からの招待発行は src/app/admin/invitations/actions.ts の Server Action 経由。
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || authHeader !== expected) {
    return NextResponse.json(
      { error: "unauthorized", message: "Bootstrap キーが必要です" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "JSON ボディが不正です" },
      { status: 400 }
    );
  }

  const { email, name } = (body ?? {}) as { email?: unknown; name?: unknown };
  if (typeof email !== "string" || typeof name !== "string") {
    return NextResponse.json(
      { error: "bad_request", message: "email / name は文字列で必須" },
      { status: 400 }
    );
  }

  const result = await createInvitation({ email, name, createdBy: null });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      invitation: result.invitation,
      email: { id: result.emailId, to: result.invitation.email },
      invite_url: result.inviteUrl,
    },
    { status: 201 }
  );
}
