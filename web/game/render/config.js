import * as THREE from 'three';

export const PIXEL = { width: 480, height: 270 };

export const targetOptions = () => ({
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
  depthBuffer: true,
});

export const PALETTE = {
  sky: 0x8fc8ff,
  grass: 0x4aa564,
  grassDark: 0x3e8f55,
  court: 0x3b73c9,
  courtDark: 0x3568b8,
  line: 0xf4f4ff,
  net: 0xe9eaf5,
  post: 0x2a2540,
  ball: 0xd8ff3a,
  shadow: 0x1a1030,
};

/** Three-step toon ramp, sampled without smoothing. */
export function toonGradient() {
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
