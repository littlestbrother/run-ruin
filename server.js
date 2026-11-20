// Serves the browser files and runs one game room over WebSockets.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const C = require('./public/shared.js');
const { Game } = require('./game.js');

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

const wss = new WebSocketServer({ server });
const clients = new Set(); // { ws, role: 'runner' | 'builder' | null, ready }
let game = null; // null while everyone is in the lobby
let notice = '';

const send = (c, msg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };
const holder = (role) => [...clients].find((c) => c.role === role) || null;

function broadcastLobby() {
  const runner = holder('runner'), builder = holder('builder');
  for (const c of clients) {
    send(c, {
      t: 'lobby',
      inGame: !!game,
      you: c.role,
      runner: !!runner, builder: !!builder,
      runnerReady: !!(runner && runner.ready), builderReady: !!(builder && builder.ready),
      notice,
      joinUrl: LAN_IP ? `http://${LAN_IP}:${PORT}` : '',
    });
  }
}

function backToLobby(why) {
  game = null;
  notice = why || '';
  for (const c of clients) c.ready = false;
  broadcastLobby();
}

wss.on('connection', (ws) => {
  const client = { ws, role: null, ready: false };
  clients.add(client);
  broadcastLobby();

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'role' && !game) {
      if (m.role !== 'runner' && m.role !== 'builder' && m.role !== null) return;
      if (m.role && holder(m.role) && holder(m.role) !== client) return;
      client.role = m.role;
      client.ready = false;
      notice = '';
      broadcastLobby();
    } else if (m.t === 'ready' && !game && client.role) {
      client.ready = !client.ready;
      const runner = holder('runner'), builder = holder('builder');
      if (runner && builder && runner.ready && builder.ready) { game = new Game(); notice = ''; }
      broadcastLobby();
    } else if (m.t === 'in' && game && client.role === 'runner') {
      game.setInput(m.l, m.r, m.j, m.jp);
    } else if (m.t === 'ab' && game && client.role === 'runner') {
      game.useAbility(m.i);
    } else if (m.t === 'aim' && game && client.role === 'runner') {
      game.setAim(m.x, m.y);
    } else if (m.t === 'place' && game && client.role === 'builder') {
      const reason = game.place(m.item, m.c, m.r);
      if (reason) send(client, { t: 'deny', reason });
    } else if ((m.t === 'rematch' || m.t === 'swap') && game && game.phase === 'over' && client.role) {
      if (m.t === 'swap') {
        const runner = holder('runner'), builder = holder('builder');
        if (runner) runner.role = 'builder';
        if (builder) builder.role = 'runner';
      }
      backToLobby('');
    }
  });

  ws.on('close', () => {
    clients.delete(client);
    if (game && client.role) backToLobby('The other player left.');
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
  while (acc >= STEP_MS) { game.step(); acc -= STEP_MS; stepped = true; }
  if (stepped) {
    const data = JSON.stringify(game.snapshot());
    for (const c of clients) if (c.ws.readyState === 1) c.ws.send(data);
  }
}, 4);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Game server listening on port ${PORT}`);
});
