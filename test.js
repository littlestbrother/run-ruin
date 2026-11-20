// Rule checks for the simulation. Run with: npm test
const assert = require('assert');
const C = require('./public/shared.js');
const { Game } = require('./game.js');
const { BuilderBot, RECIPES } = require('./bot.js');

const run = (g, n) => { for (let i = 0; i < n; i++) g.step(); };
// Most checks place things back to back, so they skip the builder's recharge timers.
// They also switch off the random +1 pickups unless asked, so life counts stay predictable.
const started = (pickups) => {
  const g = new Game(); run(g, C.COUNTDOWN_SECONDS * C.FPS); assert.equal(g.phase, 'play');
  if (!pickups) g.lifeTimer = Infinity;
  const place = g.place.bind(g);
  g.place = (...a) => { g.itemCd = {}; return place(...a); };
  return g;
};
const rich = () => { const g = started(); g.credits = 9999; return g; };
const AB = Object.fromEntries(C.ABILITIES.map((a, i) => [a.id, i]));
const unlockAll = (g) => g.abil.forEach((a) => { a.unlocked = true; });

// Standing still: the scrolling screen edge shoves the runner along, nothing kills them, runner wins.
{
  const g = started();
  run(g, C.ROUND_SECONDS * C.FPS + 5);
  assert.equal(g.winner, 'runner');
  assert.equal(g.lives, C.LIVES);
}

// Credits: spending, refusal when broke, and income that grows through the round.
{
  const g = started();
  assert.equal(g.credits, C.START_CREDITS);
  g.credits = 15; // enough for two cannons, not three
  assert.equal(g.place('cannon', 20, 12), null);
  assert.equal(g.credits, 9);
  assert.equal(g.place('cannon', 21, 12), null);
  assert.equal(g.place('cannon', 22, 12), 'not enough credits');
  g.tiles.clear(); // the cannons would otherwise shoot the idle runner
  // each stage: earns at its rate, and stops at its cap
  const [t0, t1, t2] = C.CREDIT_TIERS;
  const earnsFor10s = (tier) => { g.credits = 0; g.creditAcc = 0; run(g, 10 * 60); assert.ok(Math.abs(g.credits - tier.perSecond * 10) < 1, `earned ${g.credits} in 10s at ${tier.perSecond}/s`); }; // credits are whole numbers
  const capped = (tier) => { g.credits = tier.cap - 1; run(g, 2 * 60); assert.equal(g.credits, tier.cap); const s = g.snapshot(); assert.equal(s.rate, tier.perSecond); assert.equal(s.cap, tier.cap); };
  earnsFor10s(t0); capped(t0);
  run(g, (t1.from - 12) * 60 + 1);
  earnsFor10s(t1); capped(t1);
  run(g, (t2.from - t1.from - 12) * 60 + 1);
  earnsFor10s(t2); capped(t2);
  assert.ok(t0.perSecond < t1.perSecond && t1.perSecond < t2.perSecond && t0.cap < t1.cap && t1.cap < t2.cap);
}

// Basic placement rules.
{
  const g = started();
  assert.equal(g.place('block', 3, 12), 'too close to runner');
  assert.equal(g.place('block', 500, 12), 'out of range');
  // everything visible on the builder's screen is buildable, including the part-column at the right edge
  const edge = Math.floor(g.camX / 16) + C.BUILDER_COLS;
  assert.equal(g.place('block', edge, 12), null);
  assert.equal(g.place('pit', edge, 13), null);
  assert.deepEqual([...g.pits], [edge]);
  assert.equal(g.place('block', edge + 1, 12), 'out of range');
  for (let r = 11; r > 8; r--) g.place('block', edge, r);
  assert.equal(g.place('block', edge, 8), 'would block the path'); // the wall rule still holds out there
  assert.equal(g.place('spike', 20, 5), 'needs a floor under it');
  assert.equal(g.place('spike', 20, 12), null);
  assert.equal(g.place('spike', 20, 12), 'occupied');
}

// Walls: 4 high is the tallest that can be jumped, so the 5th block is refused.
{
  const g = rich();
  for (let r = 12; r > 8; r--) assert.equal(g.place('block', 22, r), null);
  assert.equal(g.place('block', 22, 8), 'would block the path');
  assert.equal(g.place('block', 22, 3), null); // a floating block well above is fine
}

// A lower wall sealed with a ceiling in front of it is refused too.
{
  const g = rich();
  for (let r = 12; r > 9; r--) assert.equal(g.place('block', 20, r), null); // 3 high
  for (let c = 15; c < 20; c++) assert.equal(g.place('block', c, 9), null, 'roof ' + c); // roof leading up to it
  // closing the gap above the wall would leave no way over
  let refused = 0;
  for (let r = 9; r >= 0; r--) if (g.place('block', 20, r) === 'would block the path') refused++;
  assert.ok(refused >= 1, 'sealing the wall was refused');
  assert.ok(g.routeOk({}), 'a way through remains');
}

// Pits: can be widened only as far as the runner can jump.
{
  const g = rich();
  assert.equal(g.place('pit', 12, 13), null);
  assert.deepEqual([...g.pits], [12, 13]); // one click digs two columns
  for (let c = 13; c < 30 && g.place('pit', c, 13) === null; c++);
  const width = g.pits.size;
  assert.equal(width, 5, 'max pit width ' + width);
  assert.equal(g.place('pit', 12 + width, 13), 'would block the path');
  // a crumble stepping stone doesn't count as a way across, since it may be gone later
  assert.equal(g.place('crumble', 13, 12), null);
  assert.equal(g.place('pit', 12 + width, 13), 'would block the path');
}

