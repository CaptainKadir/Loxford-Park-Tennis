// Small pooled particles: dust puffs on bounces, spark bursts on hits, confetti on points.
import * as THREE from 'three';

const N = 360;

export function createEffects(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const pool = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    m.visible = false;
    scene.add(m);
    pool.push({ m, v: new THREE.Vector3(), life: 0, max: 1, size: 0.1, g: 0 });
  }
  let next = 0, fireAcc = 0;
  const spawn = (pos, vel, color, size, life, g) => {
    const p = pool[next++ % N];
    p.m.position.copy(pos);
    p.v.copy(vel);
    p.m.material.color.setHex(color);
    p.m.material.opacity = 1;
    p.size = size; p.life = p.max = life; p.g = g;
    p.m.scale.setScalar(size);
    p.m.visible = true;
  };
  const r = (a) => (Math.random() - 0.5) * 2 * a;
  const at = (x, y, z) => new THREE.Vector3(x, y, z);
  return {
    /** A puff where the ball lands. surf (feel.surfaceFor): clay throws a thicker orange cloud, grass throws green flecks. */
    dust(x, z, surf = null) {
      const n = surf?.dustN ?? 7, col = surf?.dust ?? 0xe8e2d0;
      for (let i = 0; i < n; i++) spawn(at(x, 0.05, z), at(r(1.2), 0.4 + Math.random() * 0.8, r(1.2)), col, 0.09, 0.45, -2);
      for (let i = 0; i < (surf?.flecks ?? 0); i++) spawn(at(x, 0.08, z), at(r(1.8), 1.2 + Math.random() * 1.4, r(1.8)), col, 0.045, 0.6, -6);
    },
    burst(x, y, z, color = 0xfff2a0) { for (let i = 0; i < 10; i++) spawn(at(x, y, z), at(r(2.5), r(2.5) + 0.8, r(2.5)), color, 0.07, 0.3, -4); },
    /** A short fading streak of the racket head during a swing. */
    trail(v, color = 0xffffff) { spawn(v, at(0, 0, 0), color, 0.09, 0.22, 0); },
    /** Flames behind a burning ball: k 0..1 how fierce, a: where the ball was last frame, b: where it is now. */
    fire(a, b, k, dt) {
      if (k <= 0.001) { fireAcc = 0; return; }
      fireAcc += dt * (14 + 90 * k); // flames per second
      const n = Math.floor(fireAcc); fireAcc -= n;
      const FLAME = [0xfff2a0, 0xffc233, 0xff9a1f, 0xff6a14, 0xe8420c, 0xb02a0a];
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 1; // spread along the path the ball took this frame
        const pos = at(a.x + (b.x - a.x) * t + r(0.04 + 0.05 * k), a.y + (b.y - a.y) * t + r(0.04 + 0.05 * k), a.z + (b.z - a.z) * t + r(0.04 + 0.05 * k));
        const hot = Math.random() ** (1.6 - k); // a fiercer fire is redder at its edges, with a white-hot heart
        const col = k > 0.55 && Math.random() < 0.18 ? 0xfff6c8 : FLAME[Math.min(FLAME.length - 1, Math.floor(hot * FLAME.length))];
        spawn(pos, at(r(0.5 + k), 0.7 + Math.random() * (0.6 + 1.4 * k), r(0.5 + k)), col, 0.05 + 0.1 * k + Math.random() * 0.05, 0.22 + 0.3 * k, 1.5);
      }
    },
    runDust(x, z) { spawn(at(x + r(0.15), 0.06, z + r(0.15)), at(r(0.3), 0.25, r(0.3)), 0xe8e2d0, 0.07, 0.35, -0.5); },
    confetti(x, z) {
      const cols = [0xe63946, 0x2d6bd6, 0xffd166, 0x7bd88f, 0xffffff];
      for (let i = 0; i < 36; i++) spawn(at(x + r(3), 3 + Math.random() * 2, z + r(3)), at(r(1.5), r(1) , r(1.5)), cols[i % 5], 0.1, 1.8, -2.2);
    },
    update(dt) {
      for (const p of pool) {
        if (!p.m.visible) continue;
        p.life -= dt;
        if (p.life <= 0) { p.m.visible = false; continue; }
        p.v.y += p.g * dt;
        p.m.position.addScaledVector(p.v, dt);
        if (p.m.position.y < 0.03) { p.m.position.y = 0.03; p.v.set(0, 0, 0); }
        p.m.material.opacity = Math.min(1, p.life / (p.max * 0.5));
        p.m.rotation.y += dt * 6;
      }
    },
  };
}
