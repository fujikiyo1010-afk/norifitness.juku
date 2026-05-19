type InvitationEmailParams = {
  name: string;
  inviteUrl: string;
  expiresAtJst: string;
};

export function buildInvitationEmail({ name, inviteUrl, expiresAtJst }: InvitationEmailParams) {
  const subject = "【筋肉塾】受講開始のご案内 — パスワード設定をお願いします";

  const text = `${name} 様

筋肉塾へのご参加ありがとうございます。
以下のリンクから初回ログインのパスワードを設定してください。

▼ パスワード設定はこちらから
${inviteUrl}

※ このリンクは 1 度しか使えません。
※ ${expiresAtJst} まで有効です。
※ 万が一リンク切れの場合は、サポート LINE までご連絡ください。

のりfitness 筋肉塾 運営事務局
`;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans',Meiryo,sans-serif;color:#1f1f1f;line-height:1.7;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background-color:#ffffff;">
    <h1 style="font-size:20px;font-weight:700;margin:0 0 24px;">のりfitness 筋肉塾</h1>

    <p style="font-size:15px;margin:0 0 16px;">${escapeHtml(name)} 様</p>

    <p style="font-size:15px;margin:0 0 16px;">
      筋肉塾へのご参加ありがとうございます。<br>
      以下のボタンから初回ログインのパスワードを設定してください。
    </p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${inviteUrl}"
         style="display:inline-block;padding:14px 32px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
        パスワードを設定する
      </a>
    </div>

    <p style="font-size:13px;color:#666666;margin:24px 0 8px;">
      ボタンが押せない場合は、以下の URL をブラウザに貼り付けてください:
    </p>
    <p style="font-size:13px;color:#666666;word-break:break-all;margin:0 0 24px;">
      <a href="${inviteUrl}" style="color:#0f172a;">${inviteUrl}</a>
    </p>

    <hr style="border:none;border-top:1px solid #eaeaea;margin:32px 0;">

    <p style="font-size:13px;color:#666666;margin:0 0 8px;">
      ※ このリンクは 1 度しか使えません。<br>
      ※ <strong>${expiresAtJst}</strong> まで有効です。<br>
      ※ 万が一リンク切れの場合は、サポート LINE までご連絡ください。
    </p>

    <p style="font-size:12px;color:#999999;margin:24px 0 0;">
      のりfitness 筋肉塾 運営事務局
    </p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
