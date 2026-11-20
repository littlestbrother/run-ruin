// The CPU builder. It plays through the same place() call a human builder's
// clicks go through, so it has the same credits, recharges and "must leave a
// way through" rule, and cannot do anything a person couldn't.
//
// It is a set of rules, not a learning AI: every so often it picks one of the
// trap recipes below that it can afford and lays it down a little way ahead of
// the leading runner. How hard it plays is one number from 0 to 1 that rises
// through the round and with the CPU's level:
//   - it acts more often,
//   - tougher recipes become available,
//   - it favours the expensive ones, and saves up for them,
//   - it starts dropping boulders on runners who hang back.
const C = require('./public/shared.js');

const T = C.TILE;
const G = C.GROUND_ROW - 1; // the row of cells sitting on the ground
const COST = Object.fromEntries(C.ITEMS.map((i) => [i.id, i.cost]));

// steps: [item, columns ahead of where the recipe starts, row]
// min: the difficulty at which the CPU starts using it
const RECIPES = [
  { name: 'spike strip', min: 0, steps: [['spike', 0, G], ['spike', 1, G]] },
  { name: 'slime', min: 0, steps: [['slime', 2, G]] },
  { name: 'low wall', min: 0, steps: [['block', 0, G], ['block', 0, G - 1]] },
  { name: 'pit', min: 0.1, steps: [['pit', 0, G + 1]] },
  { name: 'bat', min: 0.15, steps: [['bat', 4, G - 2]] },
  { name: 'hopper', min: 0.2, steps: [['hopper', 3, G]] },
  { name: 'ice into spikes', min: 0.25, steps: [['ice', 0, G], ['ice', 1, G], ['ice', 2, G], ['spike', 4, G], ['spike', 5, G]] },
  { name: 'wall with spikes behind', min: 0.3, steps: [['block', 0, G], ['block', 0, G - 1], ['block', 0, G - 2], ['spike', 2, G], ['spike', 3, G]] },
  { name: 'cannon', min: 0.3, steps: [['cannon', 7, G]] },
  { name: 'wide pit with a bat', min: 0.35, steps: [['pit', 0, G + 1], ['pit', 2, G + 1], ['bat', 5, G - 2]] },
  { name: 'saw', min: 0.4, steps: [['saw', 2, G]] },
  { name: 'crusher gate', min: 0.4, steps: [['block', 0, G], ['block', 2, G], ['crusher', 1, G - 5]] },
  { name: 'flame jet', min: 0.45, steps: [['flame', 0, G]] },
  { name: 'thorn slime', min: 0.5, steps: [['thorn', 3, G]] },
  { name: 'mines', min: 0.5, steps: [['mine', 0, G], ['mine', 3, G]] },
  { name: 'spring into a bat', min: 0.55, steps: [['spring', 0, G], ['bat', 2, G - 6]] },
  { name: 'tall wall with a slime', min: 0.6, steps: [['block', 0, G], ['block', 0, G - 1], ['block', 0, G - 2], ['block', 0, G - 3], ['slime', 3, G]] },
  { name: 'ghost', min: 0.6, steps: [['ghost', 6, G - 3]] },
  { name: 'wind at a pit', min: 0.7, steps: [['pit', 0, G + 1], ['pit', 2, G + 1], ['wind', 0, 0]] },
  { name: 'fog and mines', min: 0.75, steps: [['fog', 0, 0], ['mine', 1, G], ['mine', 4, G], ['hopper', 6, G]] },
  { name: 'gauntlet', min: 0.85, steps: [['flame', 0, G], ['saw', 3, G - 2], ['pit', 5, G + 1], ['thorn', 9, G], ['cannon', 12, G]] },
];
for (const r of RECIPES) {
  r.cost = r.steps.reduce((sum, [item]) => sum + COST[item], 0);
  r.span = Math.max(...r.steps.map(([, dc]) => dc)) + 1;
}

const lerp = (a, b, t) => a + (b - a) * t;

