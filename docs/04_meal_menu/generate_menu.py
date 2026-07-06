import json,re
data=json.load(open('yoko_out.json'))
CSS=re.search(r'<style>.*?</style>', open('/Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/04_meal_menu/template_資料版.html').read(), re.S).group(0)
def disp(n,g):
    n2={'鶏むね(皮なし)':'鶏むね','もち麦飯':'もち麦ごはん','そば(ゆで)':'そば','うどん(ゆで)':'うどん','無脂肪ギリシャヨーグルト':'無脂肪ヨーグルト','わかめ(戻し)':'わかめ','オートミール(乾)':'オートミール','木綿豆腐':'豆腐','プロテイン(WPC)':'プロテイン'}.get(n,n)
    if n=='全卵': return f'卵{int(round(g/50))}個'
    if n=='納豆': return f'納豆{int(round(g/45))}P'
    return f'{n2}{g:g}g'
def ing(items):
    t='・'.join(disp(n,g) for n,g in items)
    return t.replace('味噌15g・わかめ20g','味噌汁')
DISH={
'月':{'朝':('もち麦ごはんの納豆卵定食',['もち麦ごはんに納豆をのせる。卵はスクランブルか目玉焼き。','味噌汁（インスタントでOK）を添える。']),
     '昼':('鶏むねの夏野菜カレー',['作り置きカレーを温め、玉ねぎ・なす・ピーマン・トマトを加える。','もち麦ごはんにかけ、味噌汁を添える。']),
     '夜':('豚ヒレステーキ アボカド添え',['豚ヒレを両面こんがり焼く。ほうれん草はお浸し。','アボカドと盛り、もち麦ごはん・味噌汁を添える。']),
     '間食':('プロテイン＆アーモンド',['プロテインをシェイク、アーモンド・バナナと。'])},
'火':{'朝':('もち麦ごはんの納豆卵定食',['もち麦ごはんに納豆と卵。味噌汁を添える。','きなこは飲み物やヨーグルトに混ぜても。']),
     '昼':('鶏むねの温そば',['そばを温め、焼いた鶏むねをのせる。','しめじ・ほうれん草を添える。']),
     '夜':('鮭の塩焼き定食（もち麦・味噌汁）',['鮭を塩で焼く。ブロッコリーはレンチン。','もち麦ごはん・味噌汁・アボカドと盛る。']),
     '間食':('ギリシャヨーグルト＆ナッツ',['ヨーグルトにプロテインを混ぜ、アーモンドと。'])},
'水':{'朝':('ベリーヨーグルトオーツ',['ヨーグルトにオートミールを混ぜ5分。','プロテイン・きなこを混ぜ、バナナをのせる。']),
     '昼':('鶏むねの夏野菜カレー',['作り置きカレー＋夏野菜を温め、もち麦ごはんへ。','味噌汁を添える。']),
     '夜':('サバ缶と納豆のもち麦ごはん',['サバ水煮缶をもち麦ごはんにのせる。','納豆・ブロッコリー・アボカド・味噌汁を添える。']),
     '間食':('プロテイン＆アーモンド',['プロテインをシェイク、アーモンド・バナナと。'])},
'木':{'朝':('もち麦ごはんの納豆卵定食',['もち麦ごはんに納豆と卵。味噌汁を添える。']),
     '昼':('鶏むねのぶっかけうどん',['うどんに焼いた鶏むねをのせる。','しめじ・ほうれん草を添える。']),
     '夜':('鮭の塩焼き定食（もち麦・味噌汁）',['鮭を焼く。ほうれん草はお浸し。','もち麦ごはん・味噌汁・アボカドと盛る。']),
     '間食':('ヨーグルト＆さつまいも',['ヨーグルトにプロテイン・アーモンド。蒸しさつまいもと。'])},
'金':{'朝':('オーツのプロテインがゆ',['オートミール＋水100mlを600Wで1分半。','プロテイン・きなこ・ヨーグルト・バナナを混ぜる。']),
     '昼':('鶏むねの夏野菜カレー',['作り置きカレー＋夏野菜を温め、もち麦ごはんへ。','味噌汁を添える。']),
     '夜':('豚ヒレステーキ',['豚ヒレを焼き、目玉焼きを作る。','アボカド・キャベツと盛り、もち麦ごはん・味噌汁を添える。']),
     '間食':('プロテイン＆アーモンド',['プロテインをシェイク、アーモンド・バナナと。'])},
'土':{'朝':('もち麦ごはんの納豆卵定食',['もち麦ごはんに納豆と卵2個。味噌汁を添える。']),
     '昼':('鶏むねともち麦の定食',['鶏むねを焼き、もち麦ごはんと。','しめじ・ほうれん草・味噌汁を添える。']),
     '夜':('鮭と豆腐のもち麦定食',['鮭を焼く。冷奴・ブロッコリーを添える。','もち麦ごはん・味噌汁・アボカドと。']),
     '間食':('ギリシャヨーグルト＆ナッツ',['ヨーグルトにプロテインを混ぜ、アーモンドと。'])},
'日':{'朝':('バナナヨーグルトオーツ',['ヨーグルトにオートミールを混ぜ5分。','バナナ・きなこ・プロテインを混ぜる。']),
     '昼':('鶏むねと卵のもち麦ボウル',['ほうれん草をソテー、温泉卵を作る。','もち麦ごはんに焼き鶏むね・ほうれん草・温玉、味噌汁。']),
     '夜':('サバ缶と納豆のもち麦ごはん',['サバ水煮缶をもち麦ごはんにのせる。','納豆・キャベツ・アボカド・味噌汁を添える。']),
     '間食':('プロテイン＆アーモンド',['プロテインをシェイク、アーモンド・バナナと。'])},
}
order=['月','火','水','木','金','土','日']
def daypage(d):
    dd=data[d]; per=dd['per']; tot=dd['tot']; meals=''
    for mm in ['朝','昼','夜','間食']:
        name,steps=DISH[d][mm]; k,p,f,c=per[mm]
        items=[(x[0],x[1]) for x in dd['meals'][mm]]
        tagcls='tag snack' if mm=='間食' else 'tag'
        ol=''.join(f'<li>{s}</li>' for s in steps)
        meals+=f'''<div class="meal"><div class="top"><span class="{tagcls}">{mm}</span><span class="name">{name}</span><span class="chip">{k:.0f}kcal ・ P{p:.0f}/F{f:.0f}/C{c:.0f}</span></div>
<div class="ing"><b>材料</b>：{ing(items)}</div><ol>{ol}</ol></div>'''
    tk,tp,tf,tc,tb=tot
    note='<div class="ing" style="text-align:center;color:#6a6256;border-top:1px dashed #d8cdba;padding-top:8px">昼と夜に <b>りんご酢</b>を1杯ずつ（炭酸水や水で割って）　／　ごはんは <b>もち麦</b>・<b>味噌汁</b>つき（発酵：納豆・味噌・ヨーグルト）</div>'
    return f'''<div class="page"><div class="dayhdr"><div style="display:flex;align-items:baseline"><span class="day">{d}曜</span><span class="lv">均一</span></div>
<div class="daytot"><div class="goal">目標：約2,000kcal ／ P<b>166</b>・F<b>56</b>・C<b>209</b></div><div class="k">{tk:.0f} <span>kcal</span></div><div class="m">P <b>{tp:.0f}</b>・F <b>{tf:.0f}</b>・C <b>{tc:.0f}</b>　／　食物繊維 <b>{tb:.0f}g</b></div></div></div>
{meals}{note}</div>'''
cover=f'''<div class="page"><div class="cvtitle">横下さんの1週間メニュー</div>
<div class="cvsub">のりfitness監修のもと、のりfitness AI とともに <b>動画455本・論文308本</b> を読み込み、一食ずつ組み上げました。過去動画内のレシピを参考の軸にとらえ、専用メニューに仕上げました。参考にしてください。</div>
<div class="cvbox"><h3>あなたの条件</h3><div class="cvrow">
<b style="color:#6a6256;font-size:13px">からだ・目標</b>　男性39歳／178cm／現在 <b>81.3kg</b>・体脂肪26.2%・ウエスト94.1cm → 目標 <b>70.0kg</b>（2027年始まで）<br>
<b style="color:#6a6256;font-size:13px">運動</b>　家トレ（ダンベル中心）毎日コツコツ・重点 全身・経験 たまに<br>
<b style="color:#6a6256;font-size:13px">目的</b>　ダイエット・見た目改善・筋肉増／細マッチョ／正しい知識で自分で管理<br>
<b style="color:#6a6256;font-size:13px">食べないもの</b>　アレルギーなし／嫌い＝漬物類全般（キムチ・漬物は不使用）<br>
<b style="color:#6a6256;font-size:13px">好きなもの</b>　麺類・カレー<br>
<b style="color:#6a6256;font-size:13px">作り方・生活</b>　自炊 週数回（週末作り置きOK）／1食15分／予算こだわらない／1日3食／間食あり／お酒 週1〜2回<br>
<b style="color:#6a6256;font-size:13px">やる気</b>　しっかり取り組める</div></div>
<div class="cvbox"><h3>1日の目標と方針</h3><div class="goalbig">エネルギー <b>約2,000kcal</b><br>たんぱく質 <b>166g</b>・脂質 <b>56g</b>・糖質 <b>209g</b>（のり監修）</div>
<div class="cvrow">毎日ほぼ均一で続けやすく／ごはんは <b>もち麦</b>・<b>味噌汁</b>つき／<b>魚は週5回</b>／好物の <b>カレー3日・麺2日</b>。<br>発酵は <b>納豆・味噌・ヨーグルト</b> で。漬物が苦手なぶん、<b>昼と夜にりんご酢</b>を1杯ずつ（血糖・食欲対策）。食物繊維は毎日 <b>20g以上</b>。</div></div>
<div class="note">※本メニューはあくまで参考です。持病・服薬がある方の食事調整は、必ず医師の判断に従ってください。本サービスは医療行為・診断を行うものではありません。　数値は日本食品標準成分表（八訂）準拠で計算。</div></div>'''
prep='''<div class="page"><div class="sech">まず作る「作り置き」</div><div class="secsub">週末に仕込むと、平日15分で回せます。</div>
<div class="prep"><h3>A. 鶏むねチャーシュー（むね1.2kg分）</h3><div class="ing"><b>材料</b>：鶏むね1.2kg／しょうゆ大3／酒大3／おろし生姜・にんにく 各小2／黒こしょう少々</div>
<ol><li>むね肉をフォークで刺し、厚い所は開く。</li><li>調味料と袋でもみ30分。沸騰湯を止めて袋ごと沈め余熱40〜45分。</li><li>薄切りで1食150〜200gに小分け（冷蔵3日／冷凍2週）。</li></ol></div>
<div class="prep"><h3>B. 低脂質スパイスカレー（5食分・週3回登場）</h3><div class="ing"><b>材料</b>：鶏むね600g／玉ねぎ2／なす2／ピーマン2／トマト缶1／クミン・コリアンダー・ターメリック 各小2／塩小1</div>
<ol><li>具材を一口大に。玉ねぎを炒めスパイスを立てる。</li><li>鶏・野菜・トマト缶・水200mlで15分煮て、1食ずつ冷凍。もち麦ごはんにかけて。</li></ol></div></div>'''
html=f'''<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800;900&family=Inter:wght@600;700;800;900&display=swap" rel="stylesheet">{CSS}</head><body>
{cover}{prep}{''.join(daypage(d) for d in order)}</body></html>'''
open('yoko_menu.html','w').write(html)
# 給食版
CSS2=re.search(r'<style>.*?</style>', open('/Users/f.kiyomu/Desktop/norifitness/06_kinniku_juku_app/docs/04_meal_menu/template_給食版.html').read(), re.S).group(0)
def cell(d,mm):
    name=DISH[d][mm][0]; k=data[d]['per'][mm][0]
    return f'<td class="cell"><div class="dish">{name}</div><div class="kc">{k:.0f} kcal</div></td>'
