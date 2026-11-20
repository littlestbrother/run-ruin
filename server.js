// Serves the browser files and runs one game room over WebSockets.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const C = require('./public/shared.js');
const { Game } = require('./game.js');
const { BuilderBot } = require('./bot.js');

const PORT = Number(process.env.PORT) || 8080;
const LAN_IP = process.env.LAN_IP || '';
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// Up to two runners on one team against one builder, who is a person or the CPU.
const SEATS = ['runner1', 'runner2', 'builder'];
const RUNNER_SEATS = ['runner1', 'runner2'];

const wss = new WebSocketServer({ server });
const clients = new Set(); // { ws, role: one of SEATS or null (watching), ready, pidx: which runner they control in the current game }
let game = null; // null while everyone is in the lobby
let bot = null; // the CPU builder for the current game, if any
let cpu = false; // lobby setting: the CPU takes the builder seat
let cpuLevel = 1; // goes up each time the runners beat the CPU
let scored = false; // the current game's result has been counted
let notice = '';

const send = (c, msg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };
const holder = (role) => [...clients].find((c) => c.role === role) || null;

function broadcastLobby() {
  const seats = {};
  for (const s of SEATS) { const h = holder(s); seats[s] = { taken: !!h, ready: !!(h && h.ready) }; }
  for (const c of clients) {
    send(c, {
      t: 'lobby',
      inGame: !!game,
      you: c.role,
      me: c.pidx,
      seats,
      cpu,
      cpuLevel,
      notice,
      joinUrl: LAN_IP ? `http://${LAN_IP}:${PORT}` : '',
    });
  }
}

function backToLobby(why) {
  game = null;
  bot = null;
  notice = why || '';
  for (const c of clients) { c.ready = false; c.pidx = -1; }
  broadcastLobby();
}

// Starts once everyone seated is ready, with at least one runner and a builder of some kind.
function maybeStart() {
  const seated = [...clients].filter((c) => c.role);
  const runners = RUNNER_SEATS.map(holder).filter(Boolean);
  if (!runners.length || !(holder('builder') || cpu) || !seated.every((c) => c.ready)) return;
  runners.forEach((c, i) => { c.pidx = i; });
  game = new Game({ runners: runners.length });
  bot = cpu ? new BuilderBot(cpuLevel) : null;
  scored = false;
  notice = '';
}

wss.on('connection', (ws) => {
  const client = { ws, role: null, ready: false, pidx: -1 };
  clients.add(client);
  broadcastLobby();

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'role' && !game) {
      if (m.role !== null && !SEATS.includes(m.role)) return;
      if (m.role && holder(m.role) && holder(m.role) !== client) return;
      client.role = m.role;
      client.ready = false;
      if (m.role === 'builder') cpu = false; // a person in the seat replaces the CPU
      notice = '';
      broadcastLobby();
    } else if (m.t === 'cpu' && !game) {
      if (holder('builder')) return;
      cpu = !!m.on;
      notice = '';
      broadcastLobby();
    } else if (m.t === 'ready' && !game && client.role) {
      client.ready = !client.ready;
      maybeStart();
      broadcastLobby();
    } else if (m.t === 'in' && game && client.pidx >= 0) {
      game.setInput(m.l, m.r, m.j, m.jp, client.pidx);
    } else if (m.t === 'ab' && game && client.pidx >= 0) {
      game.useAbility(m.i, client.pidx);
    } else if (m.t === 'aim' && game && client.pidx >= 0) {
      game.setAim(m.x, m.y, client.pidx);
    } else if (m.t === 'place' && game && client.role === 'builder') {
      const reason = game.place(m.item, m.c, m.r);
      if (reason) send(client, { t: 'deny', reason });
    } else if ((m.t === 'rematch' || m.t === 'swap') && game && game.phase === 'over' && client.role) {
      if (m.t === 'swap') {
        // everyone seated moves along one seat: runner 1 -> runner 2 -> builder -> runner 1
        const seated = SEATS.map(holder).filter(Boolean);
        const roles = seated.map((c) => c.role);
        seated.forEach((c, i) => { c.role = roles[(i + 1) % roles.length]; });
      }
      backToLobby(cpu ? `CPU builder is level ${cpuLevel}.` : '');
    }
  });

  ws.on('close', () => {
    clients.delete(client);
    if (game && client.role) backToLobby('A player left.');
    else broadcastLobby();
  });
  ws.on('error', () => {});
});

// Fixed 60 steps per second, however unevenly the timer fires.
const STEP_MS = 1000 / C.FPS;
let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += now - last;
  last = now;
  if (!game) { acc = 0; return; }
  if (acc > 250) acc = STEP_MS; // the process stalled; don't fast-forward
  let stepped = false;
  while (acc >= STEP_MS) {
    if (bot) bot.think(game);
    game.step();
    acc -= STEP_MS;
    stepped = true;
  }
  if (game.phase === 'over' && !scored) {
    scored = true;
    if (bot && game.winner === 'runner') cpuLevel++; // beat the CPU and it comes back tougher
  }
  if (stepped) {
    const data = JSON.stringify(game.snapshot());
    for (const c of clients) if (c.ws.readyState === 1) c.ws.send(data);
  }
}, 4);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Game server listening on port ${PORT}`);
});