// The tallest allowed wall really can be cleared with a double jump.
{
  const g = rich();
  for (let r = 12; r > 8; r--) g.place('block', 12, r);
  g.setInput(false, true, true, true);
  let jumped = false;
  for (let i = 0; i < 400 && g.player.x < 13 * 16 + 4; i++) {
    g.step();
    if (!jumped && g.player.vy > -0.5 && !g.player.onGround) { g.setInput(false, true, true, true); jumped = true; }
    if (g.player.onGround && g.player.vx === 0 && jumped) { g.setInput(false, true, true, true); jumped = false; }
  }
  assert.ok(g.player.x >= 13 * 16, 'runner got over the wall, x=' + g.player.x);
  assert.equal(g.lives, C.LIVES);
}

// The route check stays quick even when the builder has made a mess.
{
  const g = rich();
  let x = 7;
  for (let c = 8; c < 32; c++) for (let r = 0; r < 13; r++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    if (x % 3 === 0) g.place('block', c, r);
  }
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) g.wouldBlock({ tile: { c: 20, r: 12, type: 'block' } });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  assert.ok(g.routeOk({}), 'random mess still passable');
  assert.ok(ms < 40, 'route check took ' + ms.toFixed(1) + 'ms');
  console.log('route check on a cluttered map: ' + ms.toFixed(2) + 'ms');
}

// Running into spikes costs one life; falling in pits three times and the builder wins.
{
  const g = started();
  g.place('spike', 10, 12);
  run(g, C.SPAWN_TICKS + 1);
  g.setInput(false, true, false, false);
  run(g, 120);
  assert.equal(g.lives, C.LIVES - 1);
}
{
  const g = started();
  for (let c = 8; c < 12; c++) g.pits.add(c);
  g.setInput(false, true, false, false);
  for (let i = 0; i < 60 * 40 && !g.winner; i++) { g.step(); for (let c = 0; c < 4; c++) g.pits.add(Math.floor(g.camX / 16) + 8 + c); }
  assert.equal(g.winner, 'builder');
}

// Boulder warns, falls, and hurts.
{
  const g = started();
  const col = Math.floor(g.player.x / 16);
  assert.equal(g.place('boulder', col, 0), null);
  run(g, C.BOULDER_WARN_TICKS - 1);
  assert.equal(g.lives, C.LIVES);
  run(g, 120);
  assert.equal(g.lives, C.LIVES - 1);
}

// Moves unlock in order as time passes, and can't be used before then.
{
  const g = started();
  assert.equal(g.useAbility(AB.triple), false);
  run(g, 20 * 60);
  assert.deepEqual(g.abil.map((a) => a.unlocked), [true, false, false, false]);
  run(g, 25 * 60);
  assert.deepEqual(g.abil.map((a) => a.unlocked), [true, true, false, false]);
  run(g, 50 * 60);
  assert.deepEqual(g.abil.map((a) => a.unlocked), [true, true, true, true]);
  assert.equal(g.useAbility(AB.laser), true);
  assert.equal(g.useAbility(AB.laser), false); // recharging
  run(g, 10 * 60);
  assert.equal(g.useAbility(AB.laser), true);
}

// Triple jump: a third jump in the air while it is switched on.
{
  const count = (useIt) => {
    const g = started(); unlockAll(g);
    if (useIt) g.useAbility(AB.triple);
    let jumps = 0;
    for (let i = 0; i < 90; i++) {
      if (i % 15 === 0) g.setInput(false, false, true, true);
      g.step();
      jumps += g.events.filter((e) => e === 'jump' || e === 'jump2').length; g.events = [];
      if (g.player.onGround && i > 5) break;
    }
    return jumps;
  };
  assert.equal(count(false), 2);
  assert.equal(count(true), 3);
}

// Laser: kills enemies in the row and burns the first block, but not what is behind it.
{
  const g = rich(); unlockAll(g);
  g.place('slime', 8, 12); g.place('block', 11, 12); g.place('block', 15, 12); g.place('slime', 13, 12);
  run(g, C.SPAWN_TICKS + 2);
  assert.equal(g.ents.length, 2);
  g.useAbility(AB.laser);
  run(g, 1);
  assert.ok(!g.tiles.has('11,12') && g.tiles.has('15,12'));
  assert.equal(g.ents.length, 1);
}

// Explode: clears tiles and enemies nearby, leaves far ones.
{
  const g = rich(); unlockAll(g);
  g.place('block', 8, 12); g.place('spike', 9, 12); g.place('block', 20, 12); g.place('slime', 8, 10);
  g.player.x = 7 * 16; run(g, C.SPAWN_TICKS + 2);
  g.useAbility(AB.explode); run(g, 1);
  assert.deepEqual([...g.tiles.keys()], ['20,12']);
  assert.equal(g.ents.length, 0);
  assert.equal(g.lives, C.LIVES);
}

// Fly: heads for the mouse pointer, then gravity comes back.
{
  const g = started(); unlockAll(g);
  g.useAbility(AB.fly); g.setAim(80, 40);
  run(g, 120);
  assert.ok(Math.abs(g.player.y + 7 - 40) < 6, 'flew up to the pointer, y=' + g.player.y);
  assert.ok(Math.abs(g.player.x + 5 - g.camX - 80) < 6, 'flew across to the pointer');
  run(g, 5 * 60);
  assert.ok(g.player.onGround, 'landed again after flying');
}

