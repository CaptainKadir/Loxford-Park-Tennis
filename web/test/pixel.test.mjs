import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { PIXEL, targetOptions } from '../game/render/config.js';
import { COURT, buildCourt, toThree } from '../game/render/court.js';

test('pixel: low-res target is 480x270 and sampled with nearest filtering', () => {
  assert.equal(PIXEL.width, 480);
  assert.equal(PIXEL.height, 270);
  const o = targetOptions();
  assert.equal(o.minFilter, THREE.NearestFilter);
  assert.equal(o.magFilter, THREE.NearestFilter);
});

test('court: constants match core/court.h', () => {
  const h = fs.readFileSync(new URL('../../core/court.h', import.meta.url), 'utf8');
  const get = (n) => Number(new RegExp(`#define ${n}\\s+([0-9.]+)f`).exec(h)[1]);
  assert.equal(COURT.halfLen, get('COURT_HALF_LEN'));
  assert.equal(COURT.singlesHalfW, get('COURT_SINGLES_HALF_W'));
  assert.equal(COURT.doublesHalfW, get('COURT_DOUBLES_HALF_W'));
  assert.equal(COURT.serviceZ, get('COURT_SERVICE_Z'));
  assert.equal(COURT.netCentre, get('NET_H_CENTRE'));
  assert.equal(COURT.netPost, get('NET_H_POST'));
});

test('court: surface spans the doubles court and the net is at z = 0', () => {
  const g = buildCourt();
  const box = new THREE.Box3().setFromObject(g.getObjectByName('court-surface'));
  assert.ok(Math.abs(box.max.x - box.min.x - 2 * COURT.doublesHalfW) < 0.5);
  assert.ok(Math.abs(box.max.z - box.min.z - 2 * COURT.halfLen) < 0.5);
  const net = new THREE.Box3().setFromObject(g.getObjectByName('net'));
  assert.ok(Math.abs((net.max.z + net.min.z) / 2) < 0.05);
  assert.ok(Math.abs(net.max.y - COURT.netPost) < 0.2);
});

test('court: toThree is the identity (core is right-handed like three.js)', () => {
  assert.deepEqual(toThree(2, 1, 3), [2, 1, 3]);
});
