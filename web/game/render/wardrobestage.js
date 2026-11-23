// The wardrobe preview: your cat on a small turntable wearing what is equipped (or what you are pointing at), swinging its
// racket now and then, with a ball looping round it that leaves the equipped ball trail. A plain transparent WebGL canvas
// (no court), so the menu shows through. Move the pointer over it to turn the cat.
import * as THREE from 'three';
import { toonGradient } from './config.js';
import { buildCat } from './cat.js';
import { lookFor } from '../cats.js';
import * as tex from './textures.js';

const REST_Q = [0.866, -0.5, 0, 0]; // the racket held ready, in the core's frame (the same one the lesson stage uses)
const TRAIL = 26;

export function createWardrobeStage(canvas, { cat: catIndex = 0, calm = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.5, 6.4); camera.lookAt(0, 0.7, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8fc0, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.6); sun.position.set(-3, 5, 4); scene.add(sun);
  const grad = toonGradient();

  // a round stage: a dark disc with a gold rim
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.14, 40), new THREE.MeshToonMaterial({ color: 0x2b3a6a, gradientMap: grad }));
  disc.position.y = -0.07; scene.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 6, 48), new THREE.MeshToonMaterial({ color: 0xffd166, gradientMap: grad }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.0; scene.add(rim);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.1, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01; scene.add(glow);

  let cat = null, look = {}, dressed = false;
  const stand = (index) => {
    if (cat) { scene.remove(cat.group); cat.group.traverse((o) => { o.geometry?.dispose?.(); }); }
    cat = buildCat(lookFor(index, 0), grad, true);
    cat.group.position.set(0, 0, 0); scene.add(cat.group);
    cat.dress?.({ collar: look.collar ?? null, racketColor: look.racketColor ?? null, hat: look.hat ?? null, band: look.band ?? null });
  };
  stand(catIndex);

  // the ball loops round the cat; dots behind it are the trail
  const skinMaps = {};
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshToonMaterial({ color: 0xd8ff3a, gradientMap: grad }));
  scene.add(ball);
  const dots = Array.from({ length: TRAIL }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); scene.add(m); return m; });
  const hist = [];
  let clock = 0, swingAt = 1.2, yaw = 0, yawTarget = 0;

  const resize = () => {
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 320;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();

  return {
    canvas,
    /** What the cat wears: the same shape progress.equippedLook gives, { collar, racketColor, trail }. */
    setLook(l = {}) {
      look = l; cat.dress?.({ collar: l.collar ?? null, racketColor: l.racketColor ?? null, hat: l.hat ?? null, band: l.band ?? null });
      const sk = l.ballSkin; // the ball wears its skin
      if (sk) { skinMaps[sk.pattern] ??= tex.ballSkin(sk.pattern); ball.material.map = skinMaps[sk.pattern]; ball.material.color.setHex(0xffffff); } else { ball.material.map = null; ball.material.color.setHex(0xd8ff3a); }
      ball.material.needsUpdate = true;
    },
    /** Another cat (the hero changed). */
    setCat(index) { stand(index); },
    /** Where the pointer is across the canvas, -1..1: the cat turns to follow. */
    setPointer(x) { yawTarget = Math.max(-1, Math.min(1, x)) * 0.9; },
    resize,
    update(dt) {
      clock += dt;
      yaw += (yawTarget - yaw) * Math.min(1, dt * 4);
      const idle = calm ? 0 : Math.sin(clock * 0.6) * 0.25;
      cat.group.rotation.y = yaw + idle;
      const swing = !calm && clock >= swingAt;
      if (swing) swingAt = clock + 2.8;
      cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: REST_Q, inRally: false, swingStart: swing }, dt);
      // the ball: a tilted loop round the cat, with its trail in the equipped colour
      const u = clock * 1.7, r = 0.95;
      ball.position.set(Math.cos(u) * r, 0.6 + Math.sin(u * 1.3) * 0.28 + Math.abs(Math.sin(u * 2)) * 0.12, Math.sin(u) * r * 0.7 + 0.2);
      hist.unshift(ball.position.clone()); if (hist.length > TRAIL) hist.pop();
      const t = look.trail;
      dots.forEach((d, i) => {
        const p = hist[i];
        d.visible = !!p && i > 0;
        if (!p) return;
        d.position.copy(p);
        const f = 1 - i / TRAIL;
        d.scale.setScalar(0.35 + f * 0.65);
        d.material.opacity = t ? 0.2 + f * 0.7 : 0.12 + f * 0.25;
        if (!t) d.material.color.setHex(0xe8f6a0);
        else if (t.rainbow) d.material.color.setHSL((clock * 0.6 + i * 0.045) % 1, 0.9, 0.6);
        else d.material.color.setHex(t.color);
      });
    },
    render() { renderer.render(scene, camera); },
    dispose() { renderer.dispose(); },
  };
}