// Bigger enemies: a slime needs room, and cannonballs are 12 pixels.
{
  const g = rich();
  g.place('block', 21, 12);
  assert.equal(g.place('slime', 20, 12), 'no room here');
  assert.equal(g.place('slime', 18, 12), null);
  assert.deepEqual([g.ents[0].w, g.ents[0].h], [20, 16]);
  g.place('cannon', 12, 12);
  run(g, 100);
  const b = g.ents.find((e) => e.type === 'bullet');
  assert.equal(b.w, 12);
}

// Saw: slides back and forth, can't be stomped.
{
  const g = rich();
  g.place('saw', 12, 12);
  run(g, C.SPAWN_TICKS);
  const saw = g.ents[0], xs = [];
  for (let i = 0; i < 200; i++) { g.step(); xs.push(saw.x); }
  assert.equal(Math.max(...xs) - Math.min(...xs), 64);
  g.player.x = saw.x; g.player.y = saw.y - 20; g.player.vy = 2; g.player.invuln = 0;
  run(g, 20);
  assert.equal(g.lives, C.LIVES - 1);
}

// Flame jet: harmless while off, burns two tiles up while on.
{
  const g = rich();
  g.place('flame', 10, 12);
  run(g, C.SPAWN_TICKS);
  const t = g.tiles.get('10,12');
  g.player.x = 10 * 16 + 3; g.player.y = 11 * 16 + 2 - 16; // standing in the air column above it
  let hurtAt = -1;
  for (let i = 0; i < 150 && hurtAt < 0; i++) { g.player.y = 10 * 16; g.player.vy = 0; g.step(); if (g.lives < C.LIVES) hurtAt = t.age % 150; }
  assert.equal(hurtAt, 90);
}

// Crusher: drops when the runner walks under it, then goes back up.
{
  const g = rich();
  g.place('crusher', 10, 6);
  run(g, C.SPAWN_TICKS + 5);
  const cr = g.ents[0];
  assert.equal(cr.y, 96);
  g.player.x = 10 * 16 + 3;
  run(g, 40);
  assert.equal(g.lives, C.LIVES - 1);
  assert.ok(cr.y > 150, 'crusher came down');
  g.player.x = 215; // walk on past it
  run(g, 180);
  assert.equal(cr.y, 96);
}

// Crusher: landing on its flat top destroys it; being under it still hurts.
{
  const g = rich();
  g.place('crusher', 10, 10);
  run(g, C.SPAWN_TICKS + 5);
  const cr = g.ents[0];
  g.player.x = cr.x + 2; g.player.y = cr.y - 30; g.player.vy = 1;
  run(g, 30);
  assert.equal(g.ents.length, 0);
  assert.equal(g.lives, C.LIVES);
}

// Ghost: floats through a wall toward the runner, and gives up after its time.
{
  const g = rich();
  for (let r = 12; r > 8; r--) g.place('block', 9, r);
  g.place('ghost', 11, 12);
  run(g, C.SPAWN_TICKS + 60);
  assert.ok(g.ents[0].x < 9 * 16, 'ghost passed through the wall');
  g.player.invuln = 99999; g.tiles.clear(); // (or the idle runner gets squashed against the wall)
  run(g, C.GHOST_SECONDS * 60);
  assert.equal(g.ents.length, 0);
}

// Mine: hides, then warns and blows up when the runner gets close.
{
  const g = rich();
  g.place('mine', 9, 12);
  run(g, C.SPAWN_TICKS + C.MINE_HIDE_TICKS + 2);
  assert.equal(g.snapshot().tiles[0][4], 1);
  g.setInput(false, true, false, false);
  run(g, 90);
  assert.equal(g.tiles.size, 0);
  assert.equal(g.lives, C.LIVES - 1);
}

// Spring: throws the runner far higher than a jump.
{
  const g = rich();
  g.place('spring', 8, 12);
  run(g, C.SPAWN_TICKS + 1);
  g.setInput(false, true, false, false);
  let top = 999;
  for (let i = 0; i < 120; i++) { g.step(); top = Math.min(top, g.player.y); }
  assert.ok(top < 208 - 14 - 90, 'spring height, top y=' + top);
}

// Ice and goo: slow to stop on ice, slow to move in goo.
{
  const slide = (item) => {
    const g = rich();
    for (let c = 8; c < 30; c++) if (item) g.place(item, c, 12);
    run(g, C.SPAWN_TICKS + 1);
    g.player.x = 10 * 16; g.player.vx = 1.75;
    const x0 = g.player.x;
    g.setInput(false, false, false, false);
    run(g, 200);
    return g.player.x - x0;
  };
  assert.ok(slide('ice') > slide(null) * 5, 'ice slides');
  const g = rich();
  for (let c = 8; c < 30; c++) g.place('goo', c, 12);
  run(g, C.SPAWN_TICKS + 1);
  g.player.x = 10 * 16; g.setInput(false, true, false, false);
  run(g, 30);
  assert.equal(g.player.vx, 0.7);
}

// Wind and fog: timed, whole-screen, one at a time.
{
  const g = rich();
  assert.equal(g.place('wind', 0, 0), null);
  assert.equal(g.place('wind', 0, 0), 'already active');
  assert.equal(g.place('fog', 0, 0), null);
  const x0 = g.player.x - g.camX;
  g.setInput(false, true, false, false);
  run(g, 60);
  const withWind = g.player.x;
  assert.ok(g.snapshot().fog > 0);
  run(g, C.FOG_SECONDS * 60);
  const s = g.snapshot();
  assert.equal(s.wind, 0); assert.equal(s.fog, 0);
  const h = rich(); h.setInput(false, true, false, false); run(h, 60);
  assert.ok(withWind < h.player.x - 30, 'wind held the runner back');
}

