// HTTPS + WebSocket server: game page on /, controller page on /pad.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode-terminal/vendor/QRCode/index.js';
import QRErrorCorrectLevel from 'qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel.js';
import { createHub, ROOM_RE } from './hub.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Where the server keeps what it writes and the certificate: next to the code when run from source, but in a
// per-user folder inside the Mac app (OC_DATA), since an app bundle is read-only.
const dataDir = process.env.OC_DATA || root;
const PORT = Number(process.env.PORT || 8443);
const LOCAL_PORT = Number(process.env.LOCAL_PORT || 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const OPTIONAL_JSON = new Set(['/mapping.json', '/mapping.trial.json', '/tuning.json', '/tuning.trial.json']);
const routes = [
  ['/pad', 'controller/index.html'], ['/sword', 'sword/index.html'], ['/sword/', 'sword/'], ['/train', 'game/train.html'], ['/tuning.json', 'tuning.json'], ['/tuning.trial.json', 'tuning.trial.json'], ['/mapping.json', 'mapping.json'],
  ['/controller/', 'controller/'], ['/game/', 'game/'], ['/shared/', 'shared/'],
  ['/build/', 'build/'], ['/vendor/three/', 'node_modules/three/'], ['/assets/', 'assets/'],
];

function resolve(url) {
  let p;
  try { p = decodeURIComponent(url.split('?')[0]); } catch { return null; }
  if (OPTIONAL_JSON.has(p)) return path.join(dataDir, p.slice(1));
  if (p === '/') return path.join(root, 'game/index.html');
  for (const [prefix, target] of routes) {
    if (p === prefix) return path.join(root, target);
    if (prefix.endsWith('/') && p.startsWith(prefix)) {
      const file = path.normalize(path.join(root, target, p.slice(prefix.length)));
      if (file.startsWith(path.join(root, target))) return file;
    }
  }
  return null;
}

function lanIp() {
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list) if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}

const opts = {
  key: fs.readFileSync(path.join(dataDir, 'certs/key.pem')),
  cert: fs.readFileSync(path.join(dataDir, 'certs/cert.pem')),
};
const TUNING_KEYS = ['slowSpeed', 'fastSpeed', 'openFace', 'closedFace', 'lobPath'];
// A tunnel (cloudflared, ngrok) connects from this machine, so the socket address alone says nothing:
// a request that carries proxy headers came from the internet and is never "local".
const viaProxy = (req) => ['cf-connecting-ip', 'x-forwarded-for', 'x-forwarded-host', 'forwarded', 'cf-ray', 'x-real-ip'].some((h) => req.headers[h] != null);
const isLoopback = (req) => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '') && !viaProxy(req);

// The trainer saves its fitted thresholds as a TRIAL (tuning.trial.json; the game keeps using tuning.json until you copy it over) and the raw swings (recordings/). Local only.
function saveTuning(req, res) {
  if (!isLoopback(req)) { res.writeHead(403).end('local only'); return; }
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', () => {
    try {
      const { tuning, samples, rightHanded } = JSON.parse(body);
      if (!tuning || !TUNING_KEYS.every((k) => Number.isFinite(tuning[k]))) throw new Error('bad tuning');
      const out = Object.fromEntries(TUNING_KEYS.map((k) => [k, tuning[k]]));
      fs.writeFileSync(path.join(dataDir, 'tuning.trial.json'), JSON.stringify(out, null, 2));
      fs.mkdirSync(path.join(dataDir, 'recordings'), { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'recordings', `shots-${Date.now()}.json`),
        JSON.stringify({ rightHanded, tuning: out, samples }, null, 1));
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    } catch (e) {
      res.writeHead(400).end(String(e.message));
    }
  });
}

