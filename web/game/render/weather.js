// Weather for the look and the sound only (the ball's physics never changes): rain streaks that splash on the court, and wind that
// blows leaves across it and sways the trees. kind: 0 clear, 1 rain, 2 windy.
import * as THREE from 'three';

const DROPS = 420, LEAVES = 26;
export const WEATHER_NAMES = ['Clear', 'Rain', 'Windy'];

export function createWeather(scene, kind = 0) {
  const group = new THREE.Group();
  group.visible = kind !== 0;
  scene.add(group);
  // rain: short slanted streaks that fall through a box around the court
  const pos = new Float32Array(DROPS * 6), seed = [];
  for (let i = 0; i < DROPS; i++) seed.push({ x: (Math.random() - 0.5) * 34, y: Math.random() * 14, z: (Math.random() - 0.5) * 44, v: 14 + Math.random() * 6 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.55 });
  const rain = new THREE.LineSegments(geo, rainMat);
  rain.frustumCulled = false; rain.visible = kind === 1;
  group.add(rain);
  // wind: leaves that tumble across the court from one side
  const leaves = [];
  const leafGeo = new THREE.PlaneGeometry(0.16, 0.1);
  for (let i = 0; i < LEAVES; i++) {
    const m = new THREE.Mesh(leafGeo, new THREE.MeshBasicMaterial({ color: [0x7fb04a, 0xc6a03a, 0xa8602a][i % 3], side: THREE.DoubleSide }));
    m.visible = kind === 2; group.add(m);
    leaves.push({ m, x: (Math.random() - 0.5) * 40, y: 0.4 + Math.random() * 3, z: (Math.random() - 0.5) * 40, s: 3 + Math.random() * 3, ph: Math.random() * 6 });
  }
  let k = kind, t = 0;
  const api = {
    kind: () => k,
    set(n) { k = n | 0; group.visible = k !== 0; rain.visible = k === 1; for (const l of leaves) l.m.visible = k === 2; },
    /** How hard the sway of the trees and flags is (0 calm .. 1 windy), for the scenery. */
    get sway() { return k === 2 ? 1 : k === 1 ? 0.35 : 0.1; },
    /** Darken the light for rain (a 0..1 grey-out the world applies). */
    get gloom() { return k === 1 ? 0.22 : 0; },
    /** onSplash(x, z) is called now and then where a drop lands on the court. */
    update(dt, onSplash) {
      t += dt;
      if (k === 1) {
        for (let i = 0; i < DROPS; i++) {
          const d = seed[i];
          d.y -= d.v * dt; d.x -= 2.2 * dt;
          if (d.y < 0) { if (onSplash && Math.abs(d.x) < 5 && Math.abs(d.z) < 12 && Math.random() < 0.06) onSplash(d.x, d.z); d.y = 12 + Math.random() * 3; d.x = (Math.random() - 0.5) * 34; d.z = (Math.random() - 0.5) * 44; }
          pos[i * 6] = d.x; pos[i * 6 + 1] = d.y; pos[i * 6 + 2] = d.z;
          pos[i * 6 + 3] = d.x + 0.14; pos[i * 6 + 4] = d.y + 0.55; pos[i * 6 + 5] = d.z;
        }
        geo.attributes.position.needsUpdate = true;
      } else if (k === 2) {
        for (const l of leaves) {
          l.x += l.s * dt; l.y += Math.sin(t * 2 + l.ph) * 0.5 * dt; l.z += Math.cos(t * 1.3 + l.ph) * 0.8 * dt;
          if (l.x > 22) { l.x = -22; l.z = (Math.random() - 0.5) * 40; l.y = 0.4 + Math.random() * 3; }
          l.y = Math.max(0.1, l.y);
          l.m.position.set(l.x, l.y, l.z); l.m.rotation.set(t * 3 + l.ph, t * 2, t * 4 + l.ph);
        }
      }
    },
  };
  return api;
}
