// Stage 2 「珪晶の谷」 — all story text.
// Theme for the whole game: 「118の違いを、一つにするのではなく、必要な時につなぐ」.
// Stage 2's step: BOND makes you strong → BREAK opens the way. Carbon stays shy (mask with C / 6).
// Silica: logical, loves observing, careful, a little argumentative.
import type { Line, Speaker } from './script';

const L = (who: Speaker, text: string): Line => ({ who, text });

export const SCRIPT2: Record<string, Line[]> = {
  s2_intro: [
    L('sys', '水が戻ったカーボ村。井戸にも、畑にも、少しずつ元気が戻ってきた。'),
    L('sys', 'ある朝、川で見たことのない結晶のかけらが見つかった。'),
    L('sys', '川をさかのぼった先には、THE BREAK以来だれも近づいていない谷がある――「珪晶の谷」。'),
  ],
  s2_researcher: [
    L('researcher', 'おお、来たか。見てくれ、このかけら。川の上流から流れてきたんだ。'),
    L('researcher', 'ガラスみたいに透き通っているのに、ずっと硬い。上流の「珪晶の谷」のものにちがいない。'),
    L('carbon_shy', '（……しゃべるの、まだちょっと緊張する）'),
    L('carbon', '……見に、行ってきます。'),
    L('researcher', '谷の奥には古代の研究所があったと聞く。気をつけてな。'),
  ],
  s2_researcher_repeat: [L('researcher', '谷の結晶は、ふつうの岩よりずっと硬い。むりに叩いても、手が痛くなるだけだぞ。')],
  s2_monument: [
    L('sys', '元素碑だ。ふれると体力が回復し、記録（セーブ）される。'),
    L('sys', 'ここでは、いっしょに行く仲間（最大2人）を入れかえられる。'),
  ],
  s2_rockwall_first: [
    L('carbon', '（……大きな岩が道をふさいでる）'),
    L('hyde', 'うわ、でっか！ 押してもびくともしないよ。'),
    L('oxy', '燃やすのもムリね。これ、ただの岩じゃない。結晶がぎっしり詰まってる。'),
    L('carbon_shy', '（別の道……さがそう）'),
  ],
  s2_rockwall_hit: [L('sys', 'カキン！　硬すぎて、びくともしない。')],
  s2_east_hint: [L('sys', '東の崖ぞいに、細い道が続いている。')],
  s2_silica_meet: [
    L('silica', '……動かないで。その足元、結晶の層が薄い。'),
    L('carbon', '（だ、だれ……？）'),
    L('silica', 'ぼくはシリカ。この谷の結晶を観察してる。……キミのお面、「C」と「6」。炭素か。'),
    L('silica', '炭素は結合の手が4本。……ぼくと同じだ。'),
    L('carbon_shy', '……お、同じ……？'),
    L('silica', '周期表では、ぼくはキミのすぐ下にいる。性質が似ているのは、理屈の上では当然だね。'),
  ],
  s2_silica_join: [
    L('silica', 'あの岩壁を越えたいんだろう？ ぼくも奥に用がある。……しばらく、いっしょに行こう。'),
    L('silica', 'ただし、ぼく一人じゃあの岩壁は壊せない。何度も試した。データは取ってある。'),
  ],
  s2_party_full: [
    L('silica', '……3人以上でぞろぞろ歩くと、足場が持たない。この谷では、同行は2人までにしよう。'),
    L('sys', 'シリカといっしょに行く仲間を、もう1人えらんでください。えらばなかった仲間は元素碑で待っています。'),
  ],
  s2_silica_try: [
    L('silica', '……ふっ！'),
    L('sys', 'カキン！'),
    L('silica', '……やっぱりだめか。ケイ素だけでは硬さが足りない。'),
    L('silica', '東の古代研究所に、何か記録が残っているかもしれない。行ってみよう。'),
  ],
  s2_lab_record: [
    L('record', '……記録番号14-06。谷の結晶層は、通常の元素の力では破砕不能。'),
    L('record', 'ただし、ケイ素（Si）と炭素（C）が結合した物質は、ダイヤモンドに近い硬さを示す。'),
    L('record', '式：　C ＋ Si'),
    L('record', '……以降、記録が途切れている。'),
    L('silica', 'C ＋ Si。……炭素と、ケイ素。'),
    L('silica', '……つまり、キミと、ぼくだ。'),
    L('carbon_shy', '（ぼくと……シリカが、BOND……？）'),
    L('sys', 'BONDボタン →「仲間とBOND」で、カーボンと仲間を選んでBONDできるようになった。'),
  ],
  s2_lab_record_repeat: [L('record', '式：　C ＋ Si　……記録はここで途切れている。')],
  s2_unknown_device: [
    L('sys', 'UNKNOWN PROPERTY'),
    L('sys', '古代の装置だ。……ぴくりとも動かない。銅色の端子が2つ、何かが流れてくるのを待っているように見える。'),
    L('silica', '今のぼくたちが持っていない「性質」が必要みたいだ。マップに印をつけておこう。'),
    L('sys', 'マップに「？」を記録した。新しい元素を見つけたら、また来てみよう。'),
  ],
  s2_unknown_device_again: [L('sys', 'UNKNOWN PROPERTY　――まだ動かせない。（マップに「？」の印がある）')],
  s2_form_wrong: [L('sys', 'この組み合わせで起きることは、まだわからない。')],
  s2_after_sic: [
    L('silica', '……すごい。体の奥まで、硬さが通っている感じだ。'),
    L('carbon', '……これなら、あの岩も。'),
    L('sys', 'SiC FORM：攻撃が HARD BREAK になり、硬い岩をこわせる。HEAT RESIST で熱い地帯も進める。'),
    L('sys', 'FORMボタン（キーボードは F）で BREAK すると、カーボンとシリカに戻る。'),
  ],
  s2_rockwall_break: [
    L('silica', '……割れた。理論どおりだ。'),
    L('hyde', 'すっげー！ BONDすると、こんなに強くなるんだ！'),
  ],
  s2_heat_first: [
    L('sys', 'あつい！　地面の割れ目から熱がふき出している。'),
    L('silica', 'このままでは進めない。……でも、SiC FORMなら耐えられるかもしれない。'),
  ],
  s2_heat_ok: [
    L('silica', '熱に強い……SiCの性質をまねた力だね。'),
    L('silica', '……念のため言っておくけど、本物の人間がSiCになって熱い所を歩けるわけじゃない。これは、ぼくたちの世界のBONDの力だ。'),
  ],
  s2_crevice_block: [
    L('sys', '岩の裂け目が細すぎて、SiC FORMでは通れない。'),
    L('carbon', '（……せっかく強くなったのに）'),
    L('silica', '……カーボン。BREAKしよう。'),
    L('carbon_shy', '……え？'),
    L('silica', '強くなるだけが、BONDじゃない。'),
    L('silica', '離れた方がいい時もある。'),
    L('sys', 'FORMボタン（F）で BREAK しよう。'),
  ],
  s2_after_break_first: [
    L('silica', 'うん、こっちのほうが身軽だ。'),
    L('sys', 'BREAKすると、カーボンとシリカは別々に動ける。「交代」ボタン（キーボードは Q）で、動かすキャラを切りかえよう。'),
    L('sys', 'もう一度BONDするときは、2人が近くにいるときに「C＋Si」ボタン（キーボードは F）。'),
  ],
  s2_plates_hint: [
    L('silica', 'スイッチが2つ。……同時に押さないと、扉は開かない仕組みだ。'),
    L('silica', '一つになっていたら、絶対に押せないね。'),
  ],
  s2_door_open: [L('sys', 'ガコン――扉が開いた。')],
  s2_need_together: [L('sys', 'BONDするには、カーボンとシリカが近くにいる必要がある。')],
  s2_cant_form_here: [L('sys', 'ここでは FORM を変えられない。')],
  s2_sic_no_switch: [L('silica', '……一つの体じゃ、2つのスイッチは同時に押せない。')],
  s2_hot_damage: [L('sys', 'あつい！　SiC FORMでないと、熱い地帯は進めない。')],
  s2_hard_enemy: [L('sys', 'カキン！　結晶の殻がかたすぎる。HARD BREAK なら効きそうだ。')],
  s2_lower_hint: [
    L('silica', 'ここから先は、BONDとBREAKを使いわける場所が続きそうだ。'),
    L('silica', '岩なら一つに。スイッチなら二人に。……場面ごとに、ちょうどいい形がある。'),
  ],
  s2_boss_intro: [
    L('sys', '地面が大きくゆれた。'),
    L('miner', 'あ、あれは……古代の採掘機械！ THE BREAKで暴走して、谷を掘り荒らしてるんだ！'),
    L('silica', 'クリスタル・ブレイカー……。結晶の殻でおおわれている。ふつうの攻撃は通らないはずだ。'),
  ],
  s2_boss_p1_hint: [L('silica', '外殻はぼくたちの BOND で割るしかない。カーボン、SiC FORMだ！')],
  s2_boss_shell_broken: [
    L('sys', 'ガシャァン！　外殻がくだけた！'),
    L('silica', '中がむき出しだ。……でも、熱い。中心部は高温になっている。'),
    L('silica', 'SiC FORMのまま、熱の中に飛びこんで中心をたたこう！'),
  ],
  s2_boss_core_down: [
    L('sys', '機械が止まりかけている。……でも、また動き出そうとしている！'),
    L('silica', '左右に制御装置がある。2つを同時に止めれば、完全に停止するはずだ。'),
    L('silica', '……SiC FORMのままじゃ、片方しか押せない。'),
    L('carbon', '……BREAK、だね。'),
  ],
  s2_boss_console_one: [L('silica', 'もう一つの装置も、同時に！')],
  s2_boss_stop: [
    L('sys', 'クリスタル・ブレイカーが、静かに動きを止めた。'),
  ],
  s2_after_boss: [
    L('silica', 'ずっと、強くなるには一つになればいいと思ってた。'),
    L('silica', 'でも違った。'),
    L('carbon_shy', '……つながるのも。'),
    L('carbon', '離れるのも。'),
    L('silica', '必要ってことか。'),
    L('silica', '……決めた。ぼくもキミたちと行くよ。まだまだ、観察したいことがある。'),
    L('sys', 'シリカが正式に仲間になった！'),
  ],
  s2_night: [
    L('sys', 'その夜。'),
    L('hyde', 'ねえ、見て！ 遠くの山の向こう……'),
    L('silica', '青白い光……雷？　いや、ずっと同じ場所で光っている。'),
    L('sys', '遠くの古代施設に、青白い電気が走っていた。'),
  ],
  s2_next: [
    L('silica', 'あの方角には、「雷導の街」があるはずだ。'),
    L('carbon_shy', '（……谷の、動かなかった装置。あれも、あの光と関係あるのかな）'),
    L('sys', 'つづく ―― 次の地域「雷導の街」'),
  ],
  s2_game_over: [L('sys', '力つきてしまった……。元素碑からやり直そう。')],
  s2_villager_wait: [L('sys', '仲間は元素碑のそばで待っている。')],
  s2_exit_locked: [L('silica', '奥の採掘場から、大きな音がする。……準備ができたら進もう。')],
};

export const SCRIPT2_EXTRA: Record<string, Line[]> = {
  s2_terminal_locked: [L('sys', '古い装置だ。文字がにじんでいて、ひとりでは読めない。……だれか、くわしい人がいれば。')],
  s2_miner: [L('miner', '奥の採掘場には、古代の採掘機械が眠ってる。……THE BREAKのあと、ときどき勝手に動き出すんだ。')],
  s2_miner_after: [L('miner', 'あの機械を止めてくれたのか！ これで谷も静かになる。ありがとう！')],
  s2_researcher_after: [L('researcher', 'ケイ素と炭素のBOND……SiC。研究のしがいがあるな！')],
  s2_silica_talk: [L('silica', '観察は、まず疑うことから始まる。……キミのことも、まだ観察中だ。')],
  s2_party_changed: [L('sys', 'いっしょに行く仲間を入れかえた。')],
  s2_after_boss_recap: [
    L('sys', 'H、C、O、Si。見つけた元素は、まだ4つ。'),
    L('silica', '118のうち、たった4つか。……観察のしがいがあるね。'),
    L('carbon_shy', '（みんな、ちがう元素。……でも、必要な時には、つながれる）'),
  ],
};
Object.assign(SCRIPT2, SCRIPT2_EXTRA);