// Builder recharge: an item can't be placed again until its timer runs out; blocks have none.
{
  const g = new Game(); run(g, C.COUNTDOWN_SECONDS * C.FPS); g.credits = 999; g.lifeTimer = Infinity;
  assert.equal(g.place('slime', 20, 12), null);
  assert.equal(g.place('slime', 24, 12), 'recharging');
  assert.equal(g.credits, 996);
  assert.equal(g.place('bat', 24, 8), null); // other items are unaffected
  assert.equal(g.place('block', 25, 5), null);
  assert.equal(g.place('block', 26, 5), null);
  for (const c of [27, 28]) assert.equal(g.place('spike', c, 12), null); // spikes and pits have no wait either
  for (const c of [14, 16]) assert.equal(g.place('pit', c, 13), null);
  const cd = (id) => g.snapshot().cds[C.ITEMS.findIndex((i) => i.id === id)];
  assert.equal(cd('slime'), 1); assert.equal(cd('block'), 0);
  run(g, 3 * 60 - 1);
  assert.equal(g.place('slime', 26, 12), 'recharging');
  run(g, 1);
  assert.equal(g.place('slime', 26, 12), null);
  assert.equal(g.place('fog', 0, 0), null);
  run(g, (C.FOG_SECONDS + 15) * 60 - 1);
  assert.equal(g.place('fog', 0, 0), 'recharging');
  run(g, 1);
  assert.equal(g.place('fog', 0, 0), null);
}

// Bricks have no wait at all: the route check is what limits them.
{
  const g = new Game(); run(g, C.COUNTDOWN_SECONDS * C.FPS); g.credits = 999; g.lifeTimer = Infinity;
  for (let i = 0; i < 12; i++) assert.equal(g.place(i % 2 ? 'block' : 'crumble', 14 + i, 3), null);
  assert.ok(g.snapshot().cds.every((x) => x === 0));
}

// Spikes count as blocked: a carpet of them can only be as wide as a jump.
{
  const g = rich();
  let n = 0;
  for (let c = 12; c < 30 && g.place('spike', c, 12) === null; c++) n++;
  assert.ok(n >= 3 && n <= 6, 'spike carpet width ' + n);
  assert.equal(g.place('spike', 12 + n, 12), 'would block the path');
  assert.equal(g.place('spike', 12 + n + 3, 12), null); // further on, with somewhere to land in between, is fine
  // a stepping stone over the carpet makes room for more
  assert.equal(g.place('block', 12 + n - 1, 10), null);
  assert.ok(g.routeOk({}));
}

// Flame jets count too: fire on top of a wall makes the wall that much taller.
{
  const g = rich();
  assert.equal(g.place('flame', 16, 12), null); // one on the ground can be jumped: 1 block + 2 of fire
  assert.equal(g.place('block', 22, 12), null);
  assert.equal(g.place('block', 22, 11), null);
  assert.equal(g.place('flame', 22, 10), 'would block the path'); // 3 solid + 2 of fire is too tall
  assert.equal(g.place('flame', 22, 11), 'occupied');
  assert.equal(g.place('block', 22, 10), null);
}

// A runner already standing in spikes doesn't switch the check off.
{
  const g = rich();
  g.tiles.set('2,12', { c: 2, r: 12, type: 'spike', spawn: 0, timer: 0 });
  g.player.invuln = 100;
  assert.ok(g.routeOk({}));
  for (let r = 12; r > 8; r--) assert.equal(g.place('block', 14, r), null);
  assert.equal(g.place('block', 14, 8), 'would block the path');
}

// A single 4-high wall is always climbable in time, even late with the runner at the screen's left edge.
{
  for (const late of [false, true]) for (const atEdge of [false, true]) {
    const g = rich();
    if (late) g.timeLeft = 5 * 60;
    g.player.x = atEdge ? g.camX : g.camX + 100;
    const c = Math.floor((g.player.x + 5) / 16) + C.MIN_BUILD_DIST_COLS;
    let h = 0;
    for (let r = 12; r > 6 && g.place('block', c, r) === null; r--) h++;
    assert.equal(h, 4, `late=${late} atEdge=${atEdge}`);
  }
}

// The check knows the screen keeps scrolling. A runner at the far end of a dead-end
// tunnel has to walk back out and go over the top: fine from a short tunnel, but from
// a longer one the screen's left edge gets to the way out first.
{
  const escape = (len) => {
    const g = rich();
    g.timeLeft = 10 * 60; // late in the round: fast scrolling
    const a = 20;
    for (let c = a; c < a + len; c++) g.tiles.set(c + ',10', { c, r: 10, type: 'block', spawn: 0, timer: 0 }); // roof
    for (const r of [11, 12]) g.tiles.set((a + len - 1) + ',' + r, { c: a + len - 1, r, type: 'block', spawn: 0, timer: 0 }); // dead end
    g.player.x = (a + len - 2) * 16 + 3; g.player.y = 194;
    g.camX = g.player.x - 112; // the screen is where it would be had the runner walked in
    return g.pathExists({}, false);
  };
  assert.equal(escape(3), true);
  assert.equal(escape(6), false);
}

