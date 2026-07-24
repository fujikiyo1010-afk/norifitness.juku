/**
 * 自重種目の判定(2026-07-24・きよむ確認済み)。
 * ここに載る＝「自重」= セット表で kg 入力不可(自重固定)・総ボリューム除外。
 * 載らない＝「重量入力可」(器具50種＋どちらもあり得る8種)。
 *
 * 現状の全メニュー84種のうち、下記ルールで自重と判定されるのは確定した26種:
 *   腕立て伏せ/膝つき/逆手/壁付/エルボープッシュアップ(各バリエ・ダンベル置いて含む)/ディップス/懸垂/
 *   クランチ/バイシクルクランチ/レッグレイズ(脚曲げ・ベンチ・椅子)/ニートゥーエルボー/アブローラー/HIIT/ストレッチ
 * 「どちらもあり得る8種(スクワット/バックランジ/ブルガリアン/カーフレイズ/インクラインベンチ/
 *   ワンダーコアー/リバーススノーエンジェル/脚パカ)」は自重にしない = kg入力可。
 *
 * 編集方法:
 *   - 「これも自重に」= FORCE_BODYWEIGHT に名前を足す。
 *   - 「これは自重じゃない」= FORCE_WEIGHTED に名前を足す(器具キーワードが無い自重系を器具扱いにする時)。
 *   - 表記ゆれは cleanExerciseName で正規化してから照合するので両表記OK。
 */
import { cleanExerciseName } from "@/lib/workout/menu-display";

// 器具・重量を使う手がかり(これが名前にあれば自重ではない)
const GEAR = [
  "ダンベル", "バーベル", "ケーブル", "マシン", "マシーン", "スミス", "EZ", "プレート",
  "ケトルベル", "チューブ", "バンド", "ペットボトル", "ラットプル", "レッグプレス",
  "レッグエクステンション", "レッグカール", "チェストプレス", "ペックフライ", "ペクトラルフライ",
  "シーデット", "シーテッド", "ロープ", "プレスダウン",
];
// 自重の手がかり(器具が無ければ自重)
const BODY = [
  "腕立て", "プッシュアップ", "ディップス", "懸垂", "チンニング", "プランク", "クランチ",
  "シットアップ", "レッグレイズ", "バックエクステンション", "ヒップリフト", "ブリッジ",
  "バーピー", "マウンテンクライマー", "ニートゥー", "アブローラー", "HIIT", "ストレッチ",
];

// 個別上書き(cleanExerciseName 後の名前で指定)
const FORCE_BODYWEIGHT: string[] = [];
const FORCE_WEIGHTED: string[] = [];

/** 種目名 → 自重か(kg入力不可にするか)。表記ゆれは正規化して吸収。 */
export function isBodyweight(rawName: string | null | undefined): boolean {
  if (!rawName) return false;
  const n = cleanExerciseName(rawName);
  if (FORCE_WEIGHTED.includes(n)) return false;
  if (FORCE_BODYWEIGHT.includes(n)) return true;
  // 腕立て/プッシュアップは「ダンベル置いて」でもダンベルは握り台=自重
  if (n.includes("腕立て") || n.includes("プッシュアップ")) return true;
  if (GEAR.some((k) => n.includes(k))) return false;
  if (BODY.some((k) => n.includes(k))) return true;
  return false; // 器具系・どちらもあり得る・不明 = kg入力可
}
