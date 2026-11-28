import type { ColliderWorld } from '../world/colliders';
import type { Ground } from '../world/ground';

export interface MapProgress { visited: string[] }
export type MapLocation = readonly [label: string, x: number, z: number];
export type MapLayer = readonly [label: string, minHeight: number];
const CELL = 3;
const key = (x: number, z: number) => `${x}:${z}`;

export function explorationMap(ground: Ground, colliders: ColliderWorld, layers: readonly MapLayer[], landmarks: readonly MapLocation[]) {
  const mini = document.createElement('button');
  mini.id = 'miniMap';
  mini.type = 'button';
  mini.ariaLabel = '全体地図を開く';
  const miniCanvas = document.createElement('canvas');
  miniCanvas.width = miniCanvas.height = 128;
  mini.append(miniCanvas);
  mini.hidden = true;
  document.body.append(mini);
  const dialog = document.createElement('dialog');
  dialog.className = 'chapter-map';
  dialog.innerHTML = '<header><strong>地下地図</strong><select aria-label="階層"></select><button type="button">とじる</button></header><canvas width="720" height="540" aria-label="探索済みの地図"></canvas><small>▲ 現在地　◆ 目的地　● 発見済みの施設</small><p></p>';
  document.body.append(dialog);
  const full = dialog.querySelector('canvas')!;
  const selector = dialog.querySelector('select')!;
  layers.forEach(([name], i) => selector.add(new Option(name, String(i))));
  dialog.querySelector('button')!.onclick = () => dialog.close();
  mini.onclick = () => {
    if (!dialog.open) {
      selector.value = String(layerAt(ground.heightAt(player.x, player.z)));
      dialog.showModal();
      drawFull();
    }
  };
  selector.onchange = () => drawFull();
  let progress: MapProgress | undefined;
  let seen = new Set<string>();
  let player = { x: 0, z: 0, facing: 0 };
  let goal: MapLocation | undefined;
  let tick = 0;
  const layerAt = (y: number) => layers.reduce((index, [, bottom], i) => y >= bottom ? i : index, 0);
  const coords = (x: number, z: number) => [Math.floor(x / CELL), Math.floor(z / CELL)] as const;
  const tx = (i: number) => (i + 0.5) * CELL;
  const visited = (x: number, z: number) => seen.has(key(...coords(x, z)));
  function* displayedCells(fromX: number, fromZ: number, spanX: number, spanZ: number, fullMap: boolean) {
    if (fullMap) {
      for (const entry of seen) yield entry.split(':').map(Number);
      return;
    }
    const [left, top] = coords(fromX, fromZ);
    const [right, bottom] = coords(fromX + spanX, fromZ + spanZ);
    for (let ix = left; ix <= right; ix++) for (let iz = top; iz <= bottom; iz++) {
      if (seen.has(key(ix, iz))) yield [ix, iz];
    }
  }
  const draw = (canvas: HTMLCanvasElement, fromX: number, fromZ: number, spanX: number, spanZ: number, layer?: number) => {
    const ctx = canvas.getContext('2d')!;
    const sx = canvas.width / spanX, sz = canvas.height / spanZ;
    const px = (x: number) => (x - fromX) * sx, pz = (z: number) => (z - fromZ) * sz;
    ctx.fillStyle = '#101725';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [ix, iz] of displayedCells(fromX, fromZ, spanX, spanZ, layer !== undefined)) {
      const x = tx(ix), z = tx(iz);
      if (x < fromX - CELL || z < fromZ - CELL || x > fromX + spanX + CELL || z > fromZ + spanZ + CELL) continue;
      const y = ground.heightAt(x, z);
      if (layer !== undefined && layerAt(y) !== layer) continue;
      const clearance = (ground.ceilingAt?.(x, z) ?? Infinity) - y;
      const grade = Math.max(Math.abs(ground.heightAt(x + 1, z) - ground.heightAt(x - 1, z)), Math.abs(ground.heightAt(x, z + 1) - ground.heightAt(x, z - 1)));
      const building = colliders.near(x, x, z, z).some((c) => c.enabled && !c.passable && !c.dynamic && c.bottom < y + 1.5 && c.top > y + 0.65 && colliders.contains(c, x, z));
      ctx.fillStyle = clearance < 1.45 || grade > 5 ? '#222839' : building ? '#a48b72' : ground.waterAt(x, z) !== null ? '#315e7a' : y > 20 ? '#59627b' : '#536477';
      ctx.fillRect(px(ix * CELL), pz(iz * CELL), Math.ceil(CELL * sx), Math.ceil(CELL * sz));
    }
    const marker = ([label, x, z]: MapLocation, isGoal: boolean) => {
      if (layer !== undefined && layerAt(ground.heightAt(x, z)) !== layer) return;
      let mx = px(x), mz = pz(z);
      if (mx < 0 || mz < 0 || mx > canvas.width || mz > canvas.height) {
        if (!isGoal || layer !== undefined) return;
        mx = Math.max(6, Math.min(canvas.width - 6, mx));
        mz = Math.max(6, Math.min(canvas.height - 6, mz));
      }
      ctx.fillStyle = isGoal ? '#ffce72' : '#93dddf';
      ctx.beginPath();
      if (isGoal) { ctx.moveTo(mx, mz - 5); ctx.lineTo(mx + 5, mz); ctx.lineTo(mx, mz + 5); ctx.lineTo(mx - 5, mz); }
      else ctx.arc(mx, mz, 3, 0, 2 * Math.PI);
      ctx.fill();
      if (layer !== undefined) { ctx.font = '13px sans-serif'; ctx.fillText(label, mx + 7, mz - 4); }
    };
    for (const spot of landmarks) if (visited(spot[1], spot[2])) marker(spot, false);
    if (goal) marker(goal, true);
    if (layer !== undefined && layerAt(ground.heightAt(player.x, player.z)) !== layer) return;
    ctx.save();
    ctx.translate(px(player.x), pz(player.z));
    ctx.rotate(-player.facing);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#102039';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-5, -5); ctx.lineTo(0, -2); ctx.lineTo(5, -5); ctx.closePath();
    ctx.stroke(); ctx.fill(); ctx.restore();
  };
  function drawFull() {
    const points = [...seen].map((entry) => entry.split(':').map(Number));
    if (!points.length) return;
    if (goal && layerAt(ground.heightAt(goal[1], goal[2])) === Number(selector.value)) points.push([...coords(goal[1], goal[2])]);
    const minX = Math.min(...points.map(([x]) => x)) * CELL - 9;
    const maxX = Math.max(...points.map(([x]) => x)) * CELL + 12;
    const minZ = Math.min(...points.map(([, z]) => z)) * CELL - 9;
    const maxZ = Math.max(...points.map(([, z]) => z)) * CELL + 12;
    const spanX = Math.max(60, maxX - minX, (maxZ - minZ) * full.width / full.height);
    const spanZ = spanX * full.height / full.width;
    draw(full, (maxX + minX - spanX) / 2, (maxZ + minZ - spanZ) / 2, spanX, spanZ, Number(selector.value));
    dialog.querySelector('p')!.textContent = goal ? `目的地：${goal[0]}` : '';
  }
  return {
    get open() { return dialog.open; },
    close() { if (dialog.open) dialog.close(); },
    update(dt: number, state: MapProgress | undefined, x: number, z: number, facing: number, objective?: MapLocation) {
      mini.hidden = !state;
      if (progress !== state) { progress = state; seen = new Set(state?.visited); tick = 0; }
      if (!state) return;
      tick -= dt;
      if (tick > 0) return;
      tick = 0.18;
      player = { x, z, facing };
      goal = objective;
      const [cx, cz] = coords(x, z);
      const py = ground.heightAt(x, z);
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
        if (a * a + b * b > 9) continue;
        const k = key(cx + a, cz + b);
        if (seen.has(k) || Math.abs(tx(cx + a)) > ground.half || Math.abs(tx(cz + b)) > ground.half) continue;
        const steps = Math.max(Math.abs(a), Math.abs(b));
        let occluded = false;
        for (let step = 1; step < steps; step++) {
          const u = step / steps, rx = x + (tx(cx + a) - x) * u, rz = z + (tx(cz + b) - z) * u;
          const ry = ground.heightAt(rx, rz);
          if ((ground.ceilingAt?.(rx, rz) ?? Infinity) - ry < 1.45 || ry > py + 4) {
            occluded = true;
            break;
          }
        }
        if (!occluded) { seen.add(k); state.visited.push(k); }
      }
      draw(miniCanvas, x - 27, z - 27, 54, 54);
      if (dialog.open) drawFull();
    },
  };
}
