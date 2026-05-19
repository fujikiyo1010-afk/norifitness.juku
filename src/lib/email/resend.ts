import { Resend } from "resend";

let cachedClient: Resend | null = null;

export function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("getResendClient: RESEND_API_KEY が未設定です");
  }
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function getFromEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("getFromEmail: RESEND_FROM_EMAIL が未設定です");
  }
  // ドメイン認証済みなら表示名付きの "のりfitness 筋肉塾 <noreply@...>" 形式が使える
  // 未認証の onboarding@resend.dev では表示名を付けると拒否されるケースがあるためそのまま返す
  return from.includes("@resend.dev") ? from : `のりfitness 筋肉塾 <${from}>`;
}
