# 素材の差し替え方法

今はすべての画像を `src/assets/placeholders.ts` がコードで描いています（仮素材）。
同じキー・同じコマ配置のPNGを用意すれば、**ゲームのコードを変えずに**差し替えられます。

## 手順

1. PNGを `public/assets/sprites/` に置く（例：`carbon.png`）
2. `public/assets/manifest.json` に追記する

```json
{
  "carbon": { "file": "sprites/carbon.png", "frameWidth": 32, "frameHeight": 32, "directions": 4 },
  "tiles":  { "file": "sprites/tiles.png",  "frameWidth": 16, "frameHeight": 16 }
}
```

3. 読み込めなかった場合は、自動で仮素材に戻ります（コンソールに警告）。

## キーとコマ配置

| キー | 1コマ | 配置 |
| --- | --- | --- |
| `carbon`（主人公） | 32×32 | 行：0 下向き、1 上向き、2 横向き（右）。8方向にするときは 3 斜め下（右下）、4 斜め上（右上）を追加し `"directions": 8`。列：0-1 待機、2-5 歩行、6-8 攻撃、9 回避、10 ガード（鍋ぶたの盾）、11 被ダメージ、12-13 BOND |
| `hyde` `oxy` `elder` `villager` | 32×32 | 1行：0-1 待機、2-3 歩行 |
| `breakling`（敵） | 32×32 | 0-1 移動、2 被弾、3 気絶 |
| `tiles` | 16×16 | 横16枚×縦4段。0〜15は歩ける床、16以降はぶつかる物。番号は `placeholders.ts` の `T` を参照 |
| `crystal_H` `crystal_O` | 16×16 | 0-1 光る、2 空（再生待ち） |
| `device`（古代の浮力装置・架空） | 32×48 | 0 停止、1 充填済み |
| `torch` | 16×32 | 0 消えかけ、1-3 燃える |
| `bramble` | 16×16 | 2コマ |
| `flame` | 16×32 | 4コマ |
| `fog` | 16×16 | 4コマ |
| `savestone` | 16×32 | 2コマ |
| `sign` | 16×16 | 1コマ |
| `goal` | 16×16 | 2コマ |
| `slash`（攻撃の軌跡、右向きで描く） | 32×32 | 3コマ |
| `pt_carbon` `pt_carbon_shy` `pt_hyde` `pt_oxy` `pt_elder` `pt_villager`（会話の顔） | 192×192 | 1コマ |

## 主人公カーボンの見た目のルール

- 恥ずかしがり屋。お面（「C」と「6」入り）をつけている。
- 序盤はボロボロの服（つぎはぎのマント）、簡素なバッグ、古いブーツ、未完成の装備（盾は鍋ぶた）。
- 冒険が進むと少しずつ装備が完成していく（成長後の見た目は次の段階で追加）。
