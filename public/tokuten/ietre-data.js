// 家トレダンジョン データ
// 元: norifitness.com/ietre/ の Vimeo iframe 82本を全て移植
// タイトルは元ページ本文から手動マッピング（v3）
// 880334419 = HIIT共通動画（Lv.1-6で再掲）
// 660354444 = ストレッチ共通動画（Lv.1-6で再掲）
const DUNGEON = {
  "meta": {
    "title": "家トレダンジョン",
    "subtitle": "〜嫌いを好きに変える180日のボディーメイク〜",
    "totalDays": 180,
    "totalLevels": 8
  },
  "cats": [
    {
      "key": "kintore",
      "icon": "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"2\" y1=\"12\" x2=\"4\" y2=\"12\"/><line x1=\"22\" y1=\"12\" x2=\"20\" y2=\"12\"/><rect x=\"5\" y=\"8\" width=\"2\" height=\"8\" rx=\"0.3\"/><rect x=\"17\" y=\"8\" width=\"2\" height=\"8\" rx=\"0.3\"/><rect x=\"8\" y=\"6\" width=\"2\" height=\"12\" rx=\"0.3\"/><rect x=\"14\" y=\"6\" width=\"2\" height=\"12\" rx=\"0.3\"/><line x1=\"10\" y1=\"12\" x2=\"14\" y2=\"12\"/></svg>",
      "name": "筋トレメニュー"
    },
    {
      "key": "stretch",
      "icon": "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"4.5\" r=\"2\"/><line x1=\"12\" y1=\"6.5\" x2=\"12\" y2=\"14\"/><line x1=\"6\" y1=\"13\" x2=\"18\" y2=\"13\"/><line x1=\"12\" y1=\"14\" x2=\"7\" y2=\"21\"/><line x1=\"12\" y1=\"14\" x2=\"17\" y2=\"21\"/></svg>",
      "name": "ストレッチ"
    },
    {
      "key": "hiit",
      "icon": "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 2 C 12 7 7 7 7 13 a 5 5 0 0 0 10 0 c 0 -2 -1 -3 -2 -4 0 2 -1 3 -2 3 0 -3 1 -5 -1 -10z\"/></svg>",
      "name": "週3HIIT"
    },
    {
      "key": "knowledge",
      "icon": "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4\" y=\"4\" width=\"7\" height=\"16\" rx=\"0.5\"/><rect x=\"13\" y=\"4\" width=\"7\" height=\"16\" rx=\"0.5\"/><line x1=\"4\" y1=\"8\" x2=\"11\" y2=\"8\"/><line x1=\"13\" y1=\"8\" x2=\"20\" y2=\"8\"/></svg>",
      "name": "筋トレ知識講座"
    },
    {
      "key": "diet",
      "icon": "<svg class=\"ic\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 13 a 8 8 0 0 1 16 0 z\"/><line x1=\"4\" y1=\"13\" x2=\"20\" y2=\"13\"/><circle cx=\"9\" cy=\"10\" r=\"1\"/><circle cx=\"14\" cy=\"9\" r=\"1\"/></svg>",
      "name": "栄養学講座"
    }
  ],
  "levels": [
    {
      "lv": 1,
      "period": "1〜2週間目",
      "label": "基礎を整える",
      "summary": "自重トレ＋1ヵ月目知識講座（核理論〜フォーム）＋食事法・1週間レシピ。",
      "mission": "ダンジョン入口。動きの「型」と「食事の枠」を作る。",
      "reward": "フォームの基本／食事の基準が身につく",
      "equipment": "なし（自重のみ）",
      "videos": {
        "kintore": [
          {
            "vimeo": "660353230",
            "title": "全身を鍛える自重筋トレメニュー"
          },
          {
            "vimeo": "738482154",
            "title": "脚トレ追加メニュー"
          }
        ],
        "stretch": [
          {
            "vimeo": "660354444",
            "title": "全身のストレッチメニュー"
          }
        ],
        "hiit": [
          {
            "vimeo": "880334419",
            "title": "週3回HIIT動画"
          }
        ],
        "knowledge": [
          {
            "vimeo": "880035784",
            "title": "筋トレの核！筋肥大の最新理論！総負荷量についての考え方"
          },
          {
            "vimeo": "880040732",
            "title": "筋トレをして筋肉がつくまでの時間"
          },
          {
            "vimeo": "880040574",
            "title": "筋肉痛と筋肥大には関係がなく、追い込まなくても筋肥大する科学的根拠"
          },
          {
            "vimeo": "714671334",
            "title": "対象筋を意識することの重要性"
          },
          {
            "vimeo": "714671020",
            "title": "可動域が広い方がいい理由"
          },
          {
            "vimeo": "714706044",
            "title": "適切なウォームアップ方法"
          },
          {
            "vimeo": "714706358",
            "title": "動作時間の最適な秒数について（ゆるトレ注意）"
          },
          {
            "vimeo": "660390375",
            "title": "腕立て伏せ＆フロアショルダープレス解説"
          },
          {
            "vimeo": "660546048",
            "title": "スクワット＆ランジの基本動作"
          },
          {
            "vimeo": "880040317",
            "title": "ブルガリアンスクワットの重要性とフォーム解説"
          }
        ],
        "diet": [
          {
            "vimeo": "660357706",
            "title": "食事法完全攻略"
          },
          {
            "vimeo": "660608111",
            "title": "最強の1週間のレシピ"
          },
          {
            "vimeo": "880041503",
            "title": "作り置きカレーレシピ"
          }
        ]
      }
    },
    {
      "lv": 2,
      "period": "2〜4週間目",
      "label": "動きを増やす",
      "summary": "逆手腕立て・ランジ追加。2ヵ月目知識（教科書動画）。",
      "mission": "体に「新しい刺激」を入れて、慣れを防ぐ。",
      "reward": "可動域が広がる・運動が楽しくなる",
      "equipment": "なし（自重のみ）",
      "videos": {
        "kintore": [
          {
            "vimeo": "660353679",
            "title": "全身を鍛える自重筋トレメニュー（逆手腕立て＋ランジ追加）"
          }
        ],
        "stretch": [
          {
            "vimeo": "660354444",
            "title": "全身のストレッチメニュー"
          }
        ],
        "hiit": [
          {
            "vimeo": "880334419",
            "title": "週3回HIIT動画"
          }
        ],
        "knowledge": [
          {
            "vimeo": "660537852",
            "title": "筋トレ１年目の教科書動画"
          },
          {
            "vimeo": "660546343",
            "title": "フォームの見直し（逆手腕立て伏せ解説）"
          }
        ],
        "diet": [
          {
            "vimeo": "718960582",
            "title": "痩せながら筋肉をつける方法完全攻略"
          },
          {
            "vimeo": "867863376",
            "title": "タンパク質の摂取方法や量について完全解説"
          }
        ]
      }
    },
    {
      "lv": 3,
      "period": "1〜2ヶ月目",
      "label": "フォームを磨く",
      "summary": "総負荷量UP。3ヵ月目は解剖学6本（肩/胸/腕/背中/脚/腹筋）。",
      "mission": "「なんとなく」から「狙って効かせる」へ。",
      "reward": "同じ種目で効きが変わる感覚を得る",
      "equipment": "なし（自重のみ）",
      "videos": {
        "kintore": [
          {
            "vimeo": "660548110",
            "title": "全身を鍛える自重筋トレメニュー（20分・総負荷量UP）"
          }
        ],
        "stretch": [
          {
            "vimeo": "660354444",
            "title": "全身のストレッチメニュー"
          }
        ],
        "hiit": [
          {
            "vimeo": "880334419",
            "title": "週3回HIIT動画"
          }
        ],
        "knowledge": [
          {
            "vimeo": "660553918",
            "title": "肩の解剖学"
          },
          {
            "vimeo": "660554036",
            "title": "胸の解剖学"
          },
          {
            "vimeo": "660554963",
            "title": "腕の解剖学"
          },
          {
            "vimeo": "660591180",
            "title": "背中の解剖学"
          },
          {
            "vimeo": "792942345",
            "title": "脚の解剖学"
          },
          {
            "vimeo": "714902063",
            "title": "腹筋の解剖学"
          }
        ],
        "diet": [
          {
            "vimeo": "664111219",
            "title": "デブから細マッチョ完全攻略"
          },
          {
            "vimeo": "880046617",
            "title": "栄養学完全マスター！痩せる食べ物TOP50"
          }
        ]
      }
    },
    {
      "lv": 4,
      "period": "2〜3ヶ月目",
      "label": "装備を整える",
      "summary": "ダンベル導入。プッシュバー・ホームジム器具解説。",
      "mission": "自重の限界を、最小コストで突破する。",
      "reward": "伸び悩みを抜け、追い込みの幅が広がる",
      "equipment": "ダンベル（可変式推奨）／プッシュアップバー",
      "videos": {
        "kintore": [
          {
            "vimeo": "660354000",
            "title": "レベル4 ダンベル導入オープニング"
          }
        ],
        "stretch": [
          {
            "vimeo": "660354444",
            "title": "全身のストレッチメニュー"
          }
        ],
        "hiit": [
          {
            "vimeo": "880334419",
            "title": "週3回HIIT動画"
          }
        ],
        "knowledge": [
          {
            "vimeo": "880335859",
            "title": "プッシュアップバーの解説動画"
          },
          {
            "vimeo": "880104656",
            "title": "ホームジム器具の解説（補足）"
          },
          {
            "vimeo": "660596470",
            "title": "ホームジムだけで変えた2年で筋肉をつけた方法"
          },
          {
            "vimeo": "660597975",
            "title": "フォームの見直し 肩の種目の解説"
          },
          {
            "vimeo": "660609201",
            "title": "腕の種目の解説"
          }
        ],
        "diet": [
          {
            "vimeo": "880333261",
            "title": "実は意味ない？チートデイの正しいやり方と停滞を抜ける方法"
          },
          {
            "vimeo": "880333852",
            "title": "お腹の内臓脂肪が落ちない最大の原因6選"
          },
          {
            "vimeo": "880335925",
            "title": "最短最速でぽっこりお腹を落とす方法6選"
          },
          {
            "vimeo": "660558624",
            "title": "炭水化物ばかり食べても体脂肪を増やさず痩せられる方法6選"
          }
        ]
      }
    },
    {
      "lv": 5,
      "period": "3〜4ヶ月目",
      "label": "上半身を強くする",
      "summary": "懸垂機導入。3日分のダンベルメニュー＋懸垂フォーム＋食欲コントロール4章。",
      "mission": "「引く力」を覚えて、上半身を一段上へ。",
      "reward": "逆三角形の土台ができる",
      "equipment": "ダンベル＋懸垂機",
      "videos": {
        "kintore": [
          {
            "vimeo": "660593921",
            "title": "全身を鍛えるダンベル＆懸垂機筋トレメニュー"
          },
          {
            "vimeo": "660559972",
            "title": "1日目のメニュー（ダンベルのみ）"
          },
          {
            "vimeo": "660560508",
            "title": "2日目のメニュー（ダンベルのみ）"
          },
          {
            "vimeo": "660560923",
            "title": "3日目のメニュー（ダンベルのみ）"
          }
        ],
        "stretch": [
          {
            "vimeo": "660354444",
            "title": "全身のストレッチメニュー"
          }
        ],
        "hiit": [
          {
            "vimeo": "880334419",
            "title": "週3回HIIT動画"
          }
        ],
        "knowledge": [
          {
            "vimeo": "880332671",
            "title": "無駄にしない！プロテインの飲み方完全攻略"
          },
          {
            "vimeo": "845590598",
            "title": "フォームの見直し：懸垂のやり方（0から1回）"
          },
          {
            "vimeo": "798334495",
            "title": "懸垂1～10回"
          },
          {
            "vimeo": "660801263",
            "title": "ディップスのやり方"
          }
        ],
        "diet": [
          {
            "vimeo": "802382206",
            "title": "食欲をコントロールする方法完全攻略（第一章）"
          },
          {
            "vimeo": "804264887",
            "title": "食欲をコントロールする方法完全攻略（第二章）"
          },
          {
            "vimeo": "804265368",
            "title": "食欲をコントロールする方法完全攻略（第三章）"
          },
          {
            "vimeo": "809270773",
            "title": "食欲をコントロールする方法完全攻略（第四章）"
          },
          {
            "vimeo": "860808510",
            "title": "痩せ菌を増やしてデブ菌を減らし痩せ体質を作る方法（前編）"
          },
          {
            "vimeo": "860808642",
            "title": "痩せ菌を増やしてデブ菌を減らし痩せ体質を作る方法（後編）"
          }
        ]
      }
    },
    {
      "lv": 6,
      "period": "4〜5ヶ月目",
      "label": "強度を組み立てる",
      "summary": "懸垂機＆ダンベルで重量UP。6ヵ月目知識（有酸素・血流制限）。",
      "mission": "「重さ × 回数」を計画的に伸ばす。",
      "reward": "自分の限界が伸びていく実感",
      "equipment": "ダンベル＋懸垂機",
      "videos": {
        "kintore": [
          {
            "vimeo": "660558624",
            "title": "全身を鍛える懸垂機＆ダンベル筋トレメニュー（重量UP）"
          },
          {
            "vimeo": "660559972",
            "title": "1日目のメニュー（重量UP）"
          },
          {
            "vimeo": "660560508",
            "title": "2日目のメニュー（重量UP）"
          },
          {
            "vimeo": "660560923",
            "title": "3日目のメニュー（重量UP）"
          }
        ],
        "stretch": [
          {
            "vimeo": "660354444",
            "title": "全身のストレッチメニュー"
          }
        ],
        "hiit": [
          {
            "vimeo": "880334419",
            "title": "週3回HIIT動画"
          }
        ],
        "knowledge": [
          {
            "vimeo": "880336246",
            "title": "実は意味ない筋トレ全まとめ【完全版】"
          },
          {
            "vimeo": "880335969",
            "title": "最も効率のいい有酸素運動のやり方"
          },
          {
            "vimeo": "880335782",
            "title": "血流制限トレーニングについて"
          }
        ],
        "diet": [
          {
            "vimeo": "880339156",
            "title": "明確なダイエットや減量の期間選定と計画の立て方"
          },
          {
            "vimeo": "880340441",
            "title": "史上最も効率的に体脂肪を落とす方法9選"
          },
          {
            "vimeo": "880340598",
            "title": "体脂肪率25%→10%まで筋肉を残して痩せる最短ルート"
          }
        ]
      }
    },
    {
      "lv": 7,
      "period": "5〜6ヶ月目",
      "label": "自分で組めるようになる",
      "summary": "分割法へ。胸/脚/腕/肩/腹/背中の6日分割ルーティン。",
      "mission": "「教わる」から「自分で設計する」へ。",
      "reward": "一生使える自己管理スキル",
      "equipment": "ダンベル＋懸垂機",
      "videos": {
        "kintore": [
          {
            "vimeo": "880117576",
            "title": "1日目 胸トレ"
          },
          {
            "vimeo": "880117819",
            "title": "2日目 脚トレ"
          },
          {
            "vimeo": "880118243",
            "title": "3日目 腕トレ"
          },
          {
            "vimeo": "880117945",
            "title": "4日目 肩トレ"
          },
          {
            "vimeo": "880118182",
            "title": "5日目 腹筋トレ"
          },
          {
            "vimeo": "880118045",
            "title": "6日目 背中トレ"
          }
        ],
        "stretch": [],
        "hiit": [],
        "knowledge": [],
        "diet": []
      }
    },
    {
      "lv": 10,
      "period": "中級者向け",
      "label": "更なる高みへ",
      "summary": "BIG3完全解説。スクワット・ベンチ・デッドリフトを極める。",
      "mission": "中級者の壁を、知識で突破する。",
      "reward": "体・知識・自由度すべてが手に入る",
      "equipment": "ダンベル＋懸垂機（＋BIG3用設備）",
      "videos": {
        "kintore": [
          {
            "vimeo": "714704390",
            "title": "BIG3完全解説"
          }
        ],
        "stretch": [],
        "hiit": [],
        "knowledge": [],
        "diet": []
      }
    }
  ]
};
