// Constants used by both the server (game rules) and the browser (drawing + UI).
// Tweak the numbers here to rebalance the game.
(function (root) {
  const SHARED = {
    TILE: 16,
    ROWS: 15,
    GROUND_ROW: 13, // rows 13 and 14 are ground
    VIEW_COLS: 16, // what the runner sees
    BUILDER_COLS: 32, // what the builder sees (runner's screen + what is coming)
    FPS: 60,

    ROUND_SECONDS: 120,
    SCENE_SECONDS: 25, // how long each background / time of day lasts before fading to the next
    COUNTDOWN_SECONDS: 5,
    LIVES: 3,
    MAX_LIVES: 5,
    // A +1 life pickup appears at a random moment in each of these windows (seconds).
    LIFE_FIRST_SECONDS: [15, 25],
    LIFE_EVERY_SECONDS: [20, 35],

    START_CREDITS: 25,
    // The builder earns faster, and can bank more, as the round goes on.
    // "from" is seconds survived.
    CREDIT_TIERS: [
      { from: 0, perSecond: 1.5, cap: 45 },
      { from: 40, perSecond: 2.25, cap: 60 },
      { from: 80, perSecond: 3, cap: 75 },
    ],

    MIN_BUILD_DIST_COLS: 5, // builder cannot place closer than this in front of the runner
    SPAWN_TICKS: 30, // new things flicker harmlessly this long
    BOULDER_WARN_TICKS: 50,
    WIND_SECONDS: 3,
    FOG_SECONDS: 4,
    FOG_START_X: 144, // fog hides the runner's screen from this x to its right edge
    GHOST_SECONDS: 8,
    MINE_HIDE_TICKS: 90, // a mine vanishes from the runner's view this long after it finishes appearing

    // Runner moves. "unlock" is seconds survived; "duration" and "cooldown" are
    // seconds. The recharge starts once the move's effect has ended.
    ABILITIES: [
      { id: 'triple', name: 'TRIPLE JUMP', key: '1', unlock: 20, duration: 8, cooldown: 15 },
      { id: 'laser', name: 'LASER VISION', key: '2', unlock: 45, duration: 0, cooldown: 10 },
      { id: 'explode', name: 'EXPLODE', key: '3', unlock: 70, duration: 0, cooldown: 25 },
      { id: 'fly', name: 'FLY', key: '4', unlock: 95, duration: 5, cooldown: 30 },
    ],

    // Things the runner destroys by landing on top of them. The runner's screen marks these with an arrow.
    STOMPABLE: ['slime', 'bat', 'crusher', 'hopper', 'bullet'],

    // Bricks share one counter: after `burst` of them (any mix), all brick items lock
    // for `cooldown` seconds. Going that long without placing one resets the count.
    BRICKS: { items: ['block', 'crumble'], burst: 5, cooldown: 2 },

    // "cooldown" is seconds before the builder can place that item again (0 = no wait).
    // For wind and fog it starts counting once the effect has ended.
    ITEMS: [
      { id: 'block', name: 'BLOCK', cost: 1, key: '1', cooldown: 0 },
      { id: 'crumble', name: 'CRUMBLE', cost: 1, key: '2', cooldown: 0 },
      { id: 'spike', name: 'SPIKES', cost: 2, key: '3', cooldown: 0 },
      { id: 'slime', name: 'SLIME', cost: 3, key: '4', cooldown: 3 },
      { id: 'pit', name: 'PIT', cost: 3, key: '5', cooldown: 0 },
      { id: 'bat', name: 'BAT', cost: 4, key: '6', cooldown: 4 },
      { id: 'boulder', name: 'BOULDER', cost: 4, key: '7', cooldown: 5 },
      { id: 'cannon', name: 'CANNON', cost: 6, key: '8', cooldown: 6 },
      { id: 'saw', name: 'SAW', cost: 4, key: '9', cooldown: 5 },
      { id: 'flame', name: 'FLAME JET', cost: 3, key: '0', cooldown: 4 },
      { id: 'crusher', name: 'CRUSHER', cost: 5, key: 'q', cooldown: 6 },
      { id: 'ghost', name: 'GHOST', cost: 5, key: 'w', cooldown: 10 },
      { id: 'mine', name: 'MINE', cost: 3, key: 'e', cooldown: 4 },
      { id: 'spring', name: 'SPRING', cost: 2, key: 'r', cooldown: 2 },
      { id: 'ice', name: 'ICE', cost: 1, key: 't', cooldown: 0 },
      { id: 'goo', name: 'GOO', cost: 2, key: 'y', cooldown: 1 },
      { id: 'wind', name: 'WIND', cost: 4, key: 'u', cooldown: 12 },
      { id: 'fog', name: 'FOG', cost: 4, key: 'i', cooldown: 15 },
      { id: 'hopper', name: 'HOPPER', cost: 3, key: 'o', cooldown: 3 },
      { id: 'thorn', name: 'THORN SLIME', cost: 4, key: 'p', cooldown: 5 },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHARED;
  else root.SHARED = SHARED;
})(this);