// Stomping: cannonballs and hoppers die to a stomp, a thorn slime hurts instead.
{
  const drop = (type) => {
    const g = rich();
    if (type === 'bullet') { g.place('cannon', 20, 12); for (let i = 0; i < 400 && !g.ents.length; i++) g.step(); }
    else { g.place(type, 14, 12); run(g, C.SPAWN_TICKS + 1); }
    const e = g.ents[0];
    g.player.invuln = 0;
    for (let i = 0; i < 40 && g.ents.includes(e) && g.lives === C.LIVES; i++) {
      g.player.x = e.x + 2 + (e.vx || 0); g.player.y = Math.min(g.player.y, e.y - 16); g.player.vy = Math.max(g.player.vy, 1); g.player.vx = 0;
      g.step();
    }
    return { killed: !g.ents.includes(e), lives: g.lives };
  };
  assert.deepEqual(drop('bullet'), { killed: true, lives: C.LIVES });
  assert.deepEqual(drop('hopper'), { killed: true, lives: C.LIVES });
  assert.deepEqual(drop('thorn'), { killed: false, lives: C.LIVES - 1 });
}

// Hopper: leaps toward the runner.
{
  const g = rich();
  g.place('hopper', 16, 12);
  const x0 = g.ents[0].x; let top = 999;
  for (let i = 0; i < 200; i++) { g.step(); if (g.ents[0]) top = Math.min(top, g.ents[0].y); }
  assert.ok(top < 196 - 20, 'hopper left the ground, top y=' + top);
  assert.ok(!g.ents[0] || g.ents[0].x < x0 - 30, 'hopper closed in on the runner');
}

// +1 pickup: shows up at a random time ahead of the runner, within reach, and adds a life.
for (let round = 0; round < 30; round++) {
  const g = started(true); g.credits = 9999;
  if (round % 2) {
    // obstacle rounds: clutter the map, then ask for a pickup straight away
    for (let c = 14; c < 30; c += 2) g.place(round % 4 === 1 ? 'pit' : 'block', c, round % 4 === 1 ? 13 : 12 - (c % 3));
    // (a crowded map can make it take a few attempts; the game retries every second)
    for (let i = 0; i < 20 && !g.ents.some((e) => e.type === 'life'); i++) { g.lifeTimer = 1; g.step(); }
  } else {
    // clean rounds: check when the first one turns up
    let at = -1;
    for (let i = 0; i < 26 * 60 && at < 0; i++) { g.step(); if (g.ents.some((e) => e.type === 'life')) at = i / 60; }
    assert.ok(at >= 14.9 && at <= 26, 'first pickup appeared at ' + at + 's'); // 15-25s, give or take a tick
  }
  const life = g.ents.find((e) => e.type === 'life');
  const c = Math.floor(life.x / 16), r = Math.floor(life.y / 16);
  assert.ok(life.x > g.player.x + 40, 'ahead of the runner');
  assert.ok(g.solidAt(c, 13) && r >= 10 && r <= 12, 'over ground and within a jump');
  for (let rr = r; rr < 13; rr++) assert.ok(!g.tiles.has(c + ',' + rr), 'nothing under it');
  assert.equal(g.place('block', c, r), "can't cover the +1");
  if (round === 0) {
    g.tiles.clear(); g.ents = [life];
    g.lives = 1; g.player.invuln = 50; // can be grabbed even while blinking from a hit
    g.camX = life.x - 112; // as if the runner had walked there, rather than being put beyond the screen's edge
    g.player.x = life.x; g.player.y = life.y; g.step();
    assert.equal(g.lives, 2);
    assert.ok(!g.ents.includes(life));
    g.lives = C.MAX_LIVES;
    g.ents.push({ ...life, dead: false }); g.step();
    assert.equal(g.lives, C.MAX_LIVES); // capped
  }
}

// Wall jump: a free kick off a wall, away from it, but not off the same wall twice running.
{
  const g = rich();
  for (let r = 12; r >= 3; r--) { g.tiles.set('10,' + r, { c: 10, r, type: 'block', spawn: 0, timer: 0 }); g.tiles.set('14,' + r, { c: 14, r, type: 'block', spawn: 0, timer: 0 }); }
  const p = g.player;
  const evs = () => { const e = g.events.filter((x) => x.startsWith('jump') || x === 'walljump'); g.events = []; return e.join(); };
  const press = (l, r) => { g.setInput(l, r, true, true); g.step(); return evs(); };
  const hold = (l, r, n) => { g.setInput(l, r, true, false); let out = ''; for (let i = 0; i < n; i++) { g.step(); out += evs(); } return out; };
  // steer toward a wall until touching it in mid-air (side: -1 = the left wall, 1 = the right wall)
  const reach = (side) => {
    for (let i = 0; i < 90 && g.wallBeside(p) !== side; i++) hold(side < 0, side > 0, 1);
    assert.equal(g.wallBeside(p), side); assert.ok(!p.onGround, 'still in the air');
  };
  p.x = 11 * 16 + 20; p.y = 194; g.step(); evs(); // standing in the shaft between the two walls
  assert.equal(press(false, true), 'jump');
  reach(1);
  const before = p.airJumps;
  assert.equal(press(true, false), 'walljump'); // jump while pushing away from it
  assert.ok(p.vx < 0 && p.vy < -4, 'kicked up and away');
  assert.equal(p.airJumps, before); // didn't cost the double jump
  // straight back to the same wall: no second wall jump there, so the press falls through to the double jump
  reach(1);
  assert.equal(press(true, false), 'jump2');
  reach(1);
  assert.equal(press(true, false), ''); // nothing left
  // cross to the other wall: a different wall, so it works again
  reach(-1);
  assert.equal(press(false, true), 'walljump');
  assert.ok(p.vx > 0);
  // and now the first wall is fair game again
  reach(1);
  assert.equal(press(true, false), 'walljump');
  // letting go of the wall a moment before jumping still counts
  reach(-1);
  hold(false, true, 3);
  assert.equal(g.wallBeside(p), 0);
  assert.equal(press(false, true), 'walljump');
  assert.equal(g.lives, C.LIVES);
}

