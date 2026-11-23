// A virtual bat that mirrors the phone's orientation, with a trail of where the head goes.
// Same racket model and orientation mapping the game uses (see render/cat.js, render/rig.js).
import * as THREE from 'three';
import { quatRToCore } from './render/rig.js';
import { rotate } from '../shared/frame.js';

const TRAIL_MAX = 240;
const TIP = 1.05; // m from the grip to the head centre, exaggerated so arcs are easy to read

export function createBatView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1730);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 50);
  // Behind and a little to the right of the player, looking at the net (core: +z = net, right = -x).
  camera.position.set(-1.2, 1.45, -2.1);
  camera.lookAt(0, 1.05, 0.25);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7fa8, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 6, -4);
  scene.add(sun);

  // ground, a line toward the net, and the player's body position for reference
  const grid = new THREE.GridHelper(8, 16, 0x5d4d8f, 0x2c2347);
  scene.add(grid);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.01, 0.3), 3.2, 0x7be0a0, 0.3, 0.2);
  scene.add(arrow);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.0, 12),
    new THREE.MeshLambertMaterial({ color: 0x6a5a9a, transparent: true, opacity: 0.45 }));
  body.position.set(0.45, 0.55, 0); // beside the grip: the racket arm is on the -x side
  scene.add(body);

  // racket: head along +y in model space, face normal +z; the group maps phone axes (top = y, screen = z)
  // onto core axes, so identity = phone flat pointing at the net.
  const bat = new THREE.Group();
  const model = new THREE.Group();
  model.quaternion.set(0, Math.SQRT1_2, Math.SQRT1_2, 0);
  bat.add(model);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2540 }));
  handle.position.y = -0.05;
  model.add(handle);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24),
    new THREE.MeshLambertMaterial({ color: 0xf4f4ff }));
  frame.scale.set(0.82, 1.15, 1);
  frame.position.y = 0.46;
  model.add(frame);
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20),
    new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  strings.scale.set(0.82, 1.15, 1);
  strings.position.y = 0.46;
  model.add(strings);
  // a little arrow out of the strings so the face direction is obvious
  const face = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.46, 0), 0.4, 0xffe27a, 0.12, 0.08);
  model.add(face);
  bat.position.set(0, 1.0, 0);
  bat.scale.setScalar(1.35);
  scene.add(bat);

  const dots = [];
  const dotGeo = new THREE.SphereGeometry(0.03, 6, 5);
  for (let i = 0; i < TRAIL_MAX; i++) {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true }));
    m.visible = false;
    scene.add(m);
    dots.push(m);
  }
  let trailN = 0, trailHead = 0;

  let qCore = [1, 0, 0, 0];
  function setQuat(qR) {
    qCore = quatRToCore(qR);
    bat.quaternion.set(qCore[1], qCore[2], qCore[3], qCore[0]);
  }
  const tipPos = () => {
    const h = rotate(qCore, [0, 0, 1]); // racket head direction in core coordinates
    return [bat.position.x + h[0] * TIP, bat.position.y + h[1] * TIP, bat.position.z + h[2] * TIP];
  };

  const tmpColor = new THREE.Color();
  return {
    setQuat,
    /** Add a point to the head trail (call while recording). */
    addTrail(color = 0xffe27a) {
      const [x, y, z] = tipPos();
      const d = dots[trailHead];
      d.position.set(x, y, z);
      d.material.color.set(tmpColor.set(color));
      d.visible = true;
      trailHead = (trailHead + 1) % TRAIL_MAX;
      trailN = Math.min(TRAIL_MAX, trailN + 1);
    },
    clearTrail() {
      dots.forEach((d) => { d.visible = false; });
      trailN = 0; trailHead = 0;
    },
    setRecording(on) {
      scene.background.set(on ? 0x2b1a2f : 0x1d1730);
      body.material.color.set(on ? 0xc0506a : 0x6a5a9a);
    },
    render() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    },
  };
}
