# アイテム画像

一般素材の2Dアイコン（PNG・透過・128〜256px）を置く場所。
`src3d/ch1/game/materials.ts` の `visual.icon` に `/element118/assets/items/名前.png` と書くと使われる。
GLB（3Dモデル）も同じ場所に置き、`visual.model` で指定する。
表示の優先順位：GLB → PNG → コードで作った仮3D → 文字のみ。
