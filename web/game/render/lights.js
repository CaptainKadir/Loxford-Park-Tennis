// Floodlight towers round the court. They stay dark by day and come on (with a short flicker) as it gets dark.
import * as THREE from 'three';

const SPOTS = [[-8.5, -13], [8.5, -13], [-8.5, 13], [8.5, 13]];

export function createFloodlights(scene) {
  const group = new THREE.Group();
  const pole = new THREE.MeshBasicMaterial({ color: 0x3a3550 });
  const heads = [];
  for (const [x, z] of SPOTS) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 6), pole); p.position.set(x, 4.5, z); group.add(p);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.3), new THREE.MeshBasicMaterial({ color: 0x555060 }));
    head.position.set(x, 9.2, z); head.lookAt(0, 1, 0); group.add(head);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x555060 })); // the bright face of the lamp
    lamp.position.set(x * 0.985, 9.2, z * 0.985); lamp.lookAt(0, 1, 0); group.add(lamp);
    heads.push({ head, glow: lamp });
  }
  scene.add(group);
  let power = 0, flickerT = 0;
  return {
    group,
    /** 0 off .. 1 fully on. Rising through 0.35..0.6 flickers like a lamp warming up. */
    setPower(p) { power = Math.max(0, Math.min(1, p)); },
    get power() { return power; },
    update(dt, clock) {
      flickerT += dt;
      let k = power;
      if (power > 0.05 && power < 0.7) k = power * (0.55 + 0.45 * (Math.sin(clock * 47) * Math.sin(clock * 13.3) > -0.2 ? 1 : 0));
      heads.forEach((h, i) => {
        const on = k * (power < 0.7 ? (Math.sin(clock * 31 + i * 2.1) > -0.3 ? 1 : 0.15) : 1);
        h.head.material.color.setRGB(0.33 + on * 0.67, 0.31 + on * 0.66, 0.38 + on * 0.4);
        h.glow.material.color.setRGB(0.3 + on * 0.7, 0.28 + on * 0.68, 0.3 + on * 0.4);
      });
    },
  };
}
