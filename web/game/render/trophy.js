// The trophy the winner of a match holds up: a gold cup on a plinth.
import * as THREE from 'three';

export function createTrophy(scene) {
  const g = new THREE.Group();
  const gold = new THREE.MeshToonMaterial({ color: 0xffc933, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const dark = new THREE.MeshToonMaterial({ color: 0x4a3a2a });
  const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
  mk(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 8), dark, 0.06);
  mk(new THREE.CylinderGeometry(0.08, 0.14, 0.35, 8), gold, 0.3);
  mk(new THREE.CylinderGeometry(0.3, 0.12, 0.42, 10, 1, true), gold, 0.7).material.side = THREE.DoubleSide;
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 5, 10), gold); h.position.set(s * 0.33, 0.72, 0); h.rotation.y = Math.PI / 2; g.add(h); }
  g.visible = false; scene.add(g);
  let t = 0;
  return {
    group: g,
    show(x, y, z) { g.position.set(x, y, z); g.visible = true; t = 0; },
    hide() { g.visible = false; },
    update(dt) { if (!g.visible) return; t += dt; g.rotation.y += dt * 1.6; g.scale.setScalar(Math.min(1, t * 2.5) * (1 + 0.04 * Math.sin(t * 6))); },
  };
}
