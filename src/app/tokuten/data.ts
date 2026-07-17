/**
 * 特典ライブラリ カタログ (2026-07-14)
 *
 * ホーム→特典ライブラリ(/tokuten)→ LINE無料特典(/tokuten/line) / ウェビナー特典(/tokuten/webinar)
 * 各特典の実体は public/tokuten/<file>.html (元の特典LPを勧誘/外部導線を剥がして内部化した静的ページ)。
 *
 * 採用/除外の確定内容: memory project_kinniku_juku_tokuten_library 参照。
 *   - LINE無料特典(01): 25本 (30選のうち 04/23/24/25/26/30 除外 + carb-guide追加)
 *   - ウェビナー特典(07): 5本 (index/voices系除外)
 * 種類でグループ分け。href は同一ドメイン内(juku.norifitness.com)。外部URLへは飛ばさない。
 */

export type TokutenIconKey =
  | "video"
  | "book"
  | "food"
  | "list"
  | "mind"
  | "tier"
  | "home";

export type TokutenItem = {
  /** 元の特典番号 (表示用。carb-guide や 07 は無し) */
  n?: string;
  title: string;
  icon: TokutenIconKey;
  /** アイコンチップ 背景 / 前景 */
  bg: string;
  fg: string;
  /** public/tokuten/ 配下の静的ファイル名 */
  file: string;
};

export type TokutenGroup = {
  label: string;
  items: TokutenItem[];
};

const C = {
  green: { bg: "#eaf3ec", fg: "#4a875b" },
  blue: { bg: "#e8f0fa", fg: "#3a6ea5" },
  gold: { bg: "#f7efd4", fg: "#b8860b" },
  rose: { bg: "#fbe9ee", fg: "#d6536a" },
  teal: { bg: "#e3f1ee", fg: "#2f7d6b" },
  purple: { bg: "#efeafd", fg: "#7a5af0" },
  orange: { bg: "#f7ece2", fg: "#c2693f" },
} as const;

function item(
  n: string | undefined,
  title: string,
  icon: TokutenIconKey,
  color: keyof typeof C,
  file: string,
): TokutenItem {
  return { n, title, icon, bg: C[color].bg, fg: C[color].fg, file };
}

export const LINE_TOKUTEN: TokutenGroup[] = [
  {
    label: "動画講義",
    items: [
      item("01", "ボディメイク完全攻略動画", "video", "green", "tokuten_01.html"),
      item("02", "痩せる徹底解説スライド", "video", "green", "tokuten_02.html"),
      item("03", "筋トレ基礎知識完全攻略", "video", "blue", "tokuten_03.html"),
      item("05", "カロリーの質完全攻略動画講義", "video", "green", "tokuten_05.html"),
      item("07", "腸活完全攻略動画講義", "video", "green", "tokuten_07.html"),
      item("20", "最効率で筋肉をつけるメニュー", "video", "blue", "tokuten_20.html"),
      item("21", "筋トレフォーム解説動画", "video", "blue", "tokuten_21.html"),
      item("28", "家トレで変わるロードマップ", "video", "blue", "tokuten_28.html"),
    ],
  },
  {
    label: "レシピ本",
    items: [
      item("09", "1週間和食献立レシピ本", "book", "gold", "tokuten_09.html"),
      item("10", "体脂肪が減る飲み物レシピ本", "book", "gold", "tokuten_10.html"),
      item("13", "痩せ体質を作る腸活レシピ本", "book", "gold", "tokuten_13.html"),
      item("14", "さつまいも＆ココアレシピ集", "book", "gold", "tokuten_14.html"),
      item("17", "超時短ズボラ簡単1週間レシピ", "book", "gold", "tokuten_17.html"),
    ],
  },
  {
    label: "食材・食品リスト",
    items: [
      item("08", "内臓脂肪・脂肪肝を改善する食べ物", "food", "orange", "tokuten_08.html"),
      item("15", "リンゴ酢の取扱説明書×神食材6選", "food", "orange", "tokuten_15.html"),
      item("16", "コンビニダイエット食材22選", "food", "orange", "tokuten_16.html"),
      item("18", "低脂質・たんぱく食品一覧表", "list", "purple", "tokuten_18.html"),
      item("27", "PFC別おすすめ食材一覧表", "list", "purple", "tokuten_27.html"),
    ],
  },
  {
    label: "読み物・マニュアル",
    items: [
      item("06", "ボディメイク論文レポート本", "book", "teal", "tokuten_06.html"),
      item("11", "カロリー計算法完全マニュアル", "book", "teal", "tokuten_11.html"),
      item("22", "ダイエット＆筋トレテク30選", "book", "teal", "tokuten_22.html"),
      item("29", "痩せるマインドセット本", "mind", "teal", "tokuten_29.html"),
      item(undefined, "炭水化物の取扱説明書", "book", "gold", "carb-guide.html"),
    ],
  },
  {
    label: "受講生の指導実例",
    items: [
      item("12", "受講生の食事指導内容公開", "book", "rose", "tokuten_12.html"),
      item("19", "受講生の筋トレ指導内容公開", "book", "rose", "tokuten_19.html"),
    ],
  },
];

export const WEBINAR_TOKUTEN: TokutenGroup[] = [
  {
    label: "ティアリスト",
    items: [
      item(undefined, "炭水化物ティアリスト", "tier", "gold", "tier_carb.html"),
      item(undefined, "脂質ティアリスト", "tier", "orange", "tier_fat.html"),
      item(undefined, "たんぱく質ティアリスト", "tier", "rose", "tier_protein.html"),
    ],
  },
  {
    label: "レシピ・その他",
    items: [
      item(undefined, "レシピ総集編", "book", "green", "recipes.html"),
      item(undefined, "家トレダンジョン", "home", "purple", "ietre.html"),
    ],
  },
];

export function countItems(groups: TokutenGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0);
}
