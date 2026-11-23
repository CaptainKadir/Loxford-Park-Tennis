import * as THREE from 'three';
import { PALETTE, toonGradient } from './config.js';
import { buildCourt, toThree } from './court.js';
import { createPixelRenderer } from './pixel.js';
import { buildCat, FURS } from './cat.js';
import * as tex from './textures.js';
import { loadCatAssets, buildCharacterCat } from './cat3d.js';
import { buildStadium } from './stadium.js';
import { buildScenery } from './scenery.js';
import { quatRToCore, swingKind, bodyYawFromRacket } from './rig.js';
import { createEffects } from './effects.js';
import { fireLevel } from '../extras.js';
import { themeFor, courtAt } from './courts.js';
import { createWeather } from './weather.js';
import { createFloodlights } from './lights.js';
import { createTrophy } from './trophy.js';
import { surfaceFor } from '../feel.js';
import { smash, slamAmount, createChase, CHASE_START } from './tantrum.js';

const BALL_R = 0.11; // drawn larger than the real 0.033 m so it reads at 480x270
const TRAIL = 10;

export function createWorld(canvas, { rightHanded = true, res = 480, fit = true, levels = 0, edge = 1, humanLook = FURS.human, cpuLook = FURS.cpu, partnerLook = null, cpu2Look = null, aspect = 16 / 9, cover = false, court = 0, time = 0, weather = 0, ballColor = PALETTE.ball, shakeOn = true } = {}) {
  const theme = themeFor(court, time);
  const width = Math.min(1920, Math.max(160, Math.round(res)));
  const pr = createPixelRenderer(canvas, { width, height: Math.round(width / aspect), fit, cover, levels, edge });
  const grad = toonGradient();
  const { scene } = pr;

  scene.background = new THREE.Color(theme.sky);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7fa8, theme.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sunColor, theme.sun);
  sun.position.set(-8, 14, -6);
  scene.add(sun);
  scene.add(buildCourt(grad, theme));
  const stadium = buildStadium(grad, 1, { park: theme.id === 'loxford' });
  scene.add(stadium.group);
  const fx = createEffects(scene);
  let lastPts = 0, lastHum = 0, clock = 0, prevBy = 0, prevVy = 0, mood = { human: 0, cpu: 0 }, moodT = 0;
  const net = scene.getObjectByName('net');
  // match lost: the loser smashes its racket, then the owl chases it (?tantrum=human|cpu previews it)
  let ending = null; // { side, t, landed, chase }
  let rallyN = 0, rallyPrev = 0; // hits in the current point, for the burning ball
  const prevBall = new THREE.Vector3(), ballBase = new THREE.Color(ballColor), ballHot = new THREE.Color(0xff8a2a);
  let emote = null;  // a dance frame for the human cat while it emotes
  let cpuEmote = null; // the same for the other cat (the other player's emote, in two-player and online)
  const events = []; // { type: 'angryMeow' | 'hoot', pan } for the game to turn into sound
  let hootT = 0;
  const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tantrum') : null;
  let netWobble = 0, prevBz = 0, squash = 0, shake = 0, runT = 0, lastLab = 0;
  const headV = new THREE.Vector3();
  const rollAxis = new THREE.Vector3();
  const scenery = buildScenery(grad, theme);
  scene.add(scenery.group);
  const surf = surfaceFor(courtAt(court).id);
  const wx = createWeather(scene, weather);
  const lamps = theme.id === 'loxford' ? { setPower() {}, update() {}, power: 0 } : createFloodlights(scene); // the park courts have no floodlights
  const trophy = createTrophy(scene);
  const baseLight = { hemi: theme.hemi, sun: theme.sun, sky: new THREE.Color(theme.sky), sunColor: new THREE.Color(theme.sunColor) };
  const toLight = theme.to ? { hemi: theme.to.hemi, sun: theme.to.sun, sky: new THREE.Color(theme.to.sky), sunColor: new THREE.Color(theme.to.sunColor) } : null;
  const lampBase = theme.time === 'night' ? 1 : theme.time === 'sunset' ? 0.85 : 0; // the floodlights are on at night, and come on through a dusk
  let duskU = 0, holdT = 0, punch = 0, zoom = 0, shakeFx = shakeOn, look = { burn: 0, ballScale: 1, disco: false, confetti: false }, confettiT = 0;
  let targets = null, trailLook = null, rainbowT = 0;

  const ballMat = new THREE.MeshToonMaterial({ color: ballColor, gradientMap: grad, map: tex.ball() });
  // a ball skin (see progress.js) paints the ball itself and replaces the ball-colour setting while it is worn
  const classicBallMap = ballMat.map, skinMaps = {};
  let ballSkin = null, ballSetting = ballColor;
  const applyBall = () => {
    if (ballSkin) { skinMaps[ballSkin.pattern] ??= tex.ballSkin(ballSkin.pattern); ballMat.map = skinMaps[ballSkin.pattern]; ballBase.setHex(0xffffff); }
    else { ballMat.map = classicBallMap; ballBase.setHex(ballSetting); }
    ballMat.color.copy(ballBase); ballMat.needsUpdate = true;
  };
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 8, 6), ballMat);
  scene.add(ball);
  const trail = [];
  for (let i = 0; i < TRAIL; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 6, 5), ballMat);
    m.visible = false;
    scene.add(m);
    trail.push(m);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 10),
    new THREE.MeshBasicMaterial({ color: PALETTE.shadow, transparent: true, opacity: 0.45 }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  let humanCat = buildCat(humanLook, grad, rightHanded);
  let cpuCat = buildCat(cpuLook, grad, true);
  cpuCat.group.rotation.y = Math.PI;
  scene.add(humanCat.group, cpuCat.group);
  // The simple procedural cats are the default. ?cats=character swaps in the animated Kenney character cats.
  if (typeof location !== 'undefined' && location.search.includes('cats=character')) {
    loadCatAssets().then(() => {
      scene.remove(humanCat.group, cpuCat.group);
      humanCat = buildCharacterCat(humanLook, grad, rightHanded);
      cpuCat = buildCharacterCat(cpuLook, grad, true);
      cpuCat.group.rotation.y = Math.PI;
      scene.add(humanCat.group, cpuCat.group);
    }).catch((e) => console.warn('character cats not loaded, keeping the simple ones:', e));
  }
  // Doubles: your partner stands beside you, and a second CPU beside the first (the simple cats only)
  let partnerCat = null, cpu2Cat = null, prevPartner = null, prevCpu2 = null, lastPartnerHits = 0, lastCpu2Hits = 0;
  if (partnerLook && cpu2Look) {
    partnerCat = buildCat(partnerLook, grad, true);
    cpu2Cat = buildCat(cpu2Look, grad, true);
    cpu2Cat.group.rotation.y = Math.PI;
    scene.add(partnerCat.group, cpu2Cat.group);
  }
  let prevLab = 0, humanBig = false, lastHits = 0, lastCpuHits = 0, prevCpu = null, seenCpuHits = 0;
  const cpuSwing0 = (st) => { const c = st.cpuHits !== seenCpuHits; seenCpuHits = st.cpuHits; return c; };

  const history = [];
  const extras = [];

  return {
    pr, scene, grad,
    /** Sound cues from the match-lost sequence; the game drains this every frame. */
    events,
    /** Register per-frame updaters (cats etc.): fn(state, status, dt). */
    add(fn) { extras.push(fn); },
    /** The crowd cheers (they hop and the umpire flaps); it fades over a couple of seconds. */
    cheer() { stadium.cheer(); },
    /** Adopt a live state silently (after a replay) so the next frame does not see a hit, a point or a match end that already happened. */
    resync(st) { rallyN = 0; rallyPrev = st.hits + st.cpuHits; lastHits = st.hits - st.partnerHits; lastCpuHits = st.cpuHits - st.cpu2Hits; lastPartnerHits = st.partnerHits; lastCpu2Hits = st.cpu2Hits; seenCpuHits = st.cpuHits; lastPts = st.pointsHuman + st.pointsCpu; lastHum = st.pointsHuman; prevLab = st.labState; },
    /** An emote: a dance frame (see dances.js) for your cat, or null to go back to playing. */
    setEmote(d) { emote = d; if (!d) humanCat.group.rotation.y = 0; },
    /** The other player's emote: a dance frame for the far cat, or null to go back to playing. */
    setCpuEmote(d) { cpuEmote = d; if (!d) cpuCat.group.rotation.y = Math.PI; },
    /** A hit of strength 0..1 (feel.impactOf): hold the cats' poses a moment and punch the camera in. */
    impact(i, { hold = 0, punchDeg = 0 } = {}) { if (!i) return; holdT = Math.max(holdT, hold); punch = Math.max(punch, punchDeg); },
    setShake(on) { shakeFx = !!on; },
    /** The ball's colour (the burning ball still glows over it). */
    setBallColor(c) { ballSetting = c; applyBall(); },
    setLook(l) { look = { burn: 0, ballScale: 1, disco: false, confetti: false, ...l }; },
    setWeather(k) { wx.set(k); },
    /** The rally's length zooms the camera in a touch. */
    setRally(deg) { zoom += (deg - zoom) * 0.08; },
    /** Dusk to Night: how far the match has gone, 0..1. */
    setDusk(u) { duskU = Math.max(0, Math.min(1, u)); if (theme.to) scenery.setDusk(duskU); },
    /** Equipped cosmetics for your cat: { collar, racketColor, trail }. */
    setCosmetics(c = {}) {
      humanCat.dress?.({ collar: c.collar ?? null, racketColor: c.racketColor ?? null, hat: c.hat ?? null, band: c.band ?? null });
      ballSkin = c.ballSkin ?? null; applyBall();
      trailLook = c.trail ?? null;
      trail.forEach((m) => { m.material = trailLook ? trailMat : ballMat; });
    },
    /** Daily Challenge targets: [{ x, z, hit }] drawn as rings on the CPU's half; null clears them. */
    setTargets(list) {
      if (targets) { scene.remove(targets.group); targets = null; }
      if (!list) return;
      const g = new THREE.Group(), rings = list.map((t) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.95, 24), new THREE.MeshBasicMaterial({ color: 0xff4d6d, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
        m.rotation.x = -Math.PI / 2; m.position.set(...toThree(t.x, 0.05, t.z));
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
        dot.rotation.x = -Math.PI / 2; dot.position.set(...toThree(t.x, 0.055, t.z));
        g.add(m, dot); return { t, m, dot };
      });
      scene.add(g);
      targets = { group: g, update(c) { for (const r of rings) { r.m.material.color.setHex(r.t.hit ? 0x3ddc84 : 0xff4d6d); r.m.scale.setScalar(r.t.hit ? 1 : 1 + 0.06 * Math.sin(c * 5)); r.dot.visible = !r.t.hit; } } };
    },
    /** The match winner holds up the trophy: side 'human' | 'cpu'. */
    showTrophy(side) { const c = side === 'human' ? humanCat : cpuCat; const p = c.group.position; trophy.show(p.x + (side === 'human' ? -0.7 : 0.7), 0, p.z + (side === 'human' ? 0.6 : -0.6)); fx.confetti(p.x, p.z); },
    hideTrophy() { trophy.hide(); },
    /** Where each cat stands (scene coordinates), for the game to aim cut scenes. */
    catPos(side) { return (side === 'human' ? humanCat : cpuCat).group.position; },
    update(st, status, dt) {
      const ghost = st.ghost === 1; // the other player's serve in flight, before it lands for real
      const p = ghost ? toThree(st.gX, st.gY, st.gZ) : toThree(st.ballX, st.ballY, st.ballZ);
      const inPlay = ghost || st.labState === 1 || st.labState === 2 || st.labState === 4 || st.labState === 5;
      ball.visible = inPlay;
      shadow.visible = inPlay;
      ball.position.set(...p);
      shadow.position.set(p[0], 0.04, p[2]);
      shadow.scale.setScalar(Math.max(0.4, 1.3 - st.ballY * 0.15));
      // the longer the rally, the more the ball burns: embers first, then a blaze
      const hitsTotal = st.hits + st.cpuHits;
      if (st.labState === 0 || st.labState === 3 || hitsTotal < rallyPrev) rallyN = 0;
      else if (hitsTotal > rallyPrev) rallyN += hitsTotal - rallyPrev;
      rallyPrev = hitsTotal;
      const burn = inPlay && !ghost ? Math.max(fireLevel(rallyN), look.burn) : 0;
      ballMat.emissive.setRGB(burn * 0.95, burn * 0.38, burn * 0.04);
      ballMat.color.lerpColors(ballBase, ballHot, burn * 0.7);
      fx.fire(prevBall, ball.position, burn, dt);
      prevBall.copy(ball.position);
      if (inPlay) { history.unshift(p); history.length = Math.min(history.length, TRAIL * 2); }
      else history.length = 0;
      trail.forEach((m, i) => {
        const h = history[(i + 1) * 2 - 1];
        m.visible = !!h && inPlay;
        if (h) { m.position.set(...h); m.scale.setScalar(1 - i / (TRAIL + 2)); }
      });
      humanCat.group.position.set(...toThree(st.playerX, 0, st.playerZ));
      const inRally = inPlay;
      const mine = st.hits - st.partnerHits; // doubles: `hits` counts the partner too
      const hitNow = mine !== lastHits;
      const swingStart = hitNow || status.swingFlash;
      lastHits = mine;
      // which swing to animate: the real stroke at contact, else a whiff follows which side the racket is turned to
      const hq = quatRToCore([st.racketW, st.racketX, st.racketY, st.racketZ]);
      const yaw = bodyYawFromRacket(hq);
      const humanKind = hitNow ? swingKind(st.hitSide, st.hitShot) : swingKind(rightHanded ? (yaw > 0.15 ? 2 : 1) : (yaw < -0.15 ? 2 : 1), 1);
      // bounce dust: the ball was falling and is now rising close to the ground
      const by = st.ballY, vy = by - prevBy;
      if (inPlay && prevVy < 0 && vy > 0 && by < 0.4) { fx.dust(p[0], p[2], surf); squash = 1; }
      // the ball squashes on the bounce and rolls the way it travels
      squash = Math.max(0, squash - dt * 9);
      ball.scale.set((1 + 0.3 * squash) * look.ballScale, (1 - 0.4 * squash) * look.ballScale, (1 + 0.3 * squash) * look.ballScale);
      if (inPlay) { rollAxis.set(st.ballVZ, 0, -st.ballVX).normalize(); const sp = Math.hypot(st.ballVX, st.ballVZ); if (sp > 0.1) ball.rotateOnWorldAxis(rollAxis, (sp / BALL_R) * dt * 0.5); }
      if (swingStart && (st.hitSpeed >= 12 || lastLab === 5)) shake = 1; // hard hits and serves shake the screen a touch
      lastLab = st.labState;
      prevBy = by; prevVy = vy;
      // contact sparks and net wobble
      if (swingStart) fx.burst(p[0], p[1], p[2]);
      if (cpuSwing0(st)) fx.burst(p[0], p[1], p[2], 0xcfe8ff);
      if (inPlay && prevBz * p[2] < 0 && p[1] < 1.1) netWobble = 1;
      prevBz = p[2];
      // the end of the match: who lost?
      const loser = forced || (st.matchOver ? (st.matchWinner === 0 ? 'cpu' : 'human') : null);
      if (loser && !ending) ending = { side: loser, t: 0, landed: 0, chase: null };
      if (!loser && ending) {
        stadium.owl.land();
        humanCat.group.rotation.y = 0; cpuCat.group.rotation.y = Math.PI;
        ending = null;
      }
      const tantrumFor = (side) => {
        if (!ending || ending.side !== side) return null;
        const { theta, landed } = smash(ending.t);
        const o = { q: [Math.cos(theta / 2), Math.sin(theta / 2), 0, 0], slam: slamAmount(ending.t), run: null };
        if (landed > ending.landed) { // the racket hit the ground
          ending.landed = landed; shake = Math.max(shake, 0.6);
          events.push({ type: 'angryMeow', pan: (side === 'human' ? humanCat : cpuCat).group.position.x, pitch: 0.9 + Math.random() * 0.3 });
          const g = (side === 'human' ? humanCat : cpuCat).group.position;
          fx.burst(g.x, 0.1, g.z + (side === 'human' ? 0.9 : -0.9), 0xfff2a0); fx.dust(g.x, g.z + (side === 'human' ? 0.9 : -0.9));
        }
        if (ending.t >= CHASE_START) {
          const g = (side === 'human' ? humanCat : cpuCat).group.position;
          if (!ending.chase) {
            ending.chase = createChase({ catX: g.x, catZ: g.z, half: g.z < 0 ? -1 : 1, owlX: 7.6, owlY: 3.1, owlZ: 0, seed: 7 });
            stadium.owl.takeOff([7.6, 3.1, 0]);
          }
          o.run = ending.chase.cat;
        }
        return o;
      };
      const hT = tantrumFor('human'), cT = tantrumFor('cpu');
      if (ending) ending.t += dt;
      humanBig = swingStart && (st.hitSpeed >= 12 || lastLab === 5);
      humanCat.update({ ...(emote ? { dance: emote, inRally: false } : {}), big: humanBig, x: st.playerX, z: st.playerZ, vx: st.playerVX, vz: st.playerVZ,
        racketQuat: hT ? hT.q : hq, slam: hT ? hT.slam : 0,
        ...(hT?.run ? { vx: hT.run.vx, vz: hT.run.vz } : {}), inRally, swingStart, swingKind: humanKind, mood: hT ? -1 : emote ? (emote.mood || 1) : mood.human }, holdT > 0 ? 1e-4 : dt);
      if (emote) { humanCat.group.position.x += emote.sway || 0; humanCat.group.rotation.y = emote.spin || 0; } // a dance: sway and turn the whole cat
      cpuCat.group.position.set(...toThree(st.cpuX, 0, st.cpuZ));
      const cpuSwing = st.cpuHits - st.cpu2Hits !== lastCpuHits;
      lastCpuHits = st.cpuHits - st.cpu2Hits;
      const cvx = prevCpu ? (st.cpuX - prevCpu[0]) / Math.max(dt, 1e-3) : 0;
      const cvz = prevCpu ? (st.cpuZ - prevCpu[1]) / Math.max(dt, 1e-3) : 0;
      prevCpu = [st.cpuX, st.cpuZ];
      // the CPU picks a stroke from where the ball is (its forehand side is +x) and now and then mixes in a slice, topspin or lob
      const cpuServe = prevLab === 5 && st.server === 1;
      const cpuRoll = (Math.imul(st.cpuHits | 0, 2654435761) >>> 0) % 9;
      const cpuKind = cpuServe ? swingKind(0, 1) : swingKind(st.ballX - st.cpuX < -0.15 ? 2 : 1, cpuRoll === 0 ? 3 : cpuRoll === 1 ? 2 : cpuRoll === 2 ? 5 : 1);
      cpuCat.update({ ...(cpuEmote ? { dance: cpuEmote, inRally: false } : {}), swingKind: cpuKind, x: st.cpuX, z: st.cpuZ, vx: -cvx, vz: cvz, racketQuat: cT ? cT.q : [1, 0, 0, 0], slam: cT ? cT.slam : 0,
        ...(cT?.run ? { vx: cT.run.vx, vz: cT.run.vz } : {}), ...(cpuEmote ? {} : { inRally }), swingStart: cpuSwing, mood: cT ? -1 : cpuEmote ? (cpuEmote.mood || 1) : mood.cpu }, holdT > 0 ? 1e-4 : dt);
      if (cpuEmote) { cpuCat.group.position.x -= cpuEmote.sway || 0; cpuCat.group.rotation.y = Math.PI + (cpuEmote.spin || 0); } // the far cat faces us, so its sway and turn are mirrored
      if (partnerCat) { // the two extra cats: the same animation, driven by their own position and swing counts
        const pSwing = st.partnerHits !== lastPartnerHits, cSwing = st.cpu2Hits !== lastCpu2Hits;
        lastPartnerHits = st.partnerHits; lastCpu2Hits = st.cpu2Hits;
        const pvx = prevPartner ? (st.partnerX - prevPartner[0]) / Math.max(dt, 1e-3) : 0, pvz = prevPartner ? (st.partnerZ - prevPartner[1]) / Math.max(dt, 1e-3) : 0;
        const qvx = prevCpu2 ? (st.cpu2X - prevCpu2[0]) / Math.max(dt, 1e-3) : 0, qvz = prevCpu2 ? (st.cpu2Z - prevCpu2[1]) / Math.max(dt, 1e-3) : 0;
        prevPartner = [st.partnerX, st.partnerZ]; prevCpu2 = [st.cpu2X, st.cpu2Z];
        partnerCat.group.position.set(...toThree(st.partnerX, 0, st.partnerZ));
        cpu2Cat.group.position.set(...toThree(st.cpu2X, 0, st.cpu2Z));
        partnerCat.update({ swingKind: swingKind(st.ballX - st.partnerX > 0.15 ? 2 : 1, 1), x: st.partnerX, z: st.partnerZ, vx: pvx, vz: pvz, racketQuat: [1, 0, 0, 0], slam: 0, inRally, swingStart: pSwing, mood: mood.human }, holdT > 0 ? 1e-4 : dt);
        cpu2Cat.update({ swingKind: swingKind(st.ballX - st.cpu2X < -0.15 ? 2 : 1, 1), x: st.cpu2X, z: st.cpu2Z, vx: -qvx, vz: qvz, racketQuat: [1, 0, 0, 0], slam: 0, inRally, swingStart: cSwing, mood: mood.cpu }, holdT > 0 ? 1e-4 : dt);
        if (pSwing) fx.burst(p[0], p[1], p[2]);
        if (cSwing) fx.burst(p[0], p[1], p[2], 0xcfe8ff);
      }
      // during the chase the loser's position and facing come from the chase, and the owl flies after it
      if (ending?.chase) {
        const ch = ending.chase, cat = ending.side === 'human' ? humanCat : cpuCat;
        ch.update(dt);
        hootT -= dt;
        if (hootT <= 0) { events.push({ type: 'hoot', pan: ch.owl.x, pitch: 0.95 + Math.random() * 0.1 }); hootT = 0.9 + Math.random() * 0.8; }
        cat.group.position.set(ch.cat.x, 0, ch.cat.z);
        if (Math.hypot(ch.cat.vx, ch.cat.vz) > 0.5) cat.group.rotation.y = Math.atan2(ch.cat.vx, ch.cat.vz);
        stadium.owl.fly(ch.owl.x, ch.owl.y, ch.owl.z, ch.owl.heading, dt);
      }
      clock += dt;
      const pts = st.pointsHuman + st.pointsCpu;
      if (pts !== lastPts) {
        if (pts > lastPts || st.pointsHuman !== lastHum) {
          const hw = st.pointsHuman !== lastHum;
          mood = hw ? { human: 1, cpu: -1 } : { human: -1, cpu: 1 }; moodT = 2.5;
          fx.confetti(hw ? st.playerX : st.cpuX, hw ? st.playerZ : st.cpuZ);
        }
        lastPts = pts; stadium.cheer();
      }
      lastHum = st.pointsHuman;
      if (moodT > 0 && (moodT -= dt) <= 0) mood = { human: 0, cpu: 0 };
      fx.update(dt);
      if (net) { netWobble = Math.max(0, netWobble - dt * 2.5); net.rotation.x = Math.sin(clock * 30) * 0.05 * netWobble; net.scale.z = 1 + netWobble * 0.0; }
      scenery.update(dt);
      stadium.watch(p);
      stadium.update(dt, clock);
      // racket streaks while swinging, dust while running
      const cats = partnerCat ? [humanCat, cpuCat, partnerCat, cpu2Cat] : [humanCat, cpuCat];
      for (const c of cats) if (c.swinging?.()) fx.trail(c.headPos(headV));
      runT -= dt;
      if (runT <= 0) {
        if (Math.hypot(st.playerVX, st.playerVZ) > 3) fx.runDust(humanCat.group.position.x, humanCat.group.position.z);
        if (Math.hypot(cvx, cvz) > 3) fx.runDust(cpuCat.group.position.x, cpuCat.group.position.z);
        if (partnerCat && Math.hypot(st.partnerX - (prevPartner?.[0] ?? st.partnerX), st.partnerZ - (prevPartner?.[1] ?? st.partnerZ)) > 3 * dt) fx.runDust(partnerCat.group.position.x, partnerCat.group.position.z);
        runT = 0.12;
      }
      shake = Math.max(0, shake - dt * 5);
      holdT = Math.max(0, holdT - dt); punch = Math.max(0, punch - dt * 14);
      const sh = shakeFx ? shake * shake * 0.07 : 0;
      pr.setCamera({ ex: st.camEX + (Math.random() - 0.5) * sh, ey: st.camEY + (Math.random() - 0.5) * sh, ez: st.camEZ, tx: st.camTX, ty: st.camTY, tz: st.camTZ, fov: st.camFov - punch - zoom });
      // weather, lamps, the dusk, the party looks
      wx.update(dt, (x, z) => fx.dust(x, z, { dust: 0xbfd8ff, dustN: 2, flecks: 0 }));
      const gloom = wx.gloom;
      const lerpL = (k) => (toLight ? baseLight[k] + (toLight[k] - baseLight[k]) * duskU : baseLight[k]);
      hemi.intensity = lerpL('hemi') * (1 - gloom); sun.intensity = lerpL('sun') * (1 - gloom * 1.4);
      if (toLight) { scene.background.copy(baseLight.sky).lerp(toLight.sky, duskU); sun.color.copy(baseLight.sunColor).lerp(toLight.sunColor, duskU); }
      if (look.disco) { sun.color.setHSL((clock * 0.35) % 1, 0.9, 0.6); hemi.color.setHSL(((clock * 0.35) + 0.5) % 1, 0.6, 0.8); } else if (hemi.color.getHex() !== 0xffffff) hemi.color.setHex(0xffffff);
      if (look.confetti && (confettiT -= dt) <= 0) { confettiT = 0.35; fx.confetti((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 18); }
      lamps.setPower(theme.to ? Math.min(1, Math.max(0, (duskU - 0.3) / 0.4)) : lampBase);
      lamps.update(dt, clock);
      trophy.update(dt);
      if (targets) targets.update(clock);
      if (trailLook) { rainbowT += dt; trailMat.color.setHSL(trailLook.rainbow ? (rainbowT * 0.8) % 1 : 0, trailLook.rainbow ? 0.9 : 0, 0.6); if (!trailLook.rainbow) trailMat.color.setHex(trailLook.color); }
      prevLab = st.labState;
      for (const fn of extras) fn(st, status, dt);
      pr.render();
    },
  };
}