rows=''
for mm in ['朝','昼','夜','間食']:
    rows+=f'<tr><td class="rowlbl">{mm}</td>'+''.join(cell(d,mm) for d in order)+'</tr>'
nutri='<tr class="nutri"><td class="rowlbl" style="background:var(--grnd)">栄養</td>'
for d in order:
    tk,tp,tf,tc,tb=data[d]['tot']
    nutri+=f'<td><div class="kcal">{tk:.0f}</div><div class="pfc">P{tp:.0f} F{tf:.0f} C{tc:.0f} ／ 繊{tb:.0f}</div></td>'
nutri+='</tr>'
th=''.join(f'<th class="day">{d}<span class="lv">均一</span></th>' for d in order)
k2=f'''<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&family=Inter:wght@600;700;800&display=swap" rel="stylesheet">{CSS2}</head><body>
<div class="page"><div class="hd"><div class="ttl">横下さんの1週間 献立表<small>のりfitness監修 × のりfitness AI ／ 動画455本・論文308本から</small></div>
<div class="goal">1日の目標　エネルギー <b>約2,000kcal</b><br>P <b>166g</b>・F <b>56g</b>・C <b>209g</b>（毎日均一）</div></div>
<table><tr><th class="corner"></th>{th}</tr>{rows}{nutri}</table>
<div class="foot">ごはんはもち麦・味噌汁つき／魚は週5回／カレー3日・麺2日。発酵は納豆・味噌・ヨーグルト、昼と夜にりんご酢1杯ずつ（漬物が苦手なぶんを補う）。<br>※本メニューは参考です。持病・服薬がある方は医師の判断を優先してください。数値は日本食品標準成分表（八訂）準拠。</div></div></body></html>'''
open('yoko_kyushoku.html','w').write(k2)
print('HTML出力OK')
