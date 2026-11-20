// The whole game simulation. No networking in here: the server feeds it
// inputs and placement requests, calls step() 60 times a second, and sends
// snapshot() to the browsers.
const C = require('./public/shared.js');

const T = C.TILE;
const GROUND_Y = C.GROUND_ROW * T;
const VIEW_W = C.VIEW_COLS * T;
const BUILD_W = C.BUILDER_COLS * T;

const GRAVITY = 0.32;
const MAX_FALL = 6;
const RUN_ACC = 0.25;
const RUN_MAX = 1.75;
const FRICTION = 0.2;
const JUMP_V = -5.4;
const DOUBLE_JUMP_V = -4.6;
const WALL_JUMP_V = -5.0;
const WALL_KICK_TICKS = 8; // after kicking off a wall, steering is ignored this long so the kick carries
const WALL_GRACE_TICKS = 6; // a wall still counts for this long after letting go of it
const WALL_SLIDE_V = 1.2; // fall speed while pressing into a wall
const FLY_SPEED = 2.4;
const EXPLODE_RADIUS = 52;
const CAMERA_LEAD = 112; // runner's furthest screen x before the camera follows
const SCROLL_START = 0.5;
const SCROLL_END = 0.9;
const MAX_ENTS = 80;

// The "can the runner still get through?" check plays out real jumps, but with
// a slower run than the runner really has, so any route it finds has slack.
const ROUTE_RUN_MAX = 1.3;
const ROUTE_NODE_BUDGET = 300;
const ROUTE_GRID_COLS = C.BUILDER_COLS + 8;
const GOAL = Symbol('goal');

const SOLID_TILES = { block: true, crumble: true, cannon: true, flame: true };
const FLOOR_TILES = { spike: true, mine: true, spring: true, ice: true, goo: true }; // must sit on something solid
const BRICK = Object.fromEntries(C.BRICKS.items.map((id) => [id, true]));
const BRICK_LOCK_TICKS = C.BRICKS.cooldown * C.FPS;
const ENT_ITEMS = { slime: true, bat: true, saw: true, crusher: true, ghost: true, hopper: true, thorn: true };
const STOMPABLE = Object.fromEntries(C.STOMPABLE.map((t) => [t, true])); // land on top to destroy
const WIND_PUSH = 0.7;
const SPRING_V = -8.5;
const SAW_REACH = 32; // how far a saw slides either side of where it was placed
const GHOST_SPEED = 0.9;
const FLAME_CYCLE = 150, FLAME_WARM_AT = 70, FLAME_ON_AT = 90;
const ITEM_BY_ID = Object.fromEntries(C.ITEMS.map((i) => [i.id, i]));
const ABILITY_INDEX = Object.fromEntries(C.ABILITIES.map((a, i) => [a.id, i]));
const key = (c, r) => c + ',' + r;
const r1 = (n) => Math.round(n * 10) / 10;

// Moves tried from every standing spot by the route check:
// [direction, frames the direction is held, jump?, frame of the second jump (-1 = none)]
const ROUTE_MOVES = (() => {
  const second = [-1, 8, 17, 26, 32];
  const moves = [[1, Infinity, false, -1]]; // just walk right
  for (const d2 of second) moves.push([1, Infinity, true, d2]);
  for (const hold of [14, 28]) for (const d2 of second) moves.push([1, hold, true, d2]);
  moves.push([1, 5, false, -1], [-1, 5, false, -1]);
  for (const d2 of second) moves.push([-1, Infinity, true, d2]);
  return moves;
})();

class Game {
  constructor() {
    this.phase = 'countdown'; // countdown -> play -> over
    this.countdown = C.COUNTDOWN_SECONDS * C.FPS;
    this.tick = 0;
    this.seed = Math.floor(Math.random() * 1e9); // picks this round's order of backgrounds, same for both players
    this.timeLeft = C.ROUND_SECONDS * C.FPS;
    this.camX = 0;
    this.credits = C.START_CREDITS;
    this.creditAcc = 0;
    this.tier = 0;
    this.tiles = new Map(); // "c,r" -> {c, r, type, spawn, timer, fire}
    this.pits = new Set(); // column numbers with no ground
    this.ents = [];
    this.fx = []; // short-lived visuals: laser beams and explosions
    this.nextId = 1;
    this.events = [];
    this.winner = null;
    this.input = { l: false, r: false, j: false };
    this.lifeTimer = randTicks(C.LIFE_FIRST_SECONDS); // ticks of play until the next +1 pickup
    this.brickCount = 0; // bricks placed in the current burst
    this.brickIdle = 0; // ticks since the last brick
    this.brickLock = 0; // ticks until bricks can be placed again
    this.itemCd = {}; // item id -> ticks until the builder may place it again
    this.wind = 0; // ticks of headwind left
    this.fog = 0; // ticks of fog left
    this.aim = null; // where the runner's mouse is on their screen, for flying
    this.abil = C.ABILITIES.map(() => ({ unlocked: false, active: 0, cd: 0 }));
    this.player = {
      x: 40, y: GROUND_Y - 14, w: 10, h: 14, vx: 0, vy: 0,
      onGround: true, facing: 1, airJumps: 1, coyote: 0, jumpBuf: 0,
      invuln: 0, lives: C.LIVES, launch: 0,
      lastWall: null, // column of the wall last kicked off; cleared on landing
      wallLock: 0, sliding: 0, spin: null,
      wallSide: 0, wallCol: 0, wallGrace: 0, // the wall being touched, or touched a moment ago
    };
  }

