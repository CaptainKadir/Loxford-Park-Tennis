import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCat } from '../game/render/cat.js';
import { ALL_CATS } from '../game/cats.js';
import { lookFor } from '../game/cats.js';
import { danceFor, blendDance } from '../game/render/dances.js';
import { LESSONS } from '../game/lessons.js';
import { DEMOS, demoQuat } from '../game/demo.js';
import { quatRToCore } from '../game/render/rig.js';

const REST = [0.866, -0.5, 0, 0];
const grad = null;
const lowestFoot = (cat) => {
  cat.group.updateMatrixWorld(true);
  let low = Infinity; const box = new THREE.Box3();
  cat.group.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.height - 0.07) < 1e-6) { box.setFromObject(o); low = Math.min(low, box.min.y); } });
  return low;
};

test('no cat dips through the floor in any dance, on any frame', () => {
  for (let c = 0; c < ALL_CATS.length; c++) {
    const cat = buildCat(lookFor(c, 0), grad, true);
    for (let t = 0; t < 6; t += 1 / 60) {
      const d = danceFor(c, t);
      for (const w of [1, 0.5]) {
        cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: blendDance(d, w, REST).racket, inRally: false, mood: 1, dance: blendDance(d, w, REST) }, 1 / 60);
        assert.ok(lowestFoot(cat) > -1e-4, `cat ${c} t ${t.toFixed(2)} foot ${lowestFoot(cat)}`);
      }
    }
  }
});

test('no cat dips through the floor while swinging, running or celebrating', () => {
  const cat = buildCat(lookFor(0, 0), grad, true);
  const kinds = [{ name: 'serve', back: false }, { name: 'forehand', back: false }, { name: 'backhand', back: true }, { name: 'lob', back: false }, { name: 'drop', back: false }, { name: 'topspin', back: false }];
  for (const kind of kinds) for (let i = 0; i < 90; i++) {
    cat.update({ x: 0, z: 0, vx: i % 2 ? 4 : 0, vz: 0, racketQuat: [1, 0, 0, 0], inRally: true, swingStart: i === 0, swingKind: kind, big: true, mood: i % 3 - 1, slam: i > 60 ? 1 : 0 }, 1 / 60);
    assert.ok(lowestFoot(cat) > -1e-4, `${kind.name} frame ${i}: ${lowestFoot(cat)}`);
  }
});

test('lesson swings keep the feet on the floor too', () => {
  const cat = buildCat(lookFor(1, 0), grad, true);
  for (const l of LESSONS.filter((x) => x.kind === 'swing')) for (const id of l.demos) for (let u = 0; u <= 1; u += 0.05) {
    cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: quatRToCore(demoQuat(id, u)), inRally: true }, 1 / 60);
    assert.ok(lowestFoot(cat) > -1e-4, `${id} ${u}`);
  }
});

test('the racket never goes through the floor, whichever way it points', () => {
  const cat = buildCat(lookFor(2, 0), grad, true);
  let worst = Infinity;
  const box = new THREE.Box3();
  for (let a = 0; a < 360; a += 20) for (let b = -90; b <= 90; b += 15) for (let c = 0; c < 360; c += 60) {
    const e = new THREE.Euler((a * Math.PI) / 180, (b * Math.PI) / 180, (c * Math.PI) / 180);
    const q = new THREE.Quaternion().setFromEuler(e);
    cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: [q.w, q.x, q.y, q.z], inRally: true }, 1 / 60);
    cat.group.updateMatrixWorld(true);
    box.setFromObject(cat.racket);
    worst = Math.min(worst, box.min.y);
  }
  assert.ok(worst > -1e-4, `racket lowest ${worst}`);
});

test('the racket never dips through the floor in the tutorial example swings', () => {
  const box = new THREE.Box3();
  for (const c of [0, 3]) {
    const cat = buildCat(lookFor(c, 0), grad, true);
    for (const id of Object.keys(DEMOS)) for (let u = 0; u <= 1.0001; u += 0.02) {
      cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: quatRToCore(demoQuat(id, u)), inRally: true }, 1 / 60);
      cat.group.updateMatrixWorld(true);
      box.setFromObject(cat.racket);
      assert.ok(box.min.y > -1e-4, `${id} u ${u.toFixed(2)} racket ${box.min.y}`);
    }
  }
});

test('the racket stays above the floor in dances and the emote too', () => {
  const box = new THREE.Box3();
  for (let c = 0; c < ALL_CATS.length; c++) {
    const cat = buildCat(lookFor(c, 0), grad, true);
    for (let t = 0; t < 6; t += 1 / 30) {
      const d = blendDance(danceFor(c, t), 1, REST);
      cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: d.racket, inRally: false, mood: 1, dance: d }, 1 / 30);
      cat.group.updateMatrixWorld(true);
      box.setFromObject(cat.racket);
      assert.ok(box.min.y > -1e-4, `cat ${c} t ${t.toFixed(2)} racket ${box.min.y}`);
    }
  }
});

test('cosmetics (collar, racket colour) never put the feet or the racket under the floor, and can be taken off again', () => {
  const box = new THREE.Box3();
  const cat = buildCat(lookFor(1, 0), grad, true);
  const before = cat.racket.userData.frame.material.color.getHex();
  cat.dress({ collar: { color: 0xffd23a, glow: true }, racketColor: 0xff7ab8 });
  for (let t = 0; t < 4; t += 1 / 30) {
    const d = blendDance(danceFor(1, t), 1, REST);
    cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: d.racket, inRally: false, mood: 1, dance: d }, 1 / 30);
    cat.group.updateMatrixWorld(true);
    box.setFromObject(cat.racket);
    assert.ok(box.min.y > -1e-4 && lowestFoot(cat) > -1e-4, `t ${t.toFixed(2)}`);
  }
  assert.equal(cat.racket.userData.frame.material.color.getHex(), 0xff7ab8);
  cat.dress({});
  assert.equal(cat.racket.userData.frame.material.color.getHex(), before);
});