// Pushing into a wall and jumping is still the plain double jump, straight up.
{
  const g = rich();
  for (let r = 12; r >= 3; r--) g.tiles.set('10,' + r, { c: 10, r, type: 'block', spawn: 0, timer: 0 });
  const p = g.player;
  p.x = 10 * 16 - 10; p.y = 194; g.step(); g.events = [];
  g.setInput(false, true, true, true); g.step();
  for (let i = 0; i < 12; i++) { g.setInput(false, true, true, false); g.step(); }
  g.events = [];
  g.setInput(false, true, true, true); g.step();
  assert.deepEqual(g.events, ['jump2']);
  assert.equal(p.x, 10 * 16 - 10);
}

// Bouncing between two facing walls climbs higher than any jump could.
{
  const g = rich();
  for (let r = 12; r >= 0; r--) for (const c of [10, 13]) g.tiles.set(c + ',' + r, { c, r, type: 'block', spawn: 0, timer: 0 });
  const p = g.player;
  p.x = 11 * 16 + 8; p.y = 194; g.step();
  g.setInput(false, true, true, true); g.step();
  let top = p.y, dir = 1;
  for (let i = 0; i < 400; i++) {
    const w = g.wallBeside(p);
    if (w && !p.onGround) { dir = -w; g.setInput(dir < 0, dir > 0, true, true); } else g.setInput(dir < 0, dir > 0, true, false);
    g.step(); top = Math.min(top, p.y);
  }
  assert.ok(top < 60, 'climbed the shaft, top y=' + top);
}

// Wall slide slows the fall; somersaults run in quarter turns and stop on landing.
{
  const g = rich();
  for (let r = 12; r >= 0; r--) g.tiles.set('10,' + r, { c: 10, r, type: 'block', spawn: 0, timer: 0 });
  const p = g.player;
  p.x = 10 * 16 - 10; p.y = 20; p.vy = 0; p.onGround = false; p.coyote = 0;
  g.setInput(false, true, false, false);
  run(g, 30);
  assert.equal(p.vy, 1.2);
  assert.equal(g.snapshot().ps[0].ws, 1);
  g.setInput(false, false, false, false); run(g, 10);
  assert.ok(p.vy > 3, 'falls freely once you let go');

  const h = rich(); const q = h.player; const rots = [];
  h.setInput(false, false, true, true); h.step();
  for (let i = 0; i < 10; i++) h.step();
  h.setInput(false, false, true, true);
  for (let i = 0; i < 60; i++) { h.step(); rots.push(h.snapshot().ps[0].rot); }
  assert.deepEqual([...new Set(rots)], [0, 1, 2, 3].filter((x) => rots.includes(x)));
  assert.ok(rots.includes(1) && rots.includes(2) && rots.includes(3), 'went all the way round: ' + rots.join(''));
  assert.equal(rots[rots.length - 1], 0);
  assert.ok(q.onGround);
}

// A runner who drops into a pit can kick off its side.
{
  const g = rich();
  g.pits.add(10); g.pits.add(11);
  const p = g.player;
  p.x = 11 * 16 + 6; p.y = 13 * 16 - 6; p.vy = 2; p.onGround = false; p.coyote = 0; p.airJumps = 0; // dropping in beside the far side of the pit
  g.setInput(true, false, true, true); g.step(); // pushing away from the pit wall
  assert.ok(g.events.includes('walljump'), 'kicked off the side of the pit');
}

// ---------- two runners ----------
const duo = () => {
  const g = new Game({ runners: 2 }); run(g, C.COUNTDOWN_SECONDS * C.FPS);
  g.lifeTimer = Infinity; g.credits = 9999;
  const place = g.place.bind(g);
  g.place = (...a) => { g.itemCd = {}; return place(...a); };
  return g;
};

// Each runner is driven separately and has their own lives and moves.
{
  const g = duo();
  const [a, b] = g.players;
  assert.ok(a.x !== b.x && !a.out && !b.out);
  g.setInput(false, true, false, false, 1); // only runner 2 walks right
  g.setInput(true, false, false, false, 0);
  run(g, 40);
  assert.ok(b.vx > 0 && a.vx <= 0);
  g.players.forEach((p) => p.abil.forEach((x) => { x.unlocked = true; }));
  assert.equal(g.useAbility(1, 1), true); // runner 2's laser
  assert.equal(g.useAbility(1, 1), false); // theirs is recharging...
  assert.equal(g.useAbility(1, 0), true); // ...runner 1's is not
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.equal(s.ps.length, 2);
  assert.deepEqual(s.ps.map((q) => q.ab[1][0]), ['C', 'C']);
}