  // ---------- world queries ----------

  solidAt(c, r) {
    if (r < 0 || r >= C.ROWS) return false;
    if (r >= C.GROUND_ROW) return !this.pits.has(c);
    const t = this.tiles.get(key(c, r));
    return !!t && SOLID_TILES[t.type] === true;
  }

  collides(b) {
    const c0 = Math.floor(b.x / T), c1 = Math.floor((b.x + b.w - 0.001) / T);
    const r0 = Math.floor(b.y / T), r1_ = Math.floor((b.y + b.h - 0.001) / T);
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1_; r++) if (this.solidAt(c, r)) return true;
    return false;
  }

  // Moves a box by its velocity, stopping at solid tiles.
  moveBody(b) {
    let hitX = false;
    b.x += b.vx;
    if (b.vx !== 0 && this.collides(b)) {
      if (b.vx > 0) b.x = Math.floor((b.x + b.w - 0.001) / T) * T - b.w;
      else b.x = (Math.floor(b.x / T) + 1) * T;
      b.vx = 0;
      hitX = true;
    }
    b.y += b.vy;
    b.onGround = false;
    if (this.collides(b)) {
      if (b.vy > 0) {
        b.y = Math.floor((b.y + b.h - 0.001) / T) * T - b.h;
        b.onGround = true;
      } else {
        b.y = (Math.floor(b.y / T) + 1) * T;
      }
      b.vy = 0;
    }
    return hitX;
  }

  secondsSurvived() {
    return C.ROUND_SECONDS - this.timeLeft / C.FPS;
  }

  // ---------- route check: can the runner still get past everything? ----------

  // A copy of the solid tiles the builder can reach, with one optional change
  // applied, that shares the real collision code.
  routeWorld(change, withoutCrumbles) {
    const c0 = Math.floor(this.camX / T) - 2;
    const n = ROUTE_GRID_COLS, R = C.ROWS;
    const g = new Uint8Array(n * R);
    for (let i = 0; i < n; i++) {
      if (this.pits.has(c0 + i) || (change.pits && change.pits.includes(c0 + i))) continue;
      for (let r = C.GROUND_ROW; r < R; r++) g[i * R + r] = 1;
    }
    const put = (t) => {
      if (!SOLID_TILES[t.type] || (withoutCrumbles && t.type === 'crumble')) return;
      const i = t.c - c0;
      if (i >= 0 && i < n) g[i * R + t.r] = 1;
    };
    for (const t of this.tiles.values()) put(t);
    if (change.tile) put(change.tile);
    return {
      solidAt(c, r) {
        if (r < 0 || r >= R) return false;
        const i = c - c0;
        if (i < 0) return false;
        if (i >= n) return r >= C.GROUND_ROW; // untouched ground beyond the builder's reach
        return g[i * R + r] === 1;
      },
      collides: Game.prototype.collides,
      moveBody: Game.prototype.moveBody,
    };
  }

  // Plays one move with the runner's physics. Returns where the runner comes
  // to rest, GOAL if they get clear of the builder's area, or null if they die.
  routeMove(world, x, y, dir, hold, jump, d2, minX, goalX) {
    const b = { x, y, w: 10, h: 14, vx: 0, vy: jump ? JUMP_V : 0, onGround: false };
    let landed = false;
    for (let f = 0; f < 420; f++) {
      const want = !landed && f < hold ? dir : 0;
      if (want < 0) b.vx = Math.max(b.vx - RUN_ACC, -ROUTE_RUN_MAX);
      else if (want > 0) b.vx = Math.min(b.vx + RUN_ACC, ROUTE_RUN_MAX);
      else if (b.vx > 0) b.vx = Math.max(0, b.vx - FRICTION);
      else if (b.vx < 0) b.vx = Math.min(0, b.vx + FRICTION);
      if (jump && !landed && f === d2) b.vy = DOUBLE_JUMP_V;
      b.vy = Math.min(b.vy + GRAVITY, MAX_FALL);
      world.moveBody(b);
      if (b.x < minX || b.y > C.ROWS * T) return null;
      if (b.x >= goalX) return GOAL;
      if (b.onGround) {
        if (jump || f >= hold) landed = true;
        if (b.vx === 0 && f > 0) return b;
      }
    }
    return null;
  }

  // Searches standing spots reachable from `start` (default: the runner).
  pathExists(change, withoutCrumbles, start) {
    const world = this.routeWorld(change, withoutCrumbles);
    const minX = this.camX;
    const goalX = (Math.floor(this.camX / T) + C.BUILDER_COLS + 1) * T; // first column the builder has never been able to touch
    const from = start || this.player;
    const open = [], seen = new Set();
    const add = (b) => {
      if (!b || b === GOAL) return;
      const k = Math.round(b.x / 8) + ',' + Math.round(b.y);
      if (!seen.has(k)) { seen.add(k); open.push({ x: b.x, y: b.y }); }
    };
    const sx = Math.max(from.x, minX);
    for (const [dir, hold] of [[0, 0], [1, 30], [-1, 30]]) {
      const b = this.routeMove(world, sx, from.y, dir, hold, false, -1, minX, goalX);
      if (b === GOAL) return true;
      add(b);
      if (open.length) break; // already standing somewhere; no need to try drifting
    }
    if (!open.length) return true; // the runner is falling to their death anyway
    for (let budget = ROUTE_NODE_BUDGET; open.length && budget > 0; budget--) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i].x > open[best].x) best = i;
      const node = open[best];
      open[best] = open[open.length - 1];
      open.pop();
      for (const [dir, hold, jump, d2] of ROUTE_MOVES) {
        const b = this.routeMove(world, node.x, node.y, dir, hold, jump, d2, minX, goalX);
        if (b === GOAL) return true;
        add(b);
      }
    }
    return false;
  }

  // A crumble block may be there or gone by the time the runner arrives, so
  // the route has to work both ways.
  routeOk(change) {
    if (!this.pathExists(change, false)) return false;
    let crumbles = change.tile && change.tile.type === 'crumble';
    if (!crumbles) for (const t of this.tiles.values()) if (t.type === 'crumble') { crumbles = true; break; }
    return !crumbles || this.pathExists(change, true);
  }

  // ---------- inputs from the two players ----------

  setInput(l, r, j, pressed) {
    this.input.l = !!l;
    this.input.r = !!r;
    this.input.j = !!j;
    if (pressed) this.player.jumpBuf = 7;
  }

  setAim(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.aim = { x: Math.max(0, Math.min(VIEW_W, x)), y: Math.max(0, Math.min(C.ROWS * T, y)) };
  }

  // Returns true if the move fired.
  useAbility(i) {
    const def = C.ABILITIES[i], a = this.abil[i];
    if (!def || this.phase !== 'play' || !a.unlocked || a.cd > 0 || a.active > 0) return false;
    a.active = def.duration * C.FPS;
    a.cd = (def.duration + def.cooldown) * C.FPS;
    const p = this.player;
    if (def.id === 'triple') { p.airJumps++; this.events.push('power'); }
    else if (def.id === 'laser') this.fireLaser();
    else if (def.id === 'explode') this.explode();
    else if (def.id === 'fly') { p.vy = Math.min(p.vy, 0); this.events.push('power'); }
    return true;
  }

  fireLaser() {
    const p = this.player, dir = p.facing;
    const y = p.y + 3;
    const row = Math.floor((y + 2) / T);
    const startX = dir > 0 ? p.x + p.w : p.x;
    let endX = dir > 0 ? this.camX + VIEW_W : this.camX;
    const cEnd = Math.floor(endX / T);
    for (let c = Math.floor(startX / T); dir > 0 ? c <= cEnd : c >= cEnd; c += dir) {
      const t = this.tiles.get(key(c, row));
      if (t && SOLID_TILES[t.type]) { // burns through the first block, then stops
        this.tiles.delete(key(c, row));
        endX = dir > 0 ? c * T + T : c * T;
        break;
      }
      if (this.solidAt(c, row)) { endX = dir > 0 ? c * T : c * T + T; break; }
    }
    const x1 = Math.min(startX, endX), x2 = Math.max(startX, endX);
    for (const e of this.ents) {
      if (e.warn > 0 || e.type === 'debris' || e.type === 'life') continue;
      if (overlap(x1, y - 1, x2 - x1, 7, e.x, e.y, e.w, e.h)) e.dead = true;
    }
    this.fx.push({ k: 'laser', a: r1(x1), b: r1(y), c: r1(x2), ttl: 12 });
    this.events.push('laser');
  }

  explode() {
    const p = this.player;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    for (const [k, t] of this.tiles) {
      if (Math.hypot(t.c * T + T / 2 - cx, t.r * T + T / 2 - cy) <= EXPLODE_RADIUS) this.tiles.delete(k);
    }
    for (const e of this.ents) {
      if (e.warn > 0 || e.type === 'life') continue;
      if (Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) <= EXPLODE_RADIUS + 6) e.dead = true;
    }
    p.invuln = Math.max(p.invuln, 30);
    this.fx.push({ k: 'boom', a: r1(cx), b: r1(cy), c: EXPLODE_RADIUS, ttl: 24 });
    this.events.push('boom');
  }

  // Returns null when the placement happened, otherwise a short reason.
  place(itemId, c, r) {
    const item = ITEM_BY_ID[itemId];
    if (!item || !Number.isInteger(c) || !Number.isInteger(r)) return 'bad request';
    if (this.phase === 'over') return 'round over';
    if (this.credits < item.cost) return 'not enough credits';
    if (this.itemCd[itemId] > 0 || (BRICK[itemId] && this.brickLock > 0)) return 'recharging';
    let wait = item.cooldown;
    const camCol = Math.floor(this.camX / T);
    const p = this.player;

    if (itemId === 'wind' || itemId === 'fog') {
      // Whole-screen effects: where the builder clicks doesn't matter.
      if (this.phase !== 'play') return 'wait for the round to start';
      if (this[itemId] > 0) return 'already active';
      const secs = itemId === 'wind' ? C.WIND_SECONDS : C.FOG_SECONDS;
      this[itemId] = secs * C.FPS;
      wait += secs;
      this.events.push(itemId);
    } else if (itemId === 'boulder') {
      // Boulders may be dropped anywhere on the runner's screen; they are
      // announced with a warning marker before they fall.
      if (c < camCol || c > camCol + C.VIEW_COLS) return 'out of range';
      if (this.ents.length >= MAX_ENTS) return 'too many things';
      this.ents.push({ id: this.nextId++, type: 'boulder', x: c * T + 1, y: -16, w: 14, h: 14, vx: 0, vy: 0, warn: C.BOULDER_WARN_TICKS, spawn: 0, t: 0 });
      this.events.push('warn');
    } else {
      // The builder's picture shows a sliver of one more column at its right edge; that one counts too.
      if (c < camCol || c > camCol + C.BUILDER_COLS) return 'out of range';
      const playerCol = Math.floor((p.x + p.w / 2) / T);
      if (c < playerCol + C.MIN_BUILD_DIST_COLS) return 'too close to runner';

      if (itemId === 'pit') {
        // One click digs two columns. If that would be too wide to jump, dig one.
        const cols = [c, c + 1].filter((x) => !this.pits.has(x) && x <= camCol + C.BUILDER_COLS);
        if (!cols.length) return 'already a pit';
        let dig = cols;
        if (this.wouldBlock({ pits: dig })) {
          dig = cols.slice(0, 1);
          if (cols.length === 1 || this.wouldBlock({ pits: dig })) return 'would block the path';
        }
        for (const x of dig) this.pits.add(x);
      } else {
        if (r < 0 || r >= C.GROUND_ROW) return 'out of range';
        if (this.tiles.has(key(c, r))) return 'occupied';
        if (!ENT_ITEMS[itemId] && this.ents.some((e) => e.type === 'life' && overlap(e.x, e.y, e.w, e.h, c * T, r * T, T, T))) return "can't cover the +1";
        if (ENT_ITEMS[itemId]) {
          if (this.ents.length >= MAX_ENTS) return 'too many things';
          const e = this.makeEnt(itemId, c, r);
          if (e.solid && this.collides(e)) return 'no room here';
          this.ents.push(e);
        } else {
          if (FLOOR_TILES[itemId] && !this.solidAt(c, r + 1)) return 'needs a floor under it';
          if (SOLID_TILES[itemId] && this.wouldBlock({ tile: { c, r, type: itemId } })) return 'would block the path';
          this.tiles.set(key(c, r), { c, r, type: itemId, spawn: C.SPAWN_TICKS, timer: 0, fire: 60, age: 0, on: 0, warm: false });
        }
      }
      this.events.push('place');
    }
    this.credits -= item.cost;
    if (wait > 0) this.itemCd[itemId] = wait * C.FPS;
    if (BRICK[itemId]) {
      this.brickIdle = 0;
      if (++this.brickCount >= C.BRICKS.burst) this.brickLock = BRICK_LOCK_TICKS;
    }
    return null;
  }

  // Puts a +1 life pickup somewhere ahead of the runner that a normal jump can
  // reach: over solid ground, at most three tiles up, with nothing underneath it.
  spawnLife() {
    if (this.ents.some((e) => e.type === 'life')) return false; // one at a time
    const camCol = Math.floor(this.camX / T);
    for (let tries = 0; tries < 12; tries++) {
      const c = camCol + 11 + Math.floor(Math.random() * 8);
      const r = C.GROUND_ROW - 1 - Math.floor(Math.random() * 3);
      if (!this.solidAt(c, C.GROUND_ROW)) continue;
      let clear = true;
      for (let rr = r; rr < C.GROUND_ROW; rr++) if (this.tiles.has(key(c, rr))) clear = false;
      if (!clear) continue;
      this.ents.push({ id: this.nextId++, type: 'life', x: c * T + 1, y: r * T + 2, w: 14, h: 12, vx: 0, vy: 0, spawn: 0, t: 0 });
      this.events.push('lifeup');
      return true;
    }
    return false;
  }

  cdTotal(item) {
    const extra = item.id === 'wind' ? C.WIND_SECONDS : item.id === 'fog' ? C.FOG_SECONDS : 0;
    return (item.cooldown + extra) * C.FPS;
  }

  makeEnt(type, c, r) {
    const e = { id: this.nextId++, type, x: c * T + 2, y: r * T + 2, w: 12, h: 12, vx: 0, vy: 0, spawn: C.SPAWN_TICKS, t: 0 };
    if (type === 'slime' || type === 'thorn') { e.x = c * T - 2; e.y = r * T; e.w = 20; e.h = 16; e.solid = true; }
    else if (type === 'hopper') { e.x = c * T + 1; e.y = r * T + 4; e.w = 14; e.h = 12; e.t2 = 20; e.solid = true; }
    else if (type === 'bat') { e.x = c * T - 2; e.y = r * T + 1; e.w = 20; e.h = 14; e.baseY = e.y; }
    else if (type === 'saw') { e.x = c * T + 1; e.y = r * T + 1; e.w = 14; e.h = 14; e.home = e.x; e.dir = 1; }
    else if (type === 'crusher') { e.x = c * T + 1; e.y = r * T; e.w = 14; e.h = 16; e.home = e.y; e.state = 'wait'; e.t2 = 0; }
    else if (type === 'ghost') e.life = C.GHOST_SECONDS * C.FPS;
    return e;
  }

  // True when this change is what closes off the runner's last way through.
  // (If they are already stuck, e.g. they dropped into a hole, it isn't.)
  wouldBlock(change) {
    return !this.routeOk(change) && this.routeOk({});
  }

  // ---------- simulation ----------

  step() {
    if (this.phase === 'over') return;
    this.tick++;
    for (const id in this.itemCd) if (this.itemCd[id] > 0) this.itemCd[id]--;
    if (this.brickLock > 0) { if (--this.brickLock === 0) this.brickCount = 0; }
    else if (this.brickCount > 0 && ++this.brickIdle >= BRICK_LOCK_TICKS) this.brickCount = 0; // slow building never locks
    if (this.phase === 'countdown') {
      this.countdown--;
      if (this.countdown <= 0) { this.phase = 'play'; this.events.push('go'); }
    } else {
      this.timeLeft--;
      if (this.timeLeft % C.FPS === 0 && this.timeLeft <= 10 * C.FPS && this.timeLeft > 0) this.events.push('beep');
      const secs = this.secondsSurvived();

      let tier = 0;
      for (let i = 0; i < C.CREDIT_TIERS.length; i++) if (secs >= C.CREDIT_TIERS[i].from) tier = i;
      if (tier !== this.tier) { this.tier = tier; this.events.push('tier'); }
      this.creditAcc += C.CREDIT_TIERS[tier].perSecond / C.FPS;
      while (this.creditAcc >= 1) {
        this.creditAcc -= 1;
        if (this.credits < C.CREDIT_TIERS[tier].cap) this.credits++;
      }

      if (this.wind > 0) this.wind--;
      if (--this.lifeTimer <= 0) this.lifeTimer = this.spawnLife() ? randTicks(C.LIFE_EVERY_SECONDS) : C.FPS;
      if (this.fog > 0) this.fog--;

      this.abil.forEach((a, i) => {
        if (!a.unlocked && secs >= C.ABILITIES[i].unlock) { a.unlocked = true; this.events.push('unlock' + i); }
        if (a.active > 0) a.active--;
        if (a.cd > 0) a.cd--;
      });

      const progress = 1 - this.timeLeft / (C.ROUND_SECONDS * C.FPS);
      this.camX += SCROLL_START + (SCROLL_END - SCROLL_START) * progress;
    }

    this.stepPlayer();
    this.stepTiles();
    this.stepEnts();
    this.cleanup();
    if (this.fx.length) {
      for (const f of this.fx) f.ttl--;
      this.fx = this.fx.filter((f) => f.ttl > 0);
    }

    if (this.phase === 'play' && this.timeLeft <= 0) this.finish('runner');
  }

  finish(winner) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.winner = winner;
    this.events.push(winner === 'runner' ? 'win' : 'lose');
  }

  // Which side the airborne runner is touching a wall on: -1 left, 1 right, 0 neither.
  wallBeside(p) {
    if (this.collides({ x: p.x - 1, y: p.y, w: p.w, h: p.h })) return -1;
    if (this.collides({ x: p.x + 1, y: p.y, w: p.w, h: p.h })) return 1;
    return 0;
  }

  // A somersault, shown in quarter turns. `dir` is 1 for clockwise.
  startSpin(turns, dir) {
    this.player.spin = { t: 0, total: turns > 1 ? 26 : 18, turns, dir };
  }

  maxAirJumps() {
    return this.abil[ABILITY_INDEX.triple].active > 0 ? 2 : 1;
  }

  stepPlayer() {
    const p = this.player, inp = this.input;
    const prevBottom = p.y + p.h;
    const flying = this.abil[ABILITY_INDEX.fly].active > 0;
    if (p.spin && (++p.spin.t >= p.spin.total || p.onGround || flying)) p.spin = null;
    p.sliding = 0;

    if (flying) {
      // Glide toward the mouse pointer; gravity is off.
      let dx = 0, dy = 0;
      if (this.aim) {
        dx = this.camX + this.aim.x - (p.x + p.w / 2);
        dy = this.aim.y - (p.y + p.h / 2);
      }
      const clamp = (v) => Math.max(-FLY_SPEED, Math.min(FLY_SPEED, v / 4));
      const tx = clamp(dx), ty = clamp(dy);
      p.vx += (tx - p.vx) * 0.3;
      p.vy += (ty - p.vy) * 0.3;
      if (Math.abs(dx) > 3) p.facing = dx > 0 ? 1 : -1;
      p.jumpBuf = 0;
    } else {
      // Ice and goo change how the ground under the runner's feet behaves.
      let acc = RUN_ACC, max = RUN_MAX, friction = FRICTION;
      if (p.onGround) {
        const under = this.tiles.get(key(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h - 1) / T)));
        if (under && under.spawn === 0) {
          if (under.type === 'ice') { acc = 0.05; friction = 0.012; }
          else if (under.type === 'goo') max = 0.7;
        }
      }
      if (p.wallLock > 0) p.wallLock--; // mid wall-kick: keep flying away from the wall
      else if (inp.l && !inp.r) { p.vx = Math.max(p.vx - acc, -max); p.facing = -1; }
      else if (inp.r && !inp.l) { p.vx = Math.min(p.vx + acc, max); p.facing = 1; }
      else if (p.vx > 0) p.vx = Math.max(0, p.vx - friction);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + friction);

      if (p.onGround) { p.coyote = 6; p.airJumps = this.maxAirJumps(); p.lastWall = null; } else if (p.coyote > 0) p.coyote--;
      const wall = p.onGround || p.coyote > 0 ? 0 : this.wallBeside(p);
      if (p.onGround) p.wallGrace = 0;
      else if (wall) {
        p.wallSide = wall; p.wallGrace = WALL_GRACE_TICKS;
        // the column the 1-pixel probe in wallBeside() found solid
        p.wallCol = wall < 0 ? Math.floor((p.x - 1) / T) : Math.floor((p.x + p.w + 0.999) / T);
      } else if (p.wallGrace > 0) p.wallGrace--;
      // A wall jump needs the runner to be pushing away from the wall. Pushing into it,
      // or not steering, leaves the ordinary double jump alone for getting up and over.
      const kick = p.wallGrace > 0 ? p.wallSide : 0;
      const pushingAway = kick < 0 ? inp.r && !inp.l : kick > 0 ? inp.l && !inp.r : false;
      if (p.jumpBuf > 0) {
        if (p.coyote > 0) { p.vy = JUMP_V; p.coyote = 0; p.jumpBuf = 0; this.events.push('jump'); }
        else if (kick && pushingAway && p.wallCol !== p.lastWall) {
          // Wall jump: a free extra jump up and away, but never off the same wall twice running.
          p.vy = WALL_JUMP_V; p.vx = -kick * RUN_MAX; p.facing = -kick;
          p.wallLock = WALL_KICK_TICKS; p.launch = 14; p.lastWall = p.wallCol; p.wallGrace = 0; p.jumpBuf = 0;
          this.startSpin(1, -kick);
          this.fx.push({ k: 'puff', a: r1(kick < 0 ? p.x : p.x + p.w), b: r1(p.y + p.h - 2), c: kick, ttl: 12 });
          this.events.push('walljump');
        } else if (p.airJumps > 0) {
          p.vy = DOUBLE_JUMP_V; p.airJumps--; p.jumpBuf = 0;
          this.startSpin(p.airJumps === 0 && this.maxAirJumps() === 2 ? 2 : 1, p.facing); // the triple jump is a double somersault
          this.events.push('jump2');
        } else p.jumpBuf--;
      }
      if (p.launch > 0) p.launch--; // a spring launch can't be cut short
      else if (!inp.j && p.vy < -2) p.vy = -2; // letting go of jump early makes a short hop
      p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);
      // Pressing into a wall on the way down turns the fall into a slow slide.
      if (wall && p.vy > WALL_SLIDE_V && (wall < 0 ? inp.l : inp.r)) { p.vy = WALL_SLIDE_V; p.sliding = wall; }
    }

    this.moveBody(p);
    if (flying && p.y < 0) { p.y = 0; p.vy = 0; }
    if (this.wind > 0) { // headwind shoves the runner back unless something is in the way
      p.x -= WIND_PUSH;
      if (this.collides(p)) p.x += WIND_PUSH;
    }
    if (p.invuln > 0) p.invuln--;

    // The camera never moves backwards, and follows the runner if they push ahead.
    if (p.x - CAMERA_LEAD > this.camX) this.camX = p.x - CAMERA_LEAD;

    // Standing on a crumble block starts it breaking.
    if (p.onGround) {
      const r = Math.floor((p.y + p.h + 1) / T);
      for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w - 0.001) / T); c++) {
        const t = this.tiles.get(key(c, r));
        if (t && t.type === 'crumble' && t.timer === 0) { t.timer = 28; this.events.push('crack'); }
      }
    }

    // Fell in a pit, or got shoved off the left edge of the screen.
    if (p.y > C.ROWS * T + 16) return this.loseLife(true);
    if (p.x < this.camX) {
      p.x = this.camX;
      if (this.collides(p)) return this.loseLife(true);
    }

    // Touching a spring from above throws the runner into the air.
    const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w) / T);
    const r0 = Math.floor(p.y / T), r1_ = Math.floor((p.y + p.h) / T);
    if (p.vy >= 0 && !flying) {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1_; r++) {
        const t = this.tiles.get(key(c, r));
        if (t && t.type === 'spring' && t.spawn === 0 && overlap(p.x, p.y, p.w, p.h, c * T + 2, r * T + 8, 12, 8)) {
          p.vy = SPRING_V; p.launch = 45; p.airJumps = this.maxAirJumps();
          t.timer = 12;
          this.events.push('boing');
        }
      }
    }

    // Grabbing a +1 pickup.
    for (const e of this.ents) {
      if (e.type !== 'life' || e.dead || !overlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
      e.dead = true;
      if (p.lives < C.MAX_LIVES) p.lives++;
      this.events.push('life');
    }

    if (p.invuln > 0) return;

    // Spikes: only the pointy lower half hurts.
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1_; r++) {
      const t = this.tiles.get(key(c, r));
      if (t && t.type === 'spike' && t.spawn === 0 &&
          overlap(p.x, p.y, p.w, p.h, c * T + 3, r * T + 8, 10, 8)) return this.loseLife(false);
    }

    for (const e of this.ents) {
      if (e.dead || e.spawn > 0 || e.warn > 0 || e.type === 'debris' || e.type === 'life') continue;
      if (!overlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
      if (STOMPABLE[e.type] && p.vy > 0 && prevBottom <= e.y + 7) {
        e.dead = true;
        p.vy = -4.5;
        p.airJumps = this.maxAirJumps();
        this.events.push('stomp');
      } else {
        return this.loseLife(false);
      }
    }
  }

  loseLife(respawn) {
    const p = this.player;
    if (this.phase === 'play' && (p.invuln === 0 || respawn)) {
      // A pit while already blinking from a hit still costs a life: pits are always deadly.
      p.lives--;
      this.events.push('hurt');
      if (p.lives <= 0) { p.lives = 0; return this.finish('builder'); }
    }
    p.invuln = 120;
    if (respawn) this.respawn(); else p.vy = -3.5;
  }

  // Back onto solid ground near the left of the screen, preferring a spot the
  // runner can actually carry on from.
  respawn() {
    const p = this.player;
    const start = Math.floor(this.camX / T) + 3;
    p.vx = 0; p.vy = 0; p.wallLock = 0; p.wallGrace = 0; p.spin = null; p.lastWall = null;
    let fallback = null;
    for (let c = start; c < start + 10; c++) {
      if (!this.solidAt(c, C.GROUND_ROW)) continue;
      if (this.tiles.get(key(c, C.GROUND_ROW - 1)) || this.tiles.get(key(c, C.GROUND_ROW - 2))) continue;
      const spot = { x: c * T + 3, y: GROUND_Y - p.h };
      if (!fallback) fallback = spot;
      if (this.pathExists({}, false, spot)) { p.x = spot.x; p.y = spot.y; return; }
    }
    if (fallback) { p.x = fallback.x; p.y = fallback.y; return; }
    p.x = start * T + 3; p.y = 0; // nowhere safe: drop in from the sky
  }

  stepTiles() {
    const p = this.player;
    for (const [k, t] of this.tiles) {
      if (t.spawn > 0) { t.spawn--; continue; }
      if (t.type === 'crumble' && t.timer > 0) {
        if (--t.timer === 0) {
          this.tiles.delete(k);
          this.ents.push({ id: this.nextId++, type: 'debris', x: t.c * T, y: t.r * T, w: T, h: T, vx: 0, vy: 0, spawn: 0, t: 0 });
          this.events.push('break');
        }
      } else if (t.type === 'spring') {
        if (t.timer > 0) t.timer--;
      } else if (t.type === 'flame') {
        // Off, then a short warning flicker, then fire up to two tiles high.
        const ph = ++t.age % FLAME_CYCLE;
        t.warm = ph >= FLAME_WARM_AT && ph < FLAME_ON_AT;
        t.on = 0;
        if (ph >= FLAME_ON_AT) {
          while (t.on < 2 && t.r - t.on - 1 >= 0 && !this.solidAt(t.c, t.r - t.on - 1)) t.on++;
          const x = t.c * T;
          if (ph === FLAME_ON_AT && x > this.camX - T && x < this.camX + VIEW_W) this.events.push('flame');
          if (t.on && p.invuln === 0 && this.phase !== 'over' &&
              overlap(p.x, p.y, p.w, p.h, x + 3, (t.r - t.on) * T, 10, t.on * T)) this.loseLife(false);
        }
      } else if (t.type === 'mine') {
        t.age++;
        const mx = t.c * T + 8, my = t.r * T + 12;
        const d = Math.hypot(mx - (p.x + p.w / 2), my - (p.y + p.h / 2));
        if (t.timer > 0) {
          if (--t.timer === 0) {
            this.tiles.delete(k);
            this.fx.push({ k: 'boom', a: mx, b: my, c: 30, ttl: 16 });
            this.events.push('boom');
            if (d < 30 && p.invuln === 0 && this.phase !== 'over') this.loseLife(false);
          }
        } else if (d < 22) { t.timer = 18; this.events.push('warn'); } // shows itself and beeps before it blows
      } else if (t.type === 'cannon' && this.phase === 'play') {
        const x = t.c * T;
        if (x > this.camX - T && x < this.camX + VIEW_W + T && --t.fire <= 0) {
          t.fire = 110;
          const dir = p.x + p.w / 2 < x + T / 2 ? -1 : 1;
          if (this.ents.length < MAX_ENTS) {
            this.ents.push({ id: this.nextId++, type: 'bullet', x: dir < 0 ? x - 13 : x + T + 1, y: t.r * T + 2, w: 12, h: 12, vx: dir * 1.9, vy: 0, spawn: 0, t: 0 });
            this.events.push('shoot');
          }
        }
      }
    }
  }

  stepEnts() {
    for (const e of this.ents) {
      if (e.spawn > 0) { e.spawn--; continue; }
      e.t++;
      if (e.type === 'slime' || e.type === 'thorn') {
        if (e.vx === 0 && !e.dir) e.dir = -1;
        e.vx = e.dir * 0.5;
        e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
        if (this.moveBody(e)) e.dir = -e.dir;
      } else if (e.type === 'bat') {
        e.x -= 0.9;
        e.y = e.baseY + Math.sin(e.t * 0.08) * 12;
      } else if (e.type === 'bullet') {
        e.x += e.vx;
        if (this.collides(e)) e.dead = true;
      } else if (e.type === 'boulder') {
        if (e.warn > 0) { e.warn--; continue; }
        e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
        if (e.rolling) e.vx = -1.2;
        if (this.moveBody(e)) { e.dead = true; this.events.push('break'); }
        if (e.onGround && !e.rolling) { e.rolling = true; this.events.push('thud'); } // lands, then rolls back toward the runner
      } else if (e.type === 'hopper') {
        // Sits a moment, then leaps toward the runner.
        const p = this.player;
        e.vy = Math.min(e.vy + GRAVITY, MAX_FALL);
        if (e.onGround) {
          e.vx = 0;
          if (--e.t2 <= 0) { e.vx = p.x + p.w / 2 < e.x + e.w / 2 ? -1.1 : 1.1; e.vy = -4.4; e.t2 = 28; }
        }
        this.moveBody(e);
      } else if (e.type === 'saw') {
        e.x += e.dir;
        if (Math.abs(e.x - e.home) >= SAW_REACH) e.dir = -e.dir;
      } else if (e.type === 'crusher') {
        this.stepCrusher(e);
      } else if (e.type === 'ghost') {
        // Drifts straight at the runner, through anything, until its time runs out.
        const p = this.player;
        const dx = p.x + p.w / 2 - (e.x + e.w / 2), dy = p.y + p.h / 2 - (e.y + e.h / 2);
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * GHOST_SPEED;
        e.y += (dy / d) * GHOST_SPEED;
        if (--e.life <= 0) e.dead = true;
      } else if (e.type === 'debris') {
        e.vy += GRAVITY;
        e.y += e.vy;
      }
      if (e.y > C.ROWS * T + 32 || e.x < this.camX - 48 || e.x > this.camX + BUILD_W + 64) e.dead = true;
    }
    if (this.ents.some((e) => e.dead)) this.ents = this.ents.filter((e) => !e.dead);
  }

  // wait -> shake (warning) -> drop -> rest on the floor -> rise back up -> wait
  stepCrusher(e) {
    const p = this.player;
    if (e.state === 'wait') {
      if (Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 14 && p.y > e.y) { e.state = 'shake'; e.t2 = 14; this.events.push('crack'); }
    } else if (e.state === 'shake') {
      if (--e.t2 <= 0) { e.state = 'drop'; e.vy = 0; }
    } else if (e.state === 'drop') {
      e.vy = Math.min(e.vy + 0.6, 7);
      this.moveBody(e);
      if (e.onGround) { e.state = 'rest'; e.t2 = 45; this.events.push('thud'); }
    } else if (e.state === 'rest') {
      if (--e.t2 <= 0) e.state = 'rise';
    } else {
      e.y -= 1;
      if (e.y <= e.home) { e.y = e.home; e.state = 'wait'; }
    }
  }

  cleanup() {
    if (this.tick % 60 !== 0) return;
    const minCol = Math.floor(this.camX / T) - 2;
    for (const [k, t] of this.tiles) if (t.c < minCol) this.tiles.delete(k);
    for (const c of this.pits) if (c < minCol) this.pits.delete(c);
  }

  // What gets sent to the browsers every tick.
  snapshot() {
    const p = this.player;
    const secs = this.secondsSurvived();
    const tier = C.CREDIT_TIERS[this.tier];
    const s = {
      t: 'state',
      phase: this.phase,
      cd: Math.ceil(this.countdown / C.FPS),
      time: Math.ceil(this.timeLeft / C.FPS),
      tick: this.tick,
      seed: this.seed,
      camX: r1(this.camX),
      credits: this.credits,
      rate: tier.perSecond,
      cap: tier.cap,
      winner: this.winner,
      p: {
        x: r1(p.x), y: r1(p.y), vx: r1(p.vx), f: p.facing, g: p.onGround ? 1 : 0, iv: p.invuln, l: p.lives,
        fly: this.abil[ABILITY_INDEX.fly].active > 0 ? 1 : 0,
        rot: spinQuarter(p.spin), // somersault: quarter turns clockwise, 0-3
        ws: p.sliding, // sliding down a wall on this side (-1 / 1)
      },
      // per move: [state, seconds] where state is L(ocked), A(ctive), C(ooling down) or R(eady)
      ab: this.abil.map((a, i) =>
        !a.unlocked ? ['L', Math.ceil(C.ABILITIES[i].unlock - secs)]
          : a.active > 0 ? ['A', Math.ceil(a.active / C.FPS)]
            : a.cd > 0 ? ['C', Math.ceil(a.cd / C.FPS)] : ['R', 0]),
      tiles: [...this.tiles.values()].map((t) => [t.c, t.r, t.type, t.spawn > 0 ? 1 : 0, tileFlag(t)]),
      pits: [...this.pits],
      ents: this.ents.map((e) => [e.id, e.type, r1(e.x), r1(e.y), e.spawn > 0 ? 1 : 0, e.warn > 0 ? 1 : 0, entExtra(e)]),
      wind: this.wind,
      // per item, in ITEMS order: how much of its recharge is left, 0 (ready) to 1
      cds: C.ITEMS.map((i) => {
        const left = BRICK[i.id] ? this.brickLock : this.itemCd[i.id] || 0;
        const total = BRICK[i.id] ? BRICK_LOCK_TICKS : this.cdTotal(i);
        return left > 0 ? Math.max(0.01, Math.round((left / total) * 100) / 100) : 0;
      }),
      bricks: this.brickLock > 0 ? 0 : C.BRICKS.burst - this.brickCount, // how many more before the pause
      fog: this.fog,
      fx: this.fx.map((f) => [f.k, f.a, f.b, f.c, f.ttl]),
      ev: this.events,
    };
    this.events = [];
    return s;
  }
}

// The one extra number each tile sends to the browser for drawing.
function tileFlag(t) {
  if (t.type === 'flame') return t.on > 0 ? t.on : t.warm ? -1 : 0; // flame height in tiles, or -1 while warming up
  if (t.type === 'mine') return t.timer > 0 ? 2 : t.age > C.MINE_HIDE_TICKS ? 1 : 0; // 2 = about to blow, 1 = hidden from the runner
  return t.timer > 0 ? 1 : 0; // crumble cracking, spring sprung
}

function entExtra(e) {
  if (e.type === 'saw') return e.home; // so its track can be drawn
  if (e.type === 'crusher') return e.state === 'shake' ? 1 : 0;
  if (e.type === 'hopper') return e.onGround ? 0 : 1; // mid-leap
  if (e.type === 'ghost') return e.life < 90 ? 1 : 0; // fading out
  return 0;
}

function spinQuarter(spin) {
  if (!spin) return 0;
  const q = Math.floor((spin.t / spin.total) * spin.turns * 4) % 4;
  return spin.dir > 0 ? q : (4 - q) % 4;
}

function randTicks([min, max]) {
  return Math.round((min + Math.random() * (max - min)) * C.FPS);
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

module.exports = { Game };
