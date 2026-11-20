// Rule checks for the simulation. Run with: npm test
const assert = require('assert');
const C = require('./public/shared.js');
const { Game } = require('./game.js');

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
  assert.equal(g.player.lives, C.LIVES);
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
  assert.equal(g.player.lives, C.LIVES);
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
  assert.equal(g.player.lives, C.LIVES - 1);
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
  assert.equal(g.player.lives, C.LIVES);
  run(g, 120);
  assert.equal(g.player.lives, C.LIVES - 1);
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
  assert.equal(g.player.lives, C.LIVES);
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
  assert.equal(g.player.lives, C.LIVES - 1);
}

// Flame jet: harmless while off, burns two tiles up while on.
{
  const g = rich();
  g.place('flame', 10, 12);
  run(g, C.SPAWN_TICKS);
  const t = g.tiles.get('10,12');
  g.player.x = 10 * 16 + 3; g.player.y = 11 * 16 + 2 - 16; // standing in the air column above it
  let hurtAt = -1;
  for (let i = 0; i < 150 && hurtAt < 0; i++) { g.player.y = 10 * 16; g.player.vy = 0; g.step(); if (g.player.lives < C.LIVES) hurtAt = t.age % 150; }
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
  assert.equal(g.player.lives, C.LIVES - 1);
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
  assert.equal(g.player.lives, C.LIVES);
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
  assert.equal(g.player.lives, C.LIVES - 1);
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

// Stomping: cannonballs and hoppers die to a stomp, a thorn slime hurts instead.
{
  const drop = (type) => {
    const g = rich();
    if (type === 'bullet') { g.place('cannon', 20, 12); for (let i = 0; i < 400 && !g.ents.length; i++) g.step(); }
    else { g.place(type, 14, 12); run(g, C.SPAWN_TICKS + 1); }
    const e = g.ents[0];
    g.player.invuln = 0;
    for (let i = 0; i < 40 && g.ents.includes(e) && g.player.lives === C.LIVES; i++) {
      g.player.x = e.x + 2 + (e.vx || 0); g.player.y = Math.min(g.player.y, e.y - 16); g.player.vy = Math.max(g.player.vy, 1); g.player.vx = 0;
      g.step();
    }
    return { killed: !g.ents.includes(e), lives: g.player.lives };
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
    g.lifeTimer = 1; g.step();
  } else {
    // clean rounds: check when the first one turns up
    let at = -1;
    for (let i = 0; i < 26 * 60 && at < 0; i++) { g.step(); if (g.ents.some((e) => e.type === 'life')) at = i / 60; }
    assert.ok(at >= 15 && at <= 26, 'first pickup appeared at ' + at + 's');
  }
  const life = g.ents.find((e) => e.type === 'life');
  const c = Math.floor(life.x / 16), r = Math.floor(life.y / 16);
  assert.ok(life.x > g.player.x + 40, 'ahead of the runner');
  assert.ok(g.solidAt(c, 13) && r >= 10 && r <= 12, 'over ground and within a jump');
  for (let rr = r; rr < 13; rr++) assert.ok(!g.tiles.has(c + ',' + rr), 'nothing under it');
  assert.equal(g.place('block', c, r), "can't cover the +1");
  if (round === 0) {
    g.tiles.clear(); g.ents = [life];
    g.player.lives = 1; g.player.invuln = 50; // can be grabbed even while blinking from a hit
    g.player.x = life.x; g.player.y = life.y; g.step();
    assert.equal(g.player.lives, 2);
    assert.ok(!g.ents.includes(life));
    g.player.lives = C.MAX_LIVES;
    g.ents.push({ ...life, dead: false }); g.step();
    assert.equal(g.player.lives, C.MAX_LIVES); // capped
  }
}

// Snapshot is plain JSON.
{
  const g = started();
  g.place('slime', 20, 5); g.place('bat', 22, 5);
  run(g, 100);
  const s = JSON.parse(JSON.stringify(g.snapshot()));
  assert.equal(s.t, 'state');
  assert.equal(s.ents.length, 2);
  assert.equal(s.ab.length, 4);
}
console.log('all checks passed');