// Two runners share one pool of lives: a hit on either costs the team one, both keep
// playing, and the builder wins when the pool is empty.
{
  const g = duo();
  const [a, b] = g.players;
  assert.equal(g.lives, C.TEAM_LIVES);
  assert.equal(new Game().lives, C.LIVES);
  g.tiles.set('3,12', { c: 3, r: 12, type: 'spike', spawn: 0, timer: 0 });
  a.x = 3 * 16 + 3; b.x = 120; a.invuln = 0; b.invuln = 0;
  g.step();
  assert.equal(g.lives, C.TEAM_LIVES - 1); // runner 1 hit
  assert.ok(!a.out && !b.out && a.invuln > 0 && b.invuln === 0);
  b.x = 3 * 16 + 3; a.x = 120;
  g.step();
  assert.equal(g.lives, C.TEAM_LIVES - 2); // runner 2 hit: same pool
  assert.equal(JSON.parse(JSON.stringify(g.snapshot())).lives, C.TEAM_LIVES - 2);
  g.tiles.clear();
  g.lives = 1; a.invuln = 0; b.invuln = 0;
  g.pits.add(Math.floor(a.x / 16)); g.pits.add(Math.floor(a.x / 16) + 1);
  for (let i = 0; i < 200 && !g.winner; i++) g.step();
  assert.equal(g.winner, 'builder');
  assert.equal(g.lives, 0);
  assert.ok(g.players.every((p) => p.out));

  // the heart pickup tops up the shared pool, to the team's higher cap
  const h = duo();
  h.lives = C.TEAM_MAX_LIVES - 1;
  const heart = () => h.ents.push({ id: 99, type: 'life', x: h.players[1].x, y: h.players[1].y, w: 14, h: 12, vx: 0, vy: 0, spawn: 0, t: 0 });
  heart(); h.step();
  assert.equal(h.lives, C.TEAM_MAX_LIVES);
  heart(); h.step();
  assert.equal(h.lives, C.TEAM_MAX_LIVES);
}

// Every 10 enemies destroyed earns a life: stomps, laser and explosion all count; cannonballs don't.
{
  const g = rich(); unlockAll(g);
  const p = g.player;
  const surround = (type, n) => { for (let i = 0; i < n; i++) g.ents.push({ id: 1000 + i, type, x: p.x + (i % 5) * 4 - 8, y: p.y - 30 - Math.floor(i / 5) * 4, w: 4, h: 4, vx: 0, vy: 0, spawn: 0, t: 0, baseY: p.y - 30, dir: 1, home: p.x, life: 999, state: 'wait' }); };
  const boom = () => { g.abil[AB.explode].cd = 0; g.events = []; assert.equal(g.useAbility(AB.explode), true); };
  surround('bullet', 12); boom();
  assert.equal(g.kills, 0); assert.equal(g.lives, C.LIVES); // cannonballs aren't enemies
  g.ents = [];
  surround('bat', 9); boom();
  assert.equal(g.kills, 9); assert.equal(g.lives, C.LIVES);
  assert.equal(g.snapshot().kills, 9);
  g.ents = [];
  // the tenth, by stomp
  g.place('slime', Math.floor(p.x / 16) + 6, 12); run(g, C.SPAWN_TICKS + 1);
  const slime = g.ents[0];
  for (let i = 0; i < 40 && g.ents.includes(slime); i++) { p.x = slime.x + 4; p.y = Math.min(p.y, slime.y - 16); p.vy = Math.max(p.vy, 1); p.invuln = 0; g.camX = p.x - 112; g.step(); }
  assert.equal(g.kills, 10);
  assert.equal(g.lives, C.LIVES + 1);
  assert.equal(g.snapshot().kills, 0); // counting starts again
  // one of each kind that counts, by laser and explosion
  g.ents = []; g.kills = 0;
  C.KILL_COUNTS.forEach((type) => surround(type, 1));
  boom();
  assert.equal(g.kills, C.KILL_COUNTS.length);
  // lives already full: the tenth kill gives nothing extra
  g.ents = []; g.kills = 0; g.lives = C.MAX_LIVES;
  surround('bat', 10); boom();
  assert.equal(g.lives, C.MAX_LIVES);
  assert.ok(g.events.includes('bonusfull'));
}

// The screen only jumps ahead as far as the runner at the back allows, and its
// right edge stops the one in front.
{
  const g = duo();
  const [back, front] = g.players; // runner 2 starts a little ahead of runner 1
  g.setInput(false, true, false, false, 1); // the front one sprints; the other stands still
  run(g, 240);
  assert.ok(front.x - g.camX > 200, 'the leader got well ahead on screen: ' + (front.x - g.camX));
  assert.ok(front.x <= g.camX + 16 * 16 - front.w + 0.01, 'but not off the right edge');
  assert.ok(back.x >= g.camX, 'and the one behind was not dragged off the left');
  assert.equal(g.lives, C.TEAM_LIVES);
  const cam = g.camX;
  g.setInput(false, true, false, false, 0); // now both run
  run(g, 240);
  assert.ok(g.camX > cam + 200, 'screen follows once both push on');
}

// The no-build zone and the path check both cover both runners.
{
  const g = duo();
  const [a, b] = g.players;
  a.x = 200; b.x = 40;
  const lead = Math.floor(205 / 16);
  assert.equal(g.place('block', lead + C.MIN_BUILD_DIST_COLS - 1, 12), 'too close to runner');
  assert.equal(g.place('block', lead + C.MIN_BUILD_DIST_COLS, 12), null);
  // a 5-high wall between the two of them shuts runner 2 in, even though runner 1 is past it
  const wall5 = () => { for (let r = 12; r > 8; r--) g.tiles.set('8,' + r, { c: 8, r, type: 'block', spawn: 0, timer: 0 }); return g.routeOk({ tile: { c: 8, r: 8, type: 'block' } }); };
  assert.equal(wall5(), false);
  b.out = true;
  assert.equal(g.routeOk({ tile: { c: 8, r: 8, type: 'block' } }), true); // only runner 1 matters now
}

