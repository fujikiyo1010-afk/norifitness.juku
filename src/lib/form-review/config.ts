/**
 * フォーム添削(5大機能②)の外部予約URL(UTAGE・熱で予約管理)と料金。
 * 本体はページ遷移だけ。初回無料 → 管理で「初回完了」トグル → 2回目以降(有料)URLへ。
 * URLは秘匿情報ではなく予約ページ。全体公開時も同じ2本を使い回す想定。
 */
export const FORM_REVIEW_URL_FIRST =
  "https://utage-system.com/event/CZLNJ87EYKjT/register";
export const FORM_REVIEW_URL_REPEAT =
  "https://utage-system.com/event/hltj0Bk0NS1i/register";

/** 2回目以降の1回あたり料金(円)。 */
export const FORM_REVIEW_PRICE_REPEAT = 4000;
