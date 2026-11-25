# ELEMENT 118 — 3D技術検証プロトタイプ

公開URL：`https://tetetepoke.github.io/element118/3d/`（2D版タイトル右下の「3D試作（技術検証）▶」からも行ける。3D側の「◀ 2D版へ」で戻る）

目的：将来の三人称3Dアクションアドベンチャーの**土台**。ストーリーは入れていない。
「カーボンを後ろから見て、立体的なフィールドを自由に走り回る」＋ BOND / BREAK の最小テスト。

## 2D版との関係（壊さないための決まり）
- 別ページ（`3d/index.html`）・別フォルダ（`src3d/`）。Phaserのコードとは実行時に何も共有しない。
- 変更した既存ファイルは3つだけ：`vite.config.ts`（入口を2つに）、`package.json`（three を追加）、`src/scenes/Title.ts`（3D試作へのリンク1つ）。
- 3D側の保存は `element118.3d.` で始まるキーだけ（`src3d/core/storage.ts`）。2Dのセーブ `element118.save.*` や他プロジェクトのキーには触れない（テストで確認）。

## 技術構成
| 項目 | 採用 | 理由 |
| --- | --- | --- |
| 描画 | Three.js（WebGL） | iPhone Safariで安定、Vite/TSと共存、GLTFLoader と AnimationMixer が標準。必要な部分だけ読み込むので軽い |
| 地形 | 高さを返す関数 `heightAt(x, z)` | 見た目・地面判定・カメラが同じ関数を使うので食い違わない。坂・崖・池を正確に扱える |
| 当たり判定 | 自前（円柱と回転した箱） | WASMの物理エンジンを読まないので速い。木・岩・遺跡・壊せる岩に使う |
| 将来 | 物理エンジン Rapier を追加可能 | 物が転がる・押す・水流など本格的な物理が必要になったら `ColliderWorld` の裏側を差し替える |

比べたもの：Babylon.js（多機能だが重い）、PlayCanvas（エディタ前提）。Unity／Godotへの移行はしない。

## フォルダ
```
3d/index.html              ページ（HUD・タッチボタン）
src3d/main.ts              組み立て・ループ・BOND/BREAKの流れ・図鑑
src3d/core/input.ts        入力（キーボード＋マウス、タッチ、ゲームパッド）→ InputState
src3d/core/camera.ts       三人称カメラ（360°、なめらか追従、衝突で縮む）
src3d/core/storage.ts      保存（element118.3d.*）
src3d/world/terrain.ts     地形関数・地形メッシュ・主要地点（PLACES）
src3d/world/colliders.ts   当たり判定（立てる・段差・押し出し・カメラ用の判定）
src3d/world/field.ts       木・岩・遺跡・池・壊せる岩・尖塔・遠景の山
src3d/player/controller.ts 操作（状態：Idle / Walk / Run / Jump / Fall / Land / Climb / Swim）
src3d/player/visual.ts     見た目の窓口 CharacterVisual ＋ 仮モデル（カーボン・シリカ）
src3d/player/gltfCharacter.ts 正式GLBモデル用（差し替え先）
src3d/chem/bondData.ts     Element / BondRecipe / BondForm / Ability / MaterialProperty / ObstacleSolution
scripts/proto3d-test.mjs   完成条件の通しテスト
scripts/proto3d-mobile-test.mjs  スマホ横画面・タッチ操作のテスト
```

## フィールド（200m × 200m）
南の草原（スタート）→ 小道 → 丘・岩場（段差で登る練習）→ 池 → 西の丘の上の遺跡（階段・柱・アーチ）。
北東に高さ16mの台地。周りは崖で、登れる道は谷間の坂1本だけ。その入口を**硬い岩**がふさいでいる。台地の上には遠くからも見える**クリスタルの尖塔**（ゴール）。外側には遠くの山。

## 操作
| | PC | iPhone | ゲームパッド |
| --- | --- | --- | --- |
| 移動 | WASD / 矢印 | 左側の仮想スティック（強く倒すと走る） | 左スティック |
| 走る | Shift | スティックを端まで | RT / L3 |
| ジャンプ | Space | JUMP | A |
| カメラ | マウス（クリックで固定、Escで解除。ドラッグでも可） | 右側をスワイプ | 右スティック |
| BOND・HARD BREAK・しらべる | E | アクションボタン（近くにある時だけ出る） | X |
| BREAK | Q | BREAK | B |
| 図鑑 | C | 図鑑 | Start |

移動の向きはカメラ基準。段差（0.45mまで）は自動で上がる。2.3mまでの段差は、向かって進みながらジャンプでよじ登る（空中では1.5mまで）。坂は約50°まで。空中ジャンプはできない。深い所では泳ぐ（簡易版）。

## 崖登りの今後
今は「段差によじ登る（Climb）」の簡易版。次は：壁に触れてつかまる → 上下左右に登る → スタミナ消費 → スタミナ切れで落ちる。`controller.ts` の `tryLedge` と状態 `Climb` を広げる形で入れる。

## BOND（データで増やせる）
`src3d/chem/bondData.ts` にデータを足すだけで増える：
- **Element**：元素（Si など）。どのキャラが表すか（`partner`）。
- **BondRecipe**：カーボン ＋ 相手の元素 → 本物の物質（SiC）→ どのFORMになるか。
- **BondForm**：見た目の種類・使える能力・ゲームの中の説明（フィクション）。
- **Ability**：ゲームの能力（HARD BREAK）。どの本物の性質がモチーフか（`motif`）、どの障害物を壊せるか（`breaks`）。
- **MaterialProperty**：本物の性質（硬さ・耐摩耗性・耐熱性…）。
- **ObstacleSolution**：1つの障害物に複数の攻略法を登録する（今は「SiCで砕く」のみ有効。「崖を登る」「装置を動かす」は今後）。

図鑑では「本物の科学」と「ゲームの中の能力（フィクション）」を別の欄に表示する。

## 正式なGLBモデルへの差し替え
1. `public/models/carbon.glb` を置く（アニメーション名：Idle, Walk, Run, Jump, Fall, Land, Climb, Swim, HardBreak, Bond。違う名前なら `CARBON_CLIPS` を書き換える）。
2. SiC FORM などの見た目は、GLBの中に `form_sic` のような名前の部品を用意すると `setForm('sic')` で切り替わる。
3. `main.ts` で：
   ```ts
   import { GltfCharacter } from './player/gltfCharacter';
   const glb = await GltfCharacter.load(new URL('../models/carbon.glb', location.href).href);
   player.setVisual(glb);
   ```
   操作（`PlayerController`）は変えずに見た目だけが替わる。GLTFLoaderはこの時だけ読み込まれる。

## iPhone Safariでの注意
- 画面の解像度を最大1.6倍（PCは2倍）に抑え、影は1枚（1024px）、木・岩・草はまとめて描く（インスタンス化）。
- フレームが遅くなっても動きがスローにならないよう、移動の計算を細かく分けて追いつかせる。
- ピンチやダブルタップでの拡大は止めている。縦向きのときは「横にしてね」と出す。
- WebGLが止まったら再読み込みをうながす。WebGLが使えない端末では2D版へのリンクを出す。