// Runners bounce off each other; landing on a team-mate's head springs you up. Nobody is hurt.
{
  const g = duo();
  const [a, b] = g.players;
  a.x = 100; b.x = 130;
  g.setInput(false, true, false, false, 0);
  g.setInput(true, false, false, false, 1);
  let bumped = false;
  for (let i = 0; i < 60 && !bumped; i++) { g.events = []; g.step(); bumped = g.events.includes('bump'); }
  assert.ok(bumped, 'they met');
  assert.ok(a.vx < 0 && b.vx > 0, 'and flew apart');
  const gapAtBump = b.x - a.x;
  run(g, 5);
  assert.ok(b.x - a.x > gapAtBump + 10, 'the bounce carries even though both still push in');

  const h = duo();
  const [c, d] = h.players;
  c.x = 100; d.x = 100; d.y = c.y - 40; d.vy = 2; d.onGround = false; d.coyote = 0;
  h.setInput(false, false, false, false, 0); h.setInput(false, false, false, false, 1);
  let top = 999, hit = false;
  for (let i = 0; i < 50; i++) { h.events = []; h.step(); hit = hit || h.events.includes('bump'); top = Math.min(top, d.y); }
  assert.ok(hit);
  assert.ok(top < c.y - d.h - 30, 'sprang well clear of the head, top y=' + top);
  assert.equal(h.lives, C.TEAM_LIVES);
}

// ---------- the CPU builder ----------
// Plays whole rounds against runners who are kept alive, and checks that it stays
// within the builder's rules, uses a spread of traps, and plays harder later on.
{
  assert.ok(RECIPES.every((r) => r.steps.every(([item]) => C.ITEMS.some((i) => i.id === item))), 'recipes only use real items');
  const playRound = (level, runners) => {
    const g = new Game({ runners }); g.lifeTimer = Infinity;
    const bot = new BuilderBot(level);
    const realPlace = g.place.bind(g);
    let early = 0, late = 0, refused = 0, minCredits = Infinity, slowest = 0, spent = 0;
    const earlyItems = new Set(); // what it used in the first 40 seconds
    g.place = (...args) => {
      const before = g.credits, why = realPlace(...args);
      if (why) { refused++; assert.equal(g.credits, before, 'a refusal costs nothing'); }
      else { const cost = before - g.credits; spent += cost; if (g.timeLeft > 80 * 60) { early += cost; earlyItems.add(args[0]); } else if (g.timeLeft < 40 * 60) late += cost; }
      return why;
    };
    const diffs = [];
    while (g.phase !== 'over') {
      g.lives = C.TEAM_LIVES; // keep the round going
      if (g.tick % 600 === 0) diffs.push(bot.difficulty(g));
      const t0 = process.hrtime.bigint();
      bot.think(g); g.step();
      slowest = Math.max(slowest, Number(process.hrtime.bigint() - t0) / 1e6);
      minCredits = Math.min(minCredits, g.credits);
    }
    return { bot, early, late, refused, minCredits, slowest, diffs, spent, earlyItems, kinds: Object.keys(bot.placed).length, total: Object.values(bot.placed).reduce((x, y) => x + y, 0) };
  };
  const rounds = [playRound(1, 1), playRound(1, 2), playRound(1, 2)];
  const sum = (k) => rounds.reduce((n, r) => n + r[k], 0);
  for (const r of rounds) {
    assert.ok(r.minCredits >= 0, 'never overspends');
    assert.ok(r.total >= 15, 'builds a fair amount: ' + r.total);
    assert.ok(r.diffs.every((d, i) => i === 0 || d >= r.diffs[i - 1]) && r.diffs[r.diffs.length - 1] > r.diffs[0] + 0.3, 'gets harder through the round: ' + r.diffs.map((d) => d.toFixed(2)));
  }
  assert.ok(Math.max(...rounds.map((r) => r.kinds)) >= 7, 'uses a spread of items: ' + rounds.map((r) => r.kinds));
  assert.ok(sum('late') > sum('early') * 1.15, `spends more in the last 40 seconds than the first 40: ${sum('early')} credits then ${sum('late')}`);
  const hard = playRound(6, 2);
  assert.ok(hard.diffs[0] >= rounds[0].diffs[0] + 0.4, 'a higher level starts harder');
  // the nastier traps are held back at level 1 until late in the round; a high level opens with them
  const nasty = ['flame', 'thorn', 'mine', 'spring', 'ghost', 'wind', 'fog'];
  for (const r of rounds) assert.ok(!nasty.some((i) => r.earlyItems.has(i)), 'level 1 keeps it simple early: ' + [...r.earlyItems]);
  const hardEarly = new Set([...hard.earlyItems, ...playRound(6, 1).earlyItems, ...playRound(6, 2).earlyItems]); // three rounds, since which traps it picks is down to chance
  assert.ok(nasty.some((i) => hardEarly.has(i)), 'level 6 does not: ' + [...hardEarly]);
  console.log(`CPU builder, level 1: ${Math.round(sum('total') / 3)} placements and ${Math.round(sum('spent') / 3)} credits a round, ${rounds.map((r) => r.kinds).join('/')} kinds of item; level 6: ${hard.total} placements, ${hard.spent} credits, ${hard.kinds} kinds. Slowest tick ${Math.max(hard.slowest, ...rounds.map((r) => r.slowest)).toFixed(1)}ms`);
  console.log('  level 1 used:', JSON.stringify(rounds[1].bot.placed));
  console.log('  level 6 used:', JSON.stringify(hard.bot.placed));
}

// Snapshot is plain JSON.
{
  const g = started();
  g.place('slime', 20, 5); g.place('bat', 22, 5);
  run(g, 100);
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.equal(s.t, 'state');
  assert.equal(s.ents.length, 2);
  assert.equal(s.ps[0].ab.length, 4);
}
console.log('all checks passed');
