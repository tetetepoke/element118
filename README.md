# ELEMENT 118（エレメント118）

元素の「結合」で世界を解き明かす、見下ろし型の探索アクションアドベンチャー。
遊んでいるうちに、元素と化学が自然に身につくことを目指しています。

**第一段階プロトタイプ（v0.1.0）**：ゲーム開始 → H₂Oを発見 → 炎の道を突破、までの約20分。

- 公開URL（GitHub Pages）：https://tetetepoke.github.io/element118/
- iPhoneは横向きで。Safariの「共有 → ホーム画面に追加」で全画面になり、セーブも消えにくくなります。

## 「レイン」とは完全に別のプロジェクト

- このリポジトリは単独で動き、他のゲームのコード・データを一切参照しません。
- ブラウザの保存領域は、`element118.` で始まるキーだけを使います（`src/core/storage.ts` だけが保存領域に触れ、ビルド時に自動チェック）。
  同じ `tetetepoke.github.io` の他のゲームのセーブには触れません。

## 遊び方

| 操作 | iPhone | キーボード |
| --- | --- | --- |
| 移動（360度） | 画面左側をタッチして動かす | WASD／矢印 |
| 攻撃・調べる・話す | 攻撃ボタン（近くに物があると表示が変わる） | J／Space |
| 回避 | 回避ボタン | K／Shift |
| ガード（直前に押すとジャストガード） | ガードボタン長押し | L |
| 元素能力（水をかける） | 元素ボタン | I |
| BOND（結合パネル） | BONDボタン | U |
| 図鑑 | メニュー → 元素図鑑 | C |
| メニュー | メニューボタン | Esc |

## 開発

```bash
npm install
npm run dev        # http://localhost:5173/element118/
npm run build      # データ検証 → 結合ルールのテスト → 型チェック → ビルド
```

`main` に push すると GitHub Actions がビルドして GitHub Pages に公開します（Settings → Pages → Source を「GitHub Actions」に）。

### フォルダ構成

```
src/
  config.ts            画面サイズ、保存キーの接頭辞、色など
  core/                保存（storage/save）、状態、入力、音、8方向の向き
  chem/bonding.ts      「結合の手」のルール（つなぐ／共有結合）
  data/elements.ts     118元素の基本データ（実装済みは H・C・O）
  data/substances.ts   物質と化学反応（合わさり方の種類を区別）
  data/worldMap.ts     第一段階のマップと配置
  data/script.ts       すべての会話テキスト
  assets/placeholders.ts  仮素材（コードで描画）
  assets/manifest.ts   本番スプライトへの差し替え
  scenes/              タイトル、ワールド、UI、BONDパネル、発見演出、図鑑、メニュー、クリア
scripts/
  validate-data.ts     データ検証（実在しない物質を作れないか、反応式の釣り合い、保存キーの制限など）
  test-bonding.ts      結合ルールのテスト
  smoke.mjs            ヘッドレスブラウザでの通しプレイテスト
  stage2-test.mjs      ステージ2の通しプレイテスト（版1セーブからの引き継ぎ、BOND→BREAK、ボス、周期表）
  facing-test.mjs      4方向に歩いて向きを確認
  trace-carbon.py / trace-stage2.py   基準画像を下絵にして32×32へ描き直す
```

## 科学的な正確さのルール

設計書「0. 最重要ルール」に従います。

- 図鑑の文は事実だけ。現時点の文は **すべて監修前**（画面に「監修前」と表示）。公開前に出典と照合し、`reviewed: true` にしてください。
  リリース時は `src/config.ts` の `SHOW_UNREVIEWED_FACTS` を `false` にすると、未監修の文は表示されません。
- 簡略化は「ゲームのルール」欄に分けて表示。「ほんとうは？」で実際の仕組みを伝える。
- BONDは「結合の手」がすべてつながったときだけ成立。成立する組み合わせはすべて実在の物質として登録されていることをビルド時に確認。
- 合わさり方（元素同士の結合／分子・化合物／混合物・合金／化学反応）はデータでも画面でも区別。
- 古代の浮力装置は架空の装置。H₂の図鑑には「現実でまねしない」を明記。

## 素材の差し替え

[ASSETS.md](ASSETS.md) を参照。PNGを置いて `public/assets/manifest.json` に1行書くだけで、仮素材と入れ替わります。
ステージ2「珪晶の谷」の設計と実装方針は [docs/STAGE2_PLAN.md](docs/STAGE2_PLAN.md)。
3D技術検証プロトタイプ（`/element118/3d/`）は [docs/3D_PROTOTYPE.md](docs/3D_PROTOTYPE.md)。
3Dゲーム本編 第1章「根は、上から来る」（`/element118/chapter1/`）は [docs/CHAPTER1.md](docs/CHAPTER1.md)。
キャラクターの見た目は [docs/CHARACTER_DESIGN.md](docs/CHARACTER_DESIGN.md)（正式な基準画像：`art/reference/character-design-reference.png`）に合わせます。