class BuilderBot {
  constructor(level = 1) {
    this.level = level;
    this.wait = 90; // ticks until it next considers building
    this.queue = []; // placements still to make for the recipe in hand
    this.gap = 0; // ticks until the next queued placement
    this.lastEnd = -99; // column where the last recipe finished
    this.backTicks = [0, 0]; // how long each runner has been hanging at the back of the screen
    this.target = null; // the recipe it has decided on and is saving up for
    this.patience = 0;
    this.placed = {}; // item id -> how many it has placed (for tests and curiosity)
  }

  // 0 (gentle) to 1 (everything it has)
  difficulty(game) {
    const progress = game.phase === 'play' ? 1 - game.timeLeft / (C.ROUND_SECONDS * C.FPS) : 0;
    return Math.max(0, Math.min(1, 0.1 + 0.55 * progress + 0.1 * (this.level - 1)));
  }

  place(game, item, c, r) {
    const refused = game.place(item, c, r);
    if (!refused) this.placed[item] = (this.placed[item] || 0) + 1;
    return !refused;
  }

  // Call once per game tick, before the game steps.
  think(game) {
    if (game.phase === 'over') return;
    const d = this.difficulty(game);
    this.punishHangingBack(game, d);

    // Lay the current recipe one piece at a time, so the runners see it going up.
    if (this.queue.length) {
      if (--this.gap <= 0) {
        const [item, c, r] = this.queue.shift();
        this.place(game, item, c, r); // a refusal (no room, would block the path...) just skips that piece
        this.gap = 5;
      }
      return;
    }
    if (--this.wait > 0) return;

    // Decide what to build next, then wait until it can be paid for. Choosing first and
    // saving second is what gets the dear combinations built at all; buying whatever is
    // affordable right now would only ever produce the cheap ones.
    const usable = (r) => r.steps.every(([item]) => !(game.itemCd[item] > 0) && !((item === 'wind' || item === 'fog') && game.phase !== 'play'));
    if (!this.target) {
      const known = RECIPES.filter((r) => r.min <= d && r.cost <= C.CREDIT_TIERS[game.tier].cap && usable(r));
      if (!known.length) { this.wait = 20; return; }
      // Easy: any recipe it knows is as likely as another. Hard: weighted toward the expensive ones.
      let total = 0;
      const weights = known.map((r) => (total += 1 + d * r.cost));
      const roll = Math.random() * total;
      this.target = known[weights.findIndex((w) => roll < w)] || known[0];
      this.patience = 300; // ticks it will save for this before settling for something else
    }
    if (this.target.cost > game.credits || !usable(this.target)) {
      if (--this.patience > 0) return;
      this.target = null; // took too long: think again
      return;
    }
    const recipe = this.target;
    this.target = null;

    const alive = game.alive();
    if (!alive.length) return;
    const leadCol = Math.max(...alive.map((p) => Math.floor((p.x + p.w / 2) / T)));
    const camCol = Math.floor(game.camX / T);
    const first = leadCol + C.MIN_BUILD_DIST_COLS + 1;
    const last = camCol + C.BUILDER_COLS - recipe.span;
    // usually just past the previous one, so recipes don't pile on top of each other
    let anchor = Math.max(first + Math.floor(Math.random() * 5), this.lastEnd + 2);
    if (anchor > last) anchor = first + Math.floor(Math.random() * Math.max(1, last - first + 1));
    this.lastEnd = anchor + recipe.span;
    this.queue = recipe.steps.map(([item, dc, r]) => [item, anchor + dc, r]);
    this.gap = 0;
    this.wait = Math.round(lerp(170, 30, d) * (0.7 + Math.random() * 0.6));
  }

  // A runner who sits at the left edge letting the screen carry them gets a boulder.
  punishHangingBack(game, d) {
    if (d < 0.2 || game.phase !== 'play') return;
    game.players.forEach((p, i) => {
      if (p.out || p.x - game.camX > 36) { this.backTicks[i] = 0; return; }
      if (++this.backTicks[i] < lerp(240, 80, d)) return;
      if (this.place(game, 'boulder', Math.floor((p.x + p.w / 2) / T), 0)) this.backTicks[i] = 0;
      else this.backTicks[i] -= 30; // couldn't (recharging or broke): try again shortly
    });
  }
}

module.exports = { BuilderBot, RECIPES };