function saveMapping(req, res) {
  if (!isLoopback(req)) { res.writeHead(403).end('local only'); return; }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
  req.on('end', () => {
    try {
      const m = JSON.parse(body);
      const out = { flipLR: !!m.flipLR, flipUD: !!m.flipUD, twist: [0, 90, 180, 270].includes(m.twist) ? m.twist : 0 };
      fs.writeFileSync(path.join(dataDir, 'mapping.trial.json'), JSON.stringify(out, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    } catch (e) {
      res.writeHead(400).end(String(e.message));
    }
  });
}

/** The phone link as a QR code (SVG), for the game page to show while a phone is missing. */
function qrSvg(text) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text); qr.make();
  const n = qr.getModuleCount(), pad = 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  const size = n + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** Where a phone can reach this server: the tunnel address for a page opened through it, else the LAN address. */
function phoneBase(req) {
  if (viaProxy(req) && process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  if (viaProxy(req)) return `https://${String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
  return `https://${lanIp()}:${PORT}`;
}
/** The phone link for a page: the controller page, with the page's room and seat when it has them. */
function padLink(req) {
  const sp = new URL(req.url, 'http://x').searchParams;
  const room = sp.get('room') || '', seat = sp.get('seat') || '';
  const q = [];
  if (ROOM_RE.test(room)) q.push(`room=${room}`);
  if (/^[12]$/.test(seat)) q.push(`seat=${seat}`);
  return `${phoneBase(req)}/pad${q.length ? `?${q.join('&')}` : ''}`;
}

const handler = (req, res) => {
  const route = req.url.split('?')[0];
  if (req.method === 'GET' && route === '/phone-qr.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }).end(qrSvg(padLink(req)));
    return;
  }
  if (req.method === 'GET' && route === '/phone-url') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(padLink(req));
    return;
  }
  // the address a friend opens to join an online match: the tunnel (PUBLIC_URL, set by scripts/online.sh) or else this Wi-Fi
  if (req.method === 'GET' && route === '/online-info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      .end(JSON.stringify({ publicUrl: process.env.PUBLIC_URL || '', lanUrl: viaProxy(req) ? '' : `https://${lanIp()}:${PORT}`, tunnel: !!process.env.PUBLIC_URL }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/tuning') { saveTuning(req, res); return; }
  if (req.method === 'POST' && req.url === '/api/mapping') { saveMapping(req, res); return; }
  const file = resolve(req.url);
  if (OPTIONAL_JSON.has(route) && (!file || !fs.existsSync(file))) { res.writeHead(204, { 'Cache-Control': 'no-store' }).end(); return; } // saved by the trainer, so it does not exist until then: "nothing yet", not an error
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
};
const server = https.createServer(opts, handler);
// Plain-http loopback server so the game page can be opened in any local browser
// without the certificate warning (motion needs https, the game page does not).
const local = http.createServer(handler);
const local6 = http.createServer(handler); // 'localhost' may resolve to ::1

const hub = createHub({ localPads: 2 }); // the local room has two phone seats for two-player matches; online rooms have one
const sockets = [];
for (const srv of [server, local, local6]) {
  const wss = new WebSocketServer({ server: srv, path: '/ws' });
  sockets.push(wss);
  wss.on('connection', (ws, req) => {
    const sp = new URL(req.url, 'https://x').searchParams;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const seat = Number(sp.get('seat')) - 1;
    hub.attach(ws, sp.get('role'), { room: sp.get('room') || '', match: sp.get('match') || '', seat: Number.isInteger(seat) ? seat : -1, remote: viaProxy(req) });
  });
}
// Drop half-open sockets (phone screen lock, WiFi change) so the controller slot frees up.
setInterval(() => {
  for (const wss of sockets) for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 5000).unref();
local.listen(LOCAL_PORT, '127.0.0.1');
local6.on('error', () => {}); // no IPv6 loopback: ignore
local6.listen(LOCAL_PORT, '::1');

server.listen(PORT, () => {
  const ip = lanIp();
  console.log(`Game:  http://localhost:${LOCAL_PORT}/  (or https://localhost:${PORT}/)`);
  console.log(`Phone: https://${ip}:${PORT}/pad`);
  qrcode.generate(`https://${ip}:${PORT}/pad`, { small: true });
});
