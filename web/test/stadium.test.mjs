import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { crowdLayout, buildStadium } from '../game/render/stadium.js';
import { COURT } from '../game/render/court.js';

test('crowd: same seed gives the same layout, different seed differs', () => {
  assert.deepEqual(crowdLayout(7), crowdLayout(7));
  assert.notDeepEqual(crowdLayout(7), crowdLayout(8));
});

test('crowd: everyone sits in the stands, outside the run-off area', () => {
  const people = crowdLayout(3);
  assert.ok(people.length >= 300);
  for (const p of people) {
    const outX = Math.abs(p.x) > COURT.doublesHalfW + 4;
    const outZ = Math.abs(p.z) > COURT.halfLen + 6;
    assert.ok(outX || outZ, `person at ${p.x},${p.z} is on the court area`);
    assert.ok(p.y > 0.5, 'seated above the ground');
  }
});

test('stadium: stays inside the draw-call budget', () => {
  const { group } = buildStadium(null, 1);
  let meshes = 0;
  group.traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
  assert.ok(meshes < 60, `meshes ${meshes}`);
  assert.ok(group instanceof THREE.Group);
});
