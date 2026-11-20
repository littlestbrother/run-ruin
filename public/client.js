/* global SHARED */
(() => {
  const C = SHARED;
  const T = C.TILE;
  const H = C.ROWS * T;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------
  // Pixel art
  // ------------------------------------------------------------------
  const PAL = {
    k: '#000000', w: '#fcfcfc', l: '#bcbcbc', d: '#7c7c7c', D: '#3c3c3c',
    c: '#3cbcfc', b: '#0058f8', y: '#f8b800', r: '#d82800', m: '#881400',
    g: '#00a800', G: '#b8f818', p: '#6844fc', P: '#a488fc', n: '#ac7c00',
    N: '#503000', o: '#e45c10', s: '#fca044', t: '#f0d0b0',
    B: '#3838a8', h: '#6868e8', // ninja garb and its highlight
  };

  // `recolour` swaps palette letters for other colours, e.g. { B: '#a82828' }
  function sprite(rows, flip, recolour) {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        g.fillStyle = (recolour && recolour[ch]) || PAL[ch] || '#f0f';
        g.fillRect(flip ? 15 - x : x, y, 1, 1);
      }
    });
    return cv;
  }

  // The runner: a ninja in indigo garb with a red headband (tails streaming
  // behind), a strip of face showing through the mask, and a red sash.
  const HERO_TOP = [
    '................',
    '.....kkkkkk.....',
    '....kBhhBBBBk...',
    '.rrkBhBBBBBBk...',
    'r.rkrrrrrrrrk...',
    '...kBttwktwkk...',
    '...kBBBBBBBBk...',
    '....kkBBBBkk....',
    '...kBhBBBBBBk...',
    '..kBkBBBBBBkBk..',
    '..ktkBrrrrBktk..',
    '...kkBBrBBBkk...',
    '....kBBkkBBk....',
  ];
  const HERO_LEGS = {
    stand: ['....kBk..kBk....', '....kBk..kBk....', '....kkk..kkk....'],
    run: ['...kBk....kBk...', '..kBk......kBk..', '..kkk......kkk..'],
    jump: ['...kBk....kBk...', '...kkk....kkk...', '................'],
  };
  // Runner 1 wears indigo with a red headband; runner 2 wears red with a yellow one.
  const RUNNER_COLOURS = ['#6868e8', '#e86060'];
  const heroes = [null, { B: '#a82828', h: '#e86060', r: '#f8d838' }].map((recolour) => {
    const set = {};
    for (const pose of Object.keys(HERO_LEGS)) {
      const rows = HERO_TOP.concat(HERO_LEGS[pose]);
      set[pose] = { 1: sprite(rows, false, recolour), '-1': sprite(rows, true, recolour) };
    }
    return set;
  });

  const slimeA = sprite([
    '', '', '', '',
    '......kkkk......',
    '....kkgGGgkk....',
    '...kgGggggggk...',
    '..kgGggggggggk..',
    '..kggwkggwkggk..',
    '.kgggwkggwkgggk.',
    '.kggggggggggggk.',
    '.kgggkkkkkkgggk.',
    '.kggggggggggggk.',
    '..kkggggggggkk..',
    '....kkkkkkkk....',
    '',
  ]);
  const slimeB = sprite([
    '', '', '', '', '', '',
    '.....kkkkkk.....',
    '...kkgGGgggkk...',
    '..kgGggggggggk..',
    '.kgggwkggwkgggk.',
    '.kgggwkggwkgggk.',
    'kggggggggggggggk',
    'kggggkkkkkkggggk',
    '.kkggggggggggkk.',
    '...kkkkkkkkkk...',
    '',
  ]);
  const batA = sprite([
    '', '', '',
    'kk............kk',
    'kpk....kk....kpk',
    'kppk..kppk..kppk',
    'kpppkkppppkkpppk',
    'kpppppyppyppPppk',
    '.kpppppppppppPk.',
    '.kpkkpppppkkpk..',
    '..k..kwppwk..k..',
    '......kkkk......',
    '', '', '', '',
  ]);
  const batB = sprite([
    '', '', '', '', '',
    '......kkkk......',
    '.kkkkkppppkkkkk.',
    'kpppppyppypppppk',
    'kppkppppppppkppk',
    'kpk.kpppppk..kpk',
    'kk...kwppwk...kk',
    'k.....kkkk.....k',
    '', '', '', '',
  ]);
  const boulder = sprite([
    '.....kkkkkk.....',
    '...kkllllllkk...',
    '..kllllllldddk..',
    '.klllwlllddddDk.',
    '.kllwllldddddDk.',
    'klllllldddddddDk',
    'kllllldddDdddDDk',
    'kllllddddddddDDk',
    'klllddddddddDDDk',
    'kllddddDdddDDDDk',
    'klddddddddDDDDDk',
    '.kddddddDDDDDDk.',
    '.kdddDDDDDDDDDk.',
    '..kDDDDDDDDDDk..',
    '...kkDDDDDDkk...',
    '.....kkkkkk.....',
  ]);
  const tiles = {
    grass: sprite([
      'GGGGGGGGGGGGGGGG',
      'gggggggggggggggg',
      'gggggggggggggggg',
      'gNggggNgggNggggN',
      'NnNggNnNgNnNggNn',
      'nnnNNnnnNnnnNNnn',
      'nnnnnnnnnnnnnnnn',
      'nnNnnnnnnnnnNnnn',
      'nnnnnnnsnnnnnnnn',
      'nnnnnnnnnnnnnnnn',
      'nsnnnnnnnnNnnnnn',
      'nnnnnNnnnnnnnnsn',
      'nnnnnnnnnnnnnnnn',
      'nnnnnnnnsnnnnnnn',
      'nnNnnnnnnnnnnNnn',
      'nnnnnnnnnnnnnnnn',
    ]),
    dirt: sprite([
      'nnnnnnnnnnnnnnnn',
      'nnnNnnnnnnnsnnnn',
      'nnnnnnnnnnnnnnnn',
      'nnnnnnnnNnnnnnnn',
      'nsnnnnnnnnnnnnNn',
      'nnnnnnnnnnnnnnnn',
      'nnnnnNnnnnsnnnnn',
      'nnnnnnnnnnnnnnnn',
      'nnNnnnnnnnnnnnnn',
      'nnnnnnnnnnnnNnnn',
      'nnnnnnnsnnnnnnnn',
      'nnnnnnnnnnnnnnnn',
      'Nnnnnnnnnnnnnnsn',
      'nnnnnNnnnnnnnnnn',
      'nnnnnnnnnnNnnnnn',
      'nnnnnnnnnnnnnnnn',
    ]),
    block: sprite([
      'sssssssksssssssk',
      'soooooomsoooooom',
      'soooooomsoooooom',
      'kmmmmmmkkmmmmmmk',
      'ssskssssssskssss',
      'oomksoooooomksoo',
      'oomksoooooomksoo',
      'mmkkkmmmmmmkkkmm',
      'sssssssksssssssk',
      'soooooomsoooooom',
      'soooooomsoooooom',
      'kmmmmmmkkmmmmmmk',
      'ssskssssssskssss',
      'oomksoooooomksoo',
      'oomksoooooomksoo',
      'kkkkkkkkkkkkkkkk',
    ]),
    crumble: sprite([
      'kkkkkkkkkkkkkkkk',
      'kttttttNtttttttk',
      'ktttttNttttttttk',
      'kttttNtttttNtttk',
      'ktttNNttttNttttk',
      'kttttNtttNtttttk',
      'kNtttttNNttttttk',
      'ktNtttNttttttNtk',
      'kttNtNttttttNttk',
      'ktttNttttNtNtttk',
      'kttttttttNtttttk',
      'ktttttttNttttttk',
      'kssssssNsssssssk',
      'kkkkkk.kkkk.kkkk',
      '.kk.k...kk...k..',
      '',
    ]),
    spike: sprite([
      '', '', '', '', '', '',
      '..w....w....w...',
      '..w....w....w...',
      '.klk..klk..klk..',
      '.klk..klk..klk..',
      '.kldk.kldk.kldk.',
      'klldkklldkklldk.',
      'kllddkllddkllddk',
      'kllddkllddkllddk',
      'klldddlldddllddk',
      'kkkkkkkkkkkkkkkk',
    ]),
    cannon: sprite([
      'kkkkkkkkkkkkkkkk',
      'kDDDDDDDDDDDDDDk',
      'kDddddddddddddDk',
      'kDdDDDDDDDDDDdDk',
      'kkkkDDDDDDDDkkkk',
      'kkkkkDDrrDDkkkkk',
      'kkkkkDrrrrDkkkkk',
      'kkkkkDrrrrDkkkkk',
      'kkkkkDDrrDDkkkkk',
      'kkkkDDDDDDDDkkkk',
      'kDdDDDDDDDDDDdDk',
      'kDddddddddddddDk',
      'kDDDDDDDDDDDDDDk',
      'kkkkkkkkkkkkkkkk',
      '..kDDk....kDDk..',
      '..kkkk....kkkk..',
    ]),
    pit: sprite([
      'GGG..........GGG',
      'ggg..........ggg',
      'nnn..........nnn',
      'nnn....rr....nnn',
      'nnn....rr....nnn',
      'nnn....rr....nnn',
      'nnn....rr....nnn',
      'nnn.rrrrrrrr.nnn',
      'nnn..rrrrrr..nnn',
      'nnn...rrrr...nnn',
      'nnn....rr....nnn',
      'nnn..........nnn',
      'nnn..........nnn',
      'nnn..........nnn',
      'nnn..........nnn',
      'nnn..........nnn',
    ]),
  };
  Object.assign(tiles, {
    flame: sprite([
      'kkkkkkrrrrkkkkkk',
      'kDDDDkryyrkDDDDk',
      'kDddDkryyrkDddDk',
      'kDddDkkkkkkDddDk',
      'kDddddddddddddDk',
      'kDdDDDDDDDDDDdDk',
      'kDdDyDDDDDDyDdDk',
      'kDdDDDDDDDDDDdDk',
      'kDdDDDDyyDDDDdDk',
      'kDdDDDDyyDDDDdDk',
      'kDdDDDDDDDDDDdDk',
      'kDdDyDDDDDDyDdDk',
      'kDdDDDDDDDDDDdDk',
      'kDddddddddddddDk',
      'kDDDDDDDDDDDDDDk',
      'kkkkkkkkkkkkkkkk',
    ]),
    mine: sprite([
      '', '', '', '', '', '', '', '', '',
      '......krrk......',
      '.....kkrrkk.....',
      '...kkDDDDDDkk...',
      '..kDDdDDDDDDDk..',
      '.kDDdDDDDDDDDDk.',
      '.kDDDDDDDDDDDDk.',
      'kkkkkkkkkkkkkkkk',
    ]),
    spring: sprite([
      '', '', '', '', '', '', '', '',
      'kkkkkkkkkkkkkkkk',
      'krrrrrrrrrrrrrrk',
      'kkkkkkkkkkkkkkkk',
      '...kllllllllk...',
      '.....kllllk.....',
      '...kllllllllk...',
      '.....kllllk.....',
      '..kkkkkkkkkkkk..',
    ]),
    ice: sprite([
      '', '', '', '', '', '', '', '', '', '', '', '',
      'kkkkkkkkkkkkkkkk',
      'wwcwwwwwcwwwwwcw',
      'cccccwcccccccwcc',
      'cccccccccccccccc',
    ]),
    goo: sprite([
      '', '', '', '', '', '', '', '', '', '',
      '....pp......p...',
      '..pPPPp...pPPp..',
      '.pPPPPPpppPPPPp.',
      'pPPwPPPPPPPPwPPp',
      'pPPPPPPPPPPPPPPp',
      'pppppppppppppppp',
    ]),
  });
  const crusher = sprite([
    'kkkkkkkkkkkkkkkk',
    'kllllllllllllldk',
    'klddddddddddddDk',
    'kldkkkddddkkkdDk',
    'klddkrkddkrkddDk',
    'klddkkkddkkkddDk',
    'klddddddddddddDk',
    'klddkkkkkkkkddDk',
    'kldkkddddddkkdDk',
    'klddddddddddddDk',
    'kdDDDDDDDDDDDDDk',
    'kkkkkkkkkkkkkkkk',
    'kwk.kwk..kwk.kwk',
    'kwk.kwk..kwk.kwk',
    'kwk.kwk..kwk.kwk',
    '.k...k....k...k.',
  ]);
  const ghost = sprite([
    '',
    '.....wwwwww.....',
    '...wwwwwwwwww...',
    '..wwwwwwwwwwww..',
    '..wwkkwwwwkkww..',
    '.wwwkkwwwwkkwww.',
    '.wwwwwwwwwwwwww.',
    '.wwwwwwkkwwwwww.',
    '.wwwwwkkkkwwwww.',
    '.wwwwwwkkwwwwww.',
    '.wwwwwwwwwwwwww.',
    '.wwwwwwwwwwwwww.',
    '.ww.www..www.ww.',
    '.w...w....w...w.',
    '', '',
  ]);
  const windIcon = sprite([
    '', '',
    '..wwwwwwww......',
    '..........ww....',
    'wwwwwwwwwww.w...',
    '...........ww...',
    '',
    '....wwwwwwwwww..',
    '..............w.',
    '.wwwwwwwwwwww.w.',
    '.............w..',
    '',
    '..wwwwwww.......',
    '', '', '',
  ]);
  const fogIcon = sprite([
    '', '', '',
    '.....llll.......',
    '...llllllll.lll.',
    '..llllllllllllll',
    '.lllllllllllllll',
    'llllllllllllllll',
    '.lllldddllllddl.',
    '..ddddddddddddd.',
    '....dddd..ddd...',
    '', '', '', '', '',
  ]);
  const hopper = sprite([
    '', '', '', '', '', '',
    '..kkk......kkk..',
    '.kwwkkkkkkkkwwk.',
    '.kwkkoooooookwk.',
    '.kooosooooooook.',
    '.kooooooooooook.',
    '.kokkkkkkkkkkok.',
    '.kooooooooooook.',
    'kkkooookkooookkk',
    'kok.kkk..kkk.kok',
    'kk............kk',
  ]);
  // Same body as the slime, with spikes on top and red eyes: do not stomp.
  const thorn = sprite([
    '', '',
    '.......ww.......',
    '...w..kwwk..w...',
    '..kwk.kwwk.kwk..',
    '..kwkkgggGkkwk..',
    '...kgGggggggk...',
    '..kgGggggggggk..',
    '..kggrkggrkggk..',
    '.kgggrkggrkgggk.',
    '.kggggggggggggk.',
    '.kgggkkkkkkgggk.',
    '.kggggggggggggk.',
    '..kkggggggggkk..',
    '....kkkkkkkk....',
    '',
  ]);
  const heart = sprite([
    '',
    '..kkkk....kkkk..',
    '.krrrrk..krrrrk.',
    'krwwrrrkkrrrrrrk',
    'krwrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    '.krrrrrrrrrrrrk.',
    '..krrrrrrrrrrk..',
    '...krrrrrrrrk...',
    '....krrrrrrk....',
    '.....krrrrk.....',
    '......krrk......',
    '.......kk.......',
    '', '',
  ]);
  // A toothed disc, drawn at two rotations so it looks like it spins.
  const sawFrame = (turn) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d');
    g.fillStyle = PAL.k;
    for (let i = 0; i < 8; i++) {
      const a = (i + turn) * Math.PI / 4;
      g.fillRect(Math.round(7 + Math.cos(a) * 6.5) - 1, Math.round(7 + Math.sin(a) * 6.5) - 1, 4, 4);
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 6.2) continue;
      g.fillStyle = d > 5.2 ? PAL.k : d < 1.6 ? PAL.D : (x + y + turn * 2) % 5 === 0 ? PAL.w : PAL.l;
      g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = PAL.w;
    for (let i = 0; i < 8; i++) {
      const a = (i + turn) * Math.PI / 4;
      g.fillRect(Math.round(7 + Math.cos(a) * 6.5), Math.round(7 + Math.sin(a) * 6.5), 2, 2);
    }
    return cv;
  };
  const saws = [sawFrame(0), sawFrame(0.5)];

  const ICONS = {
    block: tiles.block, crumble: tiles.crumble, spike: tiles.spike, slime: slimeA,
    pit: tiles.pit, bat: batA, boulder, cannon: tiles.cannon,
    saw: saws[0], flame: tiles.flame, crusher, ghost, mine: tiles.mine, spring: tiles.spring,
    ice: tiles.ice, goo: tiles.goo, wind: windIcon, fog: fogIcon, hopper, thorn,
  };
  const ABOUT = {
    block: 'Solid brick.',
    crumble: 'Breaks soon after the runner stands on it.',
    spike: 'Hurts on touch. Needs a floor under it. Must leave the runner a safe way past.',
    slime: 'Walks along the ground. Can be stomped.',
    pit: 'Removes 2 tiles of ground.',
    bat: 'Flies at the runner in a wave. Can be stomped.',
    boulder: "Drops anywhere on the runner's screen after a warning, then rolls.",
    cannon: 'Solid. Fires big cannonballs, which can be stomped.',
    saw: 'Slides back and forth. Cannot be stomped.',
    flame: 'Solid. Fires 2 tiles upward on a timer. Must leave the runner a safe way past.',
    crusher: 'Slams down when the runner walks under it. Can be stomped from above.',
    ghost: 'Chases through walls for 8 seconds. Cannot be stomped.',
    mine: 'Turns invisible to the runner, then blows up when they get close.',
    spring: 'Throws the runner high into the air.',
    ice: 'Slippery floor.',
    goo: 'Sticky floor that slows the runner.',
    wind: 'Pushes the runner back for 3 seconds. Click anywhere.',
    fog: "Hides most of the runner's view for 4 seconds. Click anywhere.",
    hopper: 'Leaps toward the runner. Can be stomped.',
    thorn: 'A slime with spikes on top. Cannot be stomped.',
  };
  const STOMP_WIDTH = { slime: 20, bat: 20, crusher: 14, hopper: 14, bullet: 12 }; // for centring the stomp arrow
  const GLOBAL_ITEMS = { wind: 1, fog: 1 }; // affect the whole screen, not one spot

  // ------------------------------------------------------------------
  // Sound (square-wave beeps)
  // ------------------------------------------------------------------
  let audio = null;
  let muted = false;
  function initAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  }
  function tone(freq, dur, type = 'square', vol = 0.08, slideTo = 0, delay = 0) {
    if (!audio || muted) return;
    const t0 = audio.currentTime + delay;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const SFX = {
    jump: () => tone(330, 0.15, 'square', 0.07, 660),
    jump2: () => tone(494, 0.15, 'square', 0.07, 988),
    walljump: () => { tone(196, 0.05, 'square', 0.09); tone(587, 0.16, 'square', 0.07, 1175, 0.04); },
    stomp: () => tone(200, 0.12, 'square', 0.1, 80),
    hurt: () => { tone(220, 0.25, 'sawtooth', 0.12, 55); },
    place: () => tone(880, 0.05, 'square', 0.04),
    warn: () => { tone(1200, 0.08, 'square', 0.06); tone(1200, 0.08, 'square', 0.06, 0, 0.14); },
    shoot: () => tone(160, 0.18, 'sawtooth', 0.08, 60),
    crack: () => tone(140, 0.08, 'square', 0.06),
    break: () => tone(110, 0.2, 'sawtooth', 0.08, 40),
    thud: () => tone(70, 0.2, 'triangle', 0.2, 35),
    beep: () => tone(988, 0.08, 'square', 0.06),
    deny: () => tone(120, 0.12, 'square', 0.06),
    go: () => tone(784, 0.4, 'square', 0.08),
    bump: () => tone(240, 0.09, 'square', 0.08, 480),
    power: () => tone(440, 0.3, 'square', 0.07, 1760),
    lifeup: () => [1047, 1319, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.05, 0, i * 0.07)),
    life: () => [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone(f, 0.1, 'square', 0.08, 0, i * 0.09)),
    boing: () => tone(180, 0.3, 'square', 0.09, 900),
    flame: () => tone(90, 0.5, 'sawtooth', 0.07, 140),
    wind: () => { tone(300, 1.2, 'sawtooth', 0.04, 120); tone(520, 1.2, 'triangle', 0.05, 200); },
    fog: () => tone(110, 1.0, 'triangle', 0.12, 70),
    laser: () => { tone(1800, 0.25, 'sawtooth', 0.09, 200); tone(900, 0.25, 'square', 0.05, 100); },
    boom: () => { tone(120, 0.5, 'sawtooth', 0.2, 30); tone(60, 0.6, 'triangle', 0.25, 25); },
    unlock: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.07, 0, i * 0.08)),
    tier: () => [330, 262, 330, 262].forEach((f, i) => tone(f, 0.12, 'sawtooth', 0.07, 0, i * 0.1)),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.08, 0, i * 0.14)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'square', 0.08, 0, i * 0.18)),
  };
  const sfx = (name) => { if (SFX[name]) SFX[name](); };

  const SONG = [57, 0, 60, 64, 57, 0, 60, 64, 53, 0, 57, 60, 53, 0, 57, 60,
    55, 0, 59, 62, 55, 0, 59, 62, 52, 0, 56, 59, 52, 56, 59, 64];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // Short bursts of hiss for drums.
  let noiseBuf = null;
  function noise(dur, vol, delay, highpass) {
    if (!audio || muted) return;
    if (!noiseBuf) {
      noiseBuf = audio.createBuffer(1, audio.sampleRate / 2, audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = audio.currentTime + delay;
    const src = audio.createBufferSource();
    src.buffer = noiseBuf;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const g = audio.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(audio.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // The music builds through the round. `p` is how far through it we are (0 to 1):
  //   from the start  the arpeggio with one bass note per bar
  //   25%             a bouncing bass line
  //   45%             kick and snare
  //   60%             hi-hats
  //   70%             the tune doubled an octave up, with its gaps filled in
  //   85%             everything shifts up a tone
  // and it gets steadily faster the whole way, with one more push in the last 10 seconds.
  const STEP_SLOW = 0.150, STEP_FAST = 0.092; // seconds per note
  let songStep = 0;
  let songNext = 0;
  let songTimer = null;
  function songProgress() {
    if (!state || state.phase !== 'play') return 0;
    return Math.min(1, Math.max(0, 1 - state.time / C.ROUND_SECONDS));
  }
  function playStep(at, p) {
    const d = Math.max(0, at - audio.currentTime);
    const i = songStep % SONG.length;
    const shift = p >= 0.85 ? 2 : 0;
    const root = SONG[i - (i % 8)] + shift; // the bar's first note names its chord
    const n = SONG[i] ? SONG[i] + shift : p >= 0.7 ? root + 7 : 0;
    if (n) {
      tone(midi(n), 0.11, 'square', 0.025, 0, d);
      if (p >= 0.7) tone(midi(n + 12), 0.08, 'square', 0.012, 0, d);
    }
    if (i % 8 === 0) tone(midi(root - 24), p >= 0.25 ? 0.2 : 0.5, 'triangle', 0.09, 0, d);
    else if (p >= 0.25 && i % 2 === 0) tone(midi(root - (i % 4 === 2 ? 12 : 24)), 0.12, 'triangle', 0.08, 0, d);
    if (p >= 0.45) {
      if (i % 4 === 0) tone(150, 0.12, 'triangle', 0.2, 40, d); // kick
      if (i % 8 === 4) noise(0.12, 0.07, d, 1000); // snare
    }
    if (p >= 0.6 && i % 2 === 1) noise(0.03, 0.03, d, 6000); // hi-hat
  }
  function music(on) {
    if (on && !songTimer) {
      songStep = 0;
      songNext = 0;
      // Notes are booked slightly ahead on the audio clock so the beat stays even.
      songTimer = setInterval(() => {
        if (!audio) return;
        if (songNext < audio.currentTime - 0.2) songNext = audio.currentTime + 0.05; // just started, or the tab was asleep
        while (songNext < audio.currentTime + 0.12) {
          const p = songProgress();
          playStep(songNext, p);
          songStep++;
          const finalPush = state && state.phase === 'play' && state.time <= 10 ? 0.88 : 1;
          songNext += (STEP_SLOW - (STEP_SLOW - STEP_FAST) * p) * finalPush;
        }
      }, 25);
    } else if (!on && songTimer) {
      clearInterval(songTimer);
      songTimer = null;
    }
  }

  // ------------------------------------------------------------------
  // Connection + lobby
  // ------------------------------------------------------------------
  let ws = null;
  let role = null; // 'runner1', 'runner2', 'builder', or null when just watching
  let isRunner = false;
  let me = -1; // which runner in the game this browser controls
  const SEATS = ['runner1', 'runner2', 'builder'];
  let lobby = null;
  let state = null;
  let selected = 'block';
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'lobby') onLobby(m);
      else if (m.t === 'state') onState(m);
      else if (m.t === 'deny') { flash(m.reason); sfx('deny'); }
    };
    ws.onclose = () => {
      state = null;
      music(false);
      showLobby();
      $('lobbyMsg').textContent = 'Lost connection. Reconnecting...';
      setTimeout(connect, 1000);
    };
  }

  function showLobby() {
    $('lobby').classList.remove('hidden');
    $('gameScreen').classList.add('hidden');
  }

  function onLobby(m) {
    lobby = m;
    role = m.you;
    isRunner = role === 'runner1' || role === 'runner2';
    me = m.me;
    if (m.inGame) return; // state messages drive the game screen
    state = null;
    music(false);
    showLobby();
    showJoinHint(m.joinUrl);
    for (const seat of SEATS) {
      const btn = $('pick-' + seat), st = m.seats[seat];
      const mine = role === seat;
      const cpuHere = seat === 'builder' && m.cpu && !st.taken;
      btn.classList.toggle('mine', mine);
      btn.classList.toggle('taken', st.taken && !mine);
      btn.classList.toggle('cpu', cpuHere);
      btn.querySelector('em').textContent = cpuHere ? `CPU - LEVEL ${m.cpuLevel}`
        : mine ? (st.ready ? 'YOU - READY!' : 'YOU') : st.taken ? (st.ready ? 'TAKEN - READY!' : 'TAKEN') : 'OPEN';
    }
    $('cpuBtn').textContent = m.cpu ? `CPU BUILDER: ON (LEVEL ${m.cpuLevel})` : 'CPU BUILDER: OFF';
    $('cpuBtn').classList.toggle('on', m.cpu);
    $('cpuBtn').disabled = m.seats.builder.taken;
    const ready = role && m.seats[role].ready;
    $('readyBtn').disabled = !role;
    $('readyBtn').classList.toggle('on', !!ready);
    $('readyBtn').textContent = ready ? 'WAITING...' : 'READY';
    const hasRunner = m.seats.runner1.taken || m.seats.runner2.taken;
    const hasBuilder = m.seats.builder.taken || m.cpu;
    $('lobbyMsg').textContent = m.notice || (!role ? 'Pick a seat.'
      : !hasBuilder ? 'Needs a builder: someone takes that seat, or switch the CPU builder on.'
        : !hasRunner ? 'Needs at least one runner.' : 'Starts when everyone seated is ready.');
  }

  for (const seat of SEATS) $('pick-' + seat).onclick = () => { initAudio(); send({ t: 'role', role: role === seat ? null : seat }); };
  $('cpuBtn').onclick = () => { initAudio(); send({ t: 'cpu', on: !(lobby && lobby.cpu) }); };
  $('readyBtn').onclick = () => { initAudio(); send({ t: 'ready' }); };
  $('rematchBtn').onclick = () => send({ t: 'rematch' });
  $('swapBtn').onclick = () => send({ t: 'swap' });

  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  function showJoinHint(joinUrl) {
    const url = !local ? location.origin : joinUrl || `http://<this computer's LAN IP>:${location.port || 80}`;
    $('joinHint').textContent = `Other players join at ${url}`;
  }
  showJoinHint('');

  $('icon-runner1').getContext('2d').drawImage(heroes[0].stand[1], 0, 0);
  $('icon-runner2').getContext('2d').drawImage(heroes[1].stand[1], 0, 0);
  $('icon-builder').getContext('2d').drawImage(tiles.cannon, 0, 0);

  // ------------------------------------------------------------------
  // Game screen
  // ------------------------------------------------------------------
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let viewCols = 0;
  let scale = 1;
  let banner = { text: '', until: 0, small: false };
  const showBanner = (text, ms, small) => { banner = { text, until: performance.now() + ms, small: !!small }; };
  let mouse = null; // {x, y} in canvas pixels
  let lastCell = '';
  let painting = false;

  function layout() {
    const cols = isRunner ? C.VIEW_COLS : C.BUILDER_COLS;
    if (cols !== viewCols) { viewCols = cols; canvas.width = cols * T; canvas.height = H; }
    // room for everything that isn't the picture: top bar, moves strip, and the builder's item row
    const reserved = role === 'builder' ? 190 : 110;
    const fit = Math.min((innerWidth - 32) / canvas.width, (innerHeight - reserved) / H);
    scale = fit >= 1 ? Math.floor(fit * 2) / 2 : fit;
    canvas.style.width = canvas.width * scale + 'px';
    canvas.style.height = H * scale + 'px';
    $('palette').style.maxWidth = Math.max(canvas.width * scale + 8, 500) + 'px'; // never wider than the picture
  }
  addEventListener('resize', () => { if (state) layout(); });

  // One compact square per item: picture, key and cost. The name and
  // description of whichever one is selected go on the line underneath.
  function buildPalette() {
    const el = $('palette');
    el.innerHTML = '';
    for (const item of C.ITEMS) {
      const b = document.createElement('button');
      b.className = 'item';
      b.dataset.id = item.id;
      b.title = `${item.name} - ${ABOUT[item.id]}`;
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      cv.getContext('2d').drawImage(ICONS[item.id], 0, 0);
      b.appendChild(cv);
      b.insertAdjacentHTML('beforeend', `<span class="hotkey">${item.key}</span><span class="cost">${item.cost}</span><i class="cd"></i>`);
      b.onclick = () => { selected = item.id; };
      el.appendChild(b);
    }
  }
  buildPalette();

  for (const a of C.ABILITIES) {
    const chip = document.createElement('div');
    chip.className = 'move locked';
    chip.innerHTML = `<span>[${a.key}] ${a.name}</span><span class="status"></span>`;
    $('moves').appendChild(chip);
  }

  function onState(s) {
    const first = !state;
    state = s;
    if (first) {
      $('lobby').classList.add('hidden');
      $('gameScreen').classList.remove('hidden');
      $('build').classList.toggle('hidden', role !== 'builder');
      $('endBox').classList.add('hidden');
      viewCols = 0;
      layout();
      music(true);
    }
    for (const ev of s.ev) {
      if (ev === 'go') showBanner('GO!', 900, true);
      if (ev === 'life') showBanner('+1 LIFE!', 1500, true);
      if (ev.startsWith('out')) {
        if (s.ps.length > 1 && s.phase !== 'over') showBanner(`RUNNER ${+ev.slice(3) + 1} IS OUT!`, 2200, true);
        continue;
      }
      if (ev === 'tier') showBanner(role === 'builder' ? `INCOME UP! +${s.rate}/SEC` : `BUILDER INCOME UP! +${s.rate}/SEC`, 2200, true);
      if (ev.startsWith('unlock')) {
        const a = C.ABILITIES[+ev.slice(6)];
        showBanner(isRunner ? `NEW MOVE: ${a.name} - PRESS ${a.key}` : `RUNNER UNLOCKED ${a.name}`, 2600, true);
        sfx('unlock');
        continue;
      }
      if (ev === 'win' || ev === 'lose') music(false);
      // "win"/"lose" are from the runner's point of view; flip the jingle for the builder.
      if (role === 'builder' && ev === 'win') sfx('lose');
      else if (role === 'builder' && ev === 'lose') sfx('win');
      else sfx(ev);
    }
    updateHud(s);
  }

  function updateHud(s) {
    // one set of hearts per runner, in that runner's colour
    const lives = s.ps.map((q, i) => `<span style="color:${RUNNER_COLOURS[i]}">${s.ps.length > 1 ? `P${i + 1} ` : ''}`
      + (q.out ? 'OUT' : '♥'.repeat(q.l) + '♡'.repeat(Math.max(0, C.LIVES - q.l))) + '</span>').join(' &nbsp; ');
    if (lives !== lastLives) { lastLives = lives; $('hudLives').innerHTML = lives; }
    const mine = s.ps[isRunner && s.ps[me] ? me : 0]; // whose moves the strip shows
    const t = Math.max(0, s.time);
    $('hudTime').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    $('hudTime').classList.toggle('low', t <= 10);
    $('hudCredits').textContent = `${lobby && lobby.cpu ? `CPU L${lobby.cpuLevel} · ` : ''}CREDITS ${s.credits}/${s.cap} +${s.rate}/S`;

    const el = $('banner');
    const live = s.phase !== 'over' && performance.now() < banner.until;
    if (s.phase === 'countdown') { el.textContent = s.cd; el.classList.remove('hidden', 'small'); }
    else if (live) { el.textContent = banner.text; el.classList.remove('hidden'); el.classList.toggle('small', banner.small); }
    else el.classList.add('hidden');

    // runner's moves: shown to everyone, pressable only by the runner
    const movesEl = $('moves');
    C.ABILITIES.forEach((a, i) => {
      const [st, n] = mine.ab[i];
      const chip = movesEl.children[i];
      chip.className = 'move ' + { L: 'locked', A: 'active', C: 'cooling', R: 'ready' }[st];
      chip.lastChild.textContent = st === 'L' ? `UNLOCKS IN ${n}S` : st === 'A' ? `ACTIVE ${n}S` : st === 'C' ? `RECHARGING ${n}S` : 'READY';
    });
    canvas.classList.toggle('flying', isRunner && !!mine.fly);

    if (s.phase === 'over') {
      const runnerWon = s.winner === 'runner';
      const team = s.ps.length > 1 ? 'RUNNERS' : 'RUNNER';
      $('endTitle').textContent = runnerWon ? `${team} SURVIVED!` : `${team} DESTROYED!`;
      const vsCpu = !!(lobby && lobby.cpu);
      $('endSub').textContent = (!role ? '' : (isRunner === runnerWon ? 'YOU WIN' : 'YOU LOSE'))
        + (vsCpu && runnerWon ? ' - THE CPU COMES BACK TOUGHER' : '');
      $('endButtons').classList.toggle('hidden', !role);
      $('swapBtn').classList.toggle('hidden', vsCpu); // nothing to swap with
      $('endBox').classList.remove('hidden');
    }

    if (role === 'builder') {
      C.ITEMS.forEach((item, i) => {
        const b = $('palette').children[i];
        b.classList.toggle('sel', item.id === selected);
        b.classList.toggle('poor', s.credits < item.cost || s.cds[i] > 0);
        b.lastChild.style.height = s.cds[i] * 100 + '%'; // recharge shade drains away
      });
      const sel = C.ITEMS.find((i) => i.id === selected);
      const info = `<b>${sel.name}</b> &middot; ${sel.cost} credit${sel.cost === 1 ? '' : 's'}${sel.cooldown ? ` &middot; ${sel.cooldown}s recharge` : ''} &middot; ${ABOUT[sel.id]}`;
      if (info !== lastInfo) { lastInfo = info; $('itemInfo').innerHTML = info; }
    }
  }

  let lastInfo = '';
  let lastLives = '';
  let flashTimer = null;
  function flash(text) {
    $('deny').textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { $('deny').textContent = ''; }, 1200);
  }

  // ------------------------------------------------------------------
  // Runner input
  // ------------------------------------------------------------------
  const keys = { l: false, r: false, j: false };
  let padJump = false;
  let sent = '';
  const KEYMAP = {
    ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r',
    Space: 'j', ArrowUp: 'j', KeyW: 'j', KeyZ: 'j', KeyX: 'j',
  };
  function pushInput(pressed) {
    if (!isRunner || !state) return;
    const sig = `${+keys.l}${+keys.r}${+keys.j}`;
    if (sig === sent && !pressed) return;
    sent = sig;
    send({ t: 'in', l: keys.l, r: keys.r, j: keys.j, jp: pressed ? 1 : 0 });
  }
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { muted = !muted; return; }
    if (!state) return;
    const k = KEYMAP[e.code];
    if (k && isRunner) {
      e.preventDefault();
      if (e.repeat) return;
      keys[k] = true;
      pushInput(k === 'j');
      return;
    }
    if (isRunner && !e.repeat) {
      const i = C.ABILITIES.findIndex((a) => a.key === e.key);
      if (i >= 0) { sendAim(); send({ t: 'ab', i }); }
    }
    if (role === 'builder') {
      const item = C.ITEMS.find((i) => i.key === e.key.toLowerCase());
      if (item) selected = item.id;
    }
  });
  addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) { keys[k] = false; pushInput(false); }
  });
  addEventListener('blur', () => { keys.l = keys.r = keys.j = false; pushInput(false); });

  function pollGamepad() {
    if (!isRunner || !navigator.getGamepads) return;
    const pad = [...navigator.getGamepads()].find(Boolean);
    if (!pad) return;
    const ax = pad.axes[0] || 0;
    const b = pad.buttons;
    const l = ax < -0.4 || (b[14] && b[14].pressed);
    const r = ax > 0.4 || (b[15] && b[15].pressed);
    const j = !!(b[0] && b[0].pressed) || !!(b[1] && b[1].pressed);
    if (!l && !r && !j && !padJump && !pad.used) return; // leave the keyboard alone until the pad is touched
    pad.used = true;
    keys.l = !!l; keys.r = !!r; keys.j = j;
    pushInput(j && !padJump);
    padJump = j;
  }

  // ------------------------------------------------------------------
  // Builder input
  // ------------------------------------------------------------------
  const PAINTABLE = { block: 1, crumble: 1, spike: 1, pit: 1, ice: 1, goo: 1 };
  function mousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width * canvas.width, y: (e.clientY - rect.top) / rect.height * canvas.height };
  }
  function cellAt(m) {
    return { c: Math.floor((m.x + Math.floor(state.camX)) / T), r: Math.floor(m.y / T) };
  }
  // The runner's pointer position steers them while flying.
  let aimSent = 0;
  function sendAim() {
    if (!state || !mouse) return;
    const now = performance.now();
    if (now - aimSent < 30) return;
    aimSent = now;
    send({ t: 'aim', x: Math.round(mouse.x), y: Math.round(mouse.y) });
  }

  function tryPlace(dragging) {
    if (role !== 'builder' || !state || !mouse || state.phase === 'over') return;
    if (state.cds[C.ITEMS.findIndex((i) => i.id === selected)] > 0) {
      if (!dragging) { flash('recharging'); sfx('deny'); } // stay quiet while paint-dragging
      return;
    }
    const { c, r } = cellAt(mouse);
    const id = GLOBAL_ITEMS[selected] ? selected : selected === 'pit' || selected === 'boulder' ? selected + c : selected + c + ',' + r;
    if (id === lastCell) return;
    lastCell = id;
    send({ t: 'place', item: selected, c, r });
  }
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    mouse = mousePos(e);
    painting = true;
    lastCell = '';
    tryPlace();
  });
  canvas.addEventListener('mousemove', (e) => {
    if (isRunner) return; // handled by the window listener below
    mouse = mousePos(e);
    if (painting && PAINTABLE[selected]) tryPlace(true);
  });
  addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('mouseleave', () => { if (!isRunner) mouse = null; });
  // The runner mostly plays on the keyboard, so follow their pointer even when it is off the picture.
  addEventListener('mousemove', (e) => {
    if (!isRunner || !state) return;
    const m = mousePos(e);
    mouse = { x: Math.max(0, Math.min(canvas.width, m.x)), y: Math.max(0, Math.min(canvas.height, m.y)) };
    sendAim();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------
  function hash(n) {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  // ---- Backgrounds -------------------------------------------------
  // Five scenes, each a place and a time of day. A round runs through them in
  // a random order (the same for both players), fading from one to the next.
  //   sky    four colour bands, top to bottom
  //   orb    sun or moon: [colour, x, y, radius, crescent?]
  //   far    what stands on the horizon, drawn by FAR[...] below
  //   tint   a wash of light over the whole world: [r, g, b, strength]
  const SCENES = [
    { name: 'meadow at midday', sky: ['#3c8cf0', '#5c94fc', '#7cacfc', '#a4c8fc'], orb: ['#f8e078', 206, 30, 9],
      clouds: '#fcfcfc', far: 'hills', c1: '#00a844', c2: '#58d854', tint: [0, 0, 0, 0] },
    { name: 'desert at sunset', sky: ['#582878', '#c84c5c', '#f08c3c', '#f8c868'], orb: ['#fce0a0', 150, 150, 20],
      clouds: '#f8a878', far: 'mesas', c1: '#a04020', c2: '#d06830', tint: [255, 110, 30, 0.1] },
    { name: 'city at night', sky: ['#080c28', '#0c1438', '#141c50', '#202868'], orb: ['#e8e8d0', 200, 36, 10, true],
      stars: true, far: 'city', c1: '#080818', c2: '#f8d878', tint: [8, 12, 70, 0.26] },
    { name: 'mountains at dawn', sky: ['#6858b8', '#c878b0', '#f8a0a0', '#fcd8b8'], orb: ['#fcf0c0', 60, 170, 14],
      clouds: '#fce0e0', far: 'peaks', c1: '#58608c', c2: '#fcfcfc', tint: [255, 150, 170, 0.07] },
    { name: 'pine forest in the rain', sky: ['#48586c', '#607080', '#788898', '#98a8b0'],
      clouds: '#3c4858', far: 'pines', c1: '#1c3828', c2: '#2c5038', rain: true, tint: [40, 60, 90, 0.14] },
  ];

  const FAR = {
    hills(sc, cam, W, gy) {
      const px = cam * 0.45;
      for (let i = Math.floor(px / 70) - 1; i <= Math.floor((px + W) / 70); i++) {
        const x = Math.floor(i * 70 + hash(i + 50) * 30 - px);
        const h = 24 + Math.floor(hash(i + 7) * 40);
        for (let s = 0; s < h; s += 4) {
          const w = (h - s) * 1.6;
          ctx.fillStyle = s > h - 12 ? sc.c2 : sc.c1;
          ctx.fillRect(Math.floor(x + 40 - w / 2), gy - s - 4, Math.floor(w), 4);
        }
      }
    },
    mesas(sc, cam, W, gy) { // flat-topped rock, in two tiers, with the odd cactus
      const px = cam * 0.4;
      for (let i = Math.floor(px / 110) - 1; i <= Math.floor((px + W) / 110); i++) {
        const x = Math.floor(i * 110 + hash(i + 20) * 40 - px);
        const w = 36 + Math.floor(hash(i + 21) * 44), h = 28 + Math.floor(hash(i + 22) * 46);
        ctx.fillStyle = sc.c1;
        ctx.fillRect(x, gy - h, w, h);
        ctx.fillRect(x + 8, gy - h - 12, w - 20, 12);
        ctx.fillStyle = sc.c2;
        ctx.fillRect(x, gy - h, w, 3);
        ctx.fillRect(x + 8, gy - h - 12, w - 20, 3);
        ctx.fillRect(x + w - 4, gy - h + 3, 4, h - 3);
      }
      const qx = cam * 0.6;
      ctx.fillStyle = '#285828';
      for (let i = Math.floor(qx / 84) - 1; i <= Math.floor((qx + W) / 84); i++) {
        const x = Math.floor(i * 84 + hash(i + 40) * 50 - qx);
        ctx.fillRect(x + 4, gy - 18, 4, 18);
        ctx.fillRect(x, gy - 13, 4, 3); ctx.fillRect(x, gy - 16, 2, 4);
        ctx.fillRect(x + 8, gy - 10, 4, 3); ctx.fillRect(x + 10, gy - 14, 2, 5);
      }
    },
    city(sc, cam, W, gy) { // skyline with lit windows
      const px = cam * 0.4;
      for (let i = Math.floor(px / 30) - 1; i <= Math.floor((px + W) / 30); i++) {
        const x = Math.floor(i * 30 - px);
        const w = 20 + Math.floor(hash(i + 60) * 10), h = 26 + Math.floor(hash(i + 61) * 84);
        ctx.fillStyle = sc.c1;
        ctx.fillRect(x, gy - h, w, h);
        ctx.fillStyle = sc.c2;
        for (let wy = 0; wy < Math.floor((h - 8) / 6); wy++) for (let wx = 0; wx < Math.floor((w - 4) / 5); wx++) {
          if (hash(i * 131 + wy * 17 + wx * 7) > 0.62) ctx.fillRect(x + 3 + wx * 5, gy - h + 4 + wy * 6, 2, 3);
        }
      }
    },
    peaks(sc, cam, W, gy) { // two ranges of snow-capped mountains
      for (const [par, seedOff, scale, shade] of [[0.25, 70, 1.25, 0.55], [0.42, 80, 1, 1]]) {
        const px = cam * par;
        for (let i = Math.floor(px / 90) - 1; i <= Math.floor((px + W) / 90); i++) {
          const cx = Math.floor(i * 90 + hash(i + seedOff) * 40 - px) + 45;
          const h = Math.floor((50 + hash(i + seedOff + 1) * 60) * scale);
          for (let s = 0; s < h; s += 3) {
            ctx.fillStyle = s < h * 0.28 ? sc.c2 : sc.c1;
            ctx.globalAlpha *= shade;
            ctx.fillRect(cx - Math.floor(s * 0.62), gy - h + s, Math.floor(s * 1.24) + 2, 3);
            ctx.globalAlpha /= shade;
          }
        }
      }
    },
    pines(sc, cam, W, gy) { // rows of pointed trees
      for (const [par, gap, col, seedOff, tall] of [[0.35, 22, sc.c2, 90, 0.75], [0.55, 26, sc.c1, 95, 1]]) {
        const px = cam * par;
        ctx.fillStyle = col;
        for (let i = Math.floor(px / gap) - 1; i <= Math.floor((px + W) / gap); i++) {
          const cx = Math.floor(i * gap + hash(i + seedOff) * 10 - px) + 10;
          const h = Math.floor((34 + hash(i + seedOff + 3) * 44) * tall);
          for (let s = 0; s < h - 6; s += 2) {
            const tier = (s % Math.ceil(h / 3)) + s * 0.25; // three overlapping skirts
            ctx.fillRect(cx - Math.floor(tier * 0.5) - 1, gy - h + s, Math.floor(tier) + 2, 2);
          }
          ctx.fillRect(cx - 1, gy - 6, 3, 6);
        }
      }
    },
  };

  function drawScene(sc, cam, W, tick) {
    const gy = C.GROUND_ROW * T;
    const band = Math.ceil(H / sc.sky.length);
    sc.sky.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(0, i * band, W, band); });
    if (sc.stars) {
      ctx.fillStyle = '#fcfcfc';
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(hash(i + 900) * 512);
        if (x < W && ((tick >> 4) + i) % 9 !== 0) ctx.fillRect(x, Math.floor(hash(i + 950) * 150), 1, 1); // the missing ones twinkle
      }
    }
    if (sc.orb) {
      const [col, x, y, r, crescent] = sc.orb;
      const disc = (cx, cy, colour) => {
        ctx.fillStyle = colour;
        for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(cx - w, cy + dy, w * 2, 1); }
      };
      disc(x, y, col);
      if (crescent) disc(x + 5, y - 3, sc.sky[0]);
    }
    if (sc.clouds) {
      ctx.fillStyle = sc.clouds;
      const cx = cam * 0.2;
      for (let i = Math.floor(cx / 90) - 1; i <= Math.floor((cx + W) / 90); i++) {
        const x = Math.floor(i * 90 + hash(i) * 50 - cx);
        const y = 16 + Math.floor(hash(i + 999) * 60);
        ctx.fillRect(x + 4, y, 20, 4);
        ctx.fillRect(x, y + 4, 32, 6);
        ctx.fillRect(x + 6, y + 10, 18, 2);
      }
    }
    FAR[sc.far](sc, cam, W, gy);
  }

  // Which scene is showing now, which is next, and how far the fade has got (0 to 1).
  let sceneSeed = null;
  let sceneOrder = [];
  function sceneNow(s) {
    if (s.seed !== sceneSeed) { // new round: shuffle the order from the round's seed
      sceneSeed = s.seed;
      sceneOrder = SCENES.map((_, i) => i);
      let x = (s.seed || 1) >>> 0;
      for (let i = sceneOrder.length - 1; i > 0; i--) {
        x = (Math.imul(x, 1103515245) + 12345) >>> 0;
        const j = (x >>> 16) % (i + 1);
        [sceneOrder[i], sceneOrder[j]] = [sceneOrder[j], sceneOrder[i]];
      }
    }
    const period = C.SCENE_SECONDS * C.FPS, fade = 180;
    const n = Math.floor(s.tick / period), into = s.tick % period;
    return {
      a: SCENES[sceneOrder[n % SCENES.length]],
      b: SCENES[sceneOrder[(n + 1) % SCENES.length]],
      blend: into > period - fade ? Math.round(((into - (period - fade)) / fade) * 10) / 10 : 0,
    };
  }

  function drawBackdrop(scene, cam, W, tick) {
    drawScene(scene.a, cam, W, tick);
    if (scene.blend > 0) {
      ctx.globalAlpha = scene.blend;
      drawScene(scene.b, cam, W, tick);
      ctx.globalAlpha = 1;
    }
  }

  // The time of day washes over everything in the world, and some scenes have weather.
  // (`x0` is the left edge of the screen in world pixels: this is drawn inside the scrolled world.)
  function drawLight(scene, x0, W, tick) {
    const { a, b, blend } = scene;
    const t = a.tint.map((v, i) => v + (b.tint[i] - v) * blend);
    if (t[3] > 0.005) {
      ctx.fillStyle = `rgba(${Math.round(t[0])}, ${Math.round(t[1])}, ${Math.round(t[2])}, ${t[3].toFixed(3)})`;
      ctx.fillRect(x0, 0, W, H);
    }
    const rain = (a.rain ? 1 - blend : 0) + (b.rain ? blend : 0);
    if (rain > 0) {
      ctx.fillStyle = '#c8d8e8';
      ctx.globalAlpha = 0.55 * rain;
      for (let i = 0; i < W / 5; i++) {
        const x = (hash(i + 700) * (W + 60) + tick * 1.5) % (W + 60) - 30;
        const y = (hash(i + 750) * H + tick * (5 + (i % 3))) % H;
        ctx.fillRect(x0 + Math.floor(x), Math.floor(y), 1, 4);
        ctx.fillRect(x0 + Math.floor(x) + 1, Math.floor(y) + 4, 1, 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    requestAnimationFrame(render);
    if (!state) return;
    pollGamepad();
    const s = state;
    const W = canvas.width;
    const cam = Math.floor(s.camX);
    const blink = (s.tick >> 2) & 1;
    const scene = sceneNow(s);
    drawBackdrop(scene, cam, W, s.tick);

    ctx.save();
    ctx.translate(-cam, 0);

    const pits = new Set(s.pits);
    const c0 = Math.floor(cam / T);
    for (let c = c0; c <= c0 + viewCols; c++) {
      if (pits.has(c)) continue;
      ctx.drawImage(tiles.grass, c * T, C.GROUND_ROW * T);
      ctx.drawImage(tiles.dirt, c * T, (C.GROUND_ROW + 1) * T);
    }

    ctx.imageSmoothingEnabled = false; // keeps the enlarged enemies crisp
    for (const [c, r, type, spawning, flag] of s.tiles) {
      const x = c * T, y = r * T;
      if (type === 'mine' && flag === 1) {
        if (isRunner) continue; // hidden from the runner; the builder sees a faint one
        ctx.globalAlpha = 0.4;
      }
      if (spawning) ctx.globalAlpha = blink ? 0.75 : 0.3;
      if (type === 'crumble') ctx.drawImage(tiles.crumble, x + (flag ? (blink ? 1 : -1) : 0), y);
      else if (type === 'spring') ctx.drawImage(tiles.spring, x, y - (flag ? 5 : 0));
      else ctx.drawImage(tiles[type], x, y);
      ctx.globalAlpha = 1;
      if (type === 'mine' && flag === 2) {
        ctx.fillStyle = blink ? '#fcfcfc' : '#d82800';
        ctx.fillRect(x + 5, y + 5, 6, 4);
      } else if (type === 'flame' && flag < 0) {
        ctx.fillStyle = blink ? '#f8b800' : '#d82800';
        ctx.fillRect(x + 6, y - 3, 4, 3);
      } else if (type === 'flame' && flag > 0) {
        const h = flag * T, top = y - h, f = blink ? 0 : 1;
        ctx.fillStyle = '#d82800';
        ctx.fillRect(x + 3 + f, top + f * 3, 10 - f * 2, h - f * 3);
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(x + 5, top + 5 - f * 2, 6, h - 5 + f * 2);
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(x + 7, top + 11 + f * 2, 2, h - 11 - f * 2);
      }
    }

    for (const [id, type, x, y, spawning, warning, extra] of s.ents) {
      const ex = Math.round(x), ey = Math.round(y);
      if (spawning) ctx.globalAlpha = blink ? 0.75 : 0.3;
      // slimes and bats are the 16px drawings shown at one and a half times size
      if (type === 'slime') ctx.drawImage(((s.tick + id * 7) >> 4) & 1 ? slimeA : slimeB, ex - 2, ey - 6, 24, 24);
      else if (type === 'thorn') ctx.drawImage(thorn, ex - 2, ey - 6 + (((s.tick + id * 7) >> 4) & 1), 24, 24);
      else if (type === 'hopper') ctx.drawImage(hopper, ex - 1, ey - 4 - (extra ? 2 : 0));
      else if (type === 'bat') ctx.drawImage(((s.tick + id * 5) >> 3) & 1 ? batA : batB, ex - 2, ey - 5, 24, 24);
      else if (type === 'bullet') {
        ctx.fillStyle = '#000';
        ctx.fillRect(ex + 3, ey, 6, 12); ctx.fillRect(ex, ey + 3, 12, 6); ctx.fillRect(ex + 1, ey + 1, 10, 10);
        ctx.fillStyle = '#7c7c7c'; ctx.fillRect(ex + 3, ey + 2, 4, 3);
        ctx.fillStyle = '#fcfcfc'; ctx.fillRect(ex + 3, ey + 2, 2, 2);
      } else if (type === 'life') {
        const bob = Math.round(Math.sin((s.tick + id) * 0.1) * 2);
        ctx.drawImage(heart, ex - 1, ey - 2 + bob);
        // "+1" floating above it
        ctx.fillStyle = blink ? '#fcfcfc' : '#f8b800';
        const tx = ex + 2, ty = ey - 9 + bob;
        ctx.fillRect(tx, ty + 2, 5, 1); ctx.fillRect(tx + 2, ty, 1, 5);
        ctx.fillRect(tx + 8, ty, 1, 5); ctx.fillRect(tx + 7, ty + 1, 1, 1); ctx.fillRect(tx + 7, ty + 4, 3, 1);
      } else if (type === 'saw') {
        ctx.fillStyle = '#3c3c3c';
        ctx.fillRect(extra - 32 + 7, ey + 6, 64, 2); // its track
        ctx.drawImage(saws[(s.tick >> 2) & 1], ex - 1, ey - 1);
      } else if (type === 'crusher') {
        ctx.drawImage(crusher, ex - 1 + (extra ? (blink ? 1 : -1) : 0), ey);
      } else if (type === 'ghost') {
        if (!spawning) ctx.globalAlpha = extra ? (blink ? 0.6 : 0.15) : 0.75;
        ctx.drawImage(ghost, ex - 2, ey - 2 + (((s.tick + id * 9) >> 4) & 1));
      } else if (type === 'debris') ctx.drawImage(tiles.crumble, ex, ey);
      else if (type === 'boulder') {
        if (warning) {
          // warning marker and a drop line showing where it will fall
          ctx.fillStyle = blink ? '#d82800' : '#f8b800';
          ctx.fillRect(ex + 5, 2, 4, 8);
          ctx.fillRect(ex + 5, 12, 4, 3);
          ctx.globalAlpha = 0.35;
          for (let yy = 18; yy < C.GROUND_ROW * T; yy += 8) ctx.fillRect(ex + 6, yy, 2, 4);
        } else ctx.drawImage(boulder, ex - 1, ey - 2);
      }
      ctx.globalAlpha = 1;
      // On the runner's screen, a little bobbing arrow sits over anything that can be stomped.
      if (isRunner && !spawning && C.STOMPABLE.includes(type)) {
        const ax = ex + (STOMP_WIDTH[type] >> 1);
        const ay = ey - 9 + Math.round(Math.sin((s.tick + id * 5) * 0.2) * 1.5);
        ctx.fillStyle = '#000';
        ctx.fillRect(ax - 3, ay - 1, 7, 3); ctx.fillRect(ax - 2, ay + 2, 5, 1); ctx.fillRect(ax - 1, ay + 3, 3, 1);
        ctx.fillStyle = '#f8b800';
        ctx.fillRect(ax - 2, ay, 5, 1); ctx.fillRect(ax - 1, ay + 1, 3, 1); ctx.fillRect(ax, ay + 2, 1, 1);
      }
    }

    // The time-of-day wash goes over the world but under the runners, so they stay easy to see at night.
    drawLight(scene, cam, W, s.tick);

    // runners
    s.ps.forEach((p, i) => {
      if (p.out || (p.iv > 0 && blink)) return;
      const pose = !p.g ? 'jump' : Math.abs(p.vx) > 0.3 && ((s.tick >> 3) & 1) ? 'run' : 'stand';
      const px = Math.round(p.x) - 3, py = Math.round(p.y) - 2;
      const img = heroes[i][p.fly ? 'jump' : pose][p.f];
      if (p.rot) { // mid-somersault: turned in quarter steps so the pixels stay square
        ctx.save();
        ctx.translate(px + 8, py + 8);
        ctx.rotate(p.rot * Math.PI / 2);
        ctx.drawImage(img, -8, -8);
        ctx.restore();
      } else ctx.drawImage(img, px, py);
      if (p.ws) { // sliding down a wall: scuff marks trailing above the hands
        ctx.fillStyle = '#fcfcfc';
        const wx = p.ws > 0 ? px + 13 : px + 1;
        ctx.fillRect(wx, py - 2 - (s.tick >> 1) % 4, 2, 2);
        ctx.fillRect(wx, py - 7 - (s.tick >> 1) % 4, 1, 2);
      }
      if (p.fly) { // jet flame
        ctx.fillStyle = blink ? '#f8b800' : '#d82800';
        ctx.fillRect(px + 5, py + 15, 6, blink ? 5 : 3);
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(px + 7, py + 15, 2, 2);
      }
      if (p.ab[0][0] === 'A') { // triple jump sparkle
        ctx.fillStyle = '#3cbcfc';
        const o = (s.tick >> 2) % 4;
        ctx.fillRect(px + 1 + o * 4, py + 16, 2, 2);
        ctx.fillRect(px + 13 - o * 4, py + 18, 2, 2);
      }
      if (isRunner && i === me && s.ps.length > 1 && s.phase === 'countdown') { // "this one is you", until the round starts
        ctx.fillStyle = blink ? '#fcfcfc' : RUNNER_COLOURS[i];
        ctx.fillRect(px + 4, py - 9, 8, 2); ctx.fillRect(px + 5, py - 7, 6, 2); ctx.fillRect(px + 7, py - 5, 2, 2);
      }
    });
    const own = isRunner ? s.ps[me] : null;

    for (const [k, a, b, c, ttl] of s.fx) {
      if (k === 'laser') {
        const h = ttl > 6 ? 6 : ttl;
        ctx.fillStyle = '#d82800';
        ctx.fillRect(a, b + 3 - h / 2, c - a, h);
        ctx.fillStyle = blink ? '#fcfcfc' : '#f8b800';
        ctx.fillRect(a, b + 2, c - a, 2);
      } else if (k === 'puff') {
        // dust kicked off the wall: spreads up and down the wall face and fades
        const age = 12 - ttl;
        ctx.fillStyle = ttl > 6 ? '#fcfcfc' : '#bcbcbc';
        const sz = ttl > 4 ? 3 : 2;
        for (const dy of [-1, 0, 1]) ctx.fillRect(Math.round(a - c * age * 0.4) - 1, Math.round(b + dy * (3 + age * 0.9)) - 1, sz, sz);
      } else if (k === 'boom') {
        // chunky expanding ring
        const rad = c * (1 - ttl / 24);
        ctx.fillStyle = ttl > 16 ? '#fcfcfc' : ttl > 8 ? '#f8b800' : '#d82800';
        for (let i = 0; i < 20; i++) {
          const ang = (i / 20) * Math.PI * 2;
          const sz = ttl > 12 ? 8 : 4;
          ctx.fillRect(Math.round((a + Math.cos(ang) * rad) / 4) * 4 - sz / 2, Math.round((b + Math.sin(ang) * rad) / 4) * 4 - sz / 2, sz, sz);
          if (ttl > 12) ctx.fillRect(Math.round((a + Math.cos(ang) * rad * 0.5) / 4) * 4 - 2, Math.round((b + Math.sin(ang) * rad * 0.5) / 4) * 4 - 2, 4, 4);
        }
      }
    }
    ctx.restore();

    if (s.wind > 0) { // streaks blowing back across the runner's screen
      ctx.fillStyle = '#fcfcfc';
      const span = C.VIEW_COLS * T + 40;
      for (let i = 0; i < 14; i++) {
        const wx = span - ((s.tick * (5 + (i % 3)) + i * 61) % span) - 20;
        ctx.globalAlpha = 0.35 + (i % 3) * 0.2;
        ctx.fillRect(wx, 10 + Math.floor(hash(i + 300) * (C.GROUND_ROW * T - 20)), 10 + (i % 4) * 4, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (s.fog > 0) {
      const x0 = C.FOG_START_X, x1 = C.VIEW_COLS * T;
      const fade = Math.min(1, s.fog / 30);
      // solid for the runner; the others just get a haze so they can see what is in it
      ctx.globalAlpha = isRunner ? fade : 0.3 * fade;
      ctx.fillStyle = '#bcbcbc';
      ctx.fillRect(x0 + 8, 0, x1 - x0 - 8, H);
      for (let y = 0; y < H; y += 16) {
        const bump = Math.floor(hash((y >> 4) + (s.tick >> 5)) * 3) * 4;
        ctx.fillRect(x0 + bump - 4, y, 12 - bump, 16);
      }
      ctx.fillStyle = '#fcfcfc';
      for (let i = 0; i < 9; i++) {
        const fx = x0 + 12 + ((i * 37 + (s.tick >> 3)) % (x1 - x0 - 30));
        ctx.fillRect(fx, 8 + ((i * 53) % (H - 30)), 18, 6);
      }
      ctx.globalAlpha = 1;
    }

    if (!isRunner) drawBuilderOverlay(s, cam, W);
    else if (own && own.fly && mouse) {
      sendAim(); // keep steering even if the last pointer update was skipped
      const mx = Math.round(mouse.x), my = Math.round(mouse.y);
      ctx.fillStyle = blink ? '#fcfcfc' : '#f8b800';
      ctx.fillRect(mx - 4, my, 3, 1); ctx.fillRect(mx + 2, my, 3, 1);
      ctx.fillRect(mx, my - 4, 1, 3); ctx.fillRect(mx, my + 2, 1, 3);
    }
  }

  function drawBuilderOverlay(s, cam, W) {
    const runnerW = C.VIEW_COLS * T;
    // everything right of the runner's screen is hidden from them
    ctx.fillStyle = 'rgba(0, 0, 40, 0.28)';
    ctx.fillRect(runnerW, 0, W - runnerW, H);
    ctx.fillStyle = '#fcfcfc';
    for (let y = 0; y < H; y += 8) ctx.fillRect(runnerW, y, 1, 4);

    // Red marks where the item in hand can't go, which depends on the item:
    //   most things   not within a few tiles in front of the runner
    //   boulder       only on the runner's screen, so not to the right of it
    //   wind / fog    no position at all, so nothing is off limits
    // measured from whichever runner is furthest ahead
    const limitCol = Math.max(0, ...s.ps.filter((q) => !q.out).map((q) => Math.floor((q.x + 5) / T))) + C.MIN_BUILD_DIST_COLS;
    const boulderMaxCol = Math.floor(cam / T) + C.VIEW_COLS;
    const holding = role === 'builder' ? selected : 'block';
    const noBuild = (x0, x1, lineX) => {
      ctx.fillStyle = 'rgba(216, 40, 0, 0.16)';
      ctx.fillRect(x0, 0, Math.max(0, x1 - x0), H);
      ctx.fillStyle = '#d82800';
      for (let y = 4; y < H; y += 8) ctx.fillRect(lineX, y, 1, 4);
    };
    if (holding === 'boulder') { const x = (boulderMaxCol + 1) * T - cam; noBuild(x, W, x); }
    else if (!GLOBAL_ITEMS[holding]) { const x = limitCol * T - cam; noBuild(0, x, x); }

    if (role !== 'builder' || !mouse || s.phase === 'over') return;
    const { c, r } = cellAt(mouse);
    const item = C.ITEMS.find((i) => i.id === selected);
    const x = c * T - cam;
    let ok = s.credits >= item.cost && !(s.cds[C.ITEMS.indexOf(item)] > 0);
    if (GLOBAL_ITEMS[selected]) {
      ok = ok && s.phase === 'play' && !(s[selected] > 0);
      ctx.fillStyle = ok ? 'rgba(184, 248, 24, 0.18)' : 'rgba(216, 40, 0, 0.18)';
      ctx.fillRect(selected === 'fog' ? C.FOG_START_X : 0, 0, selected === 'fog' ? runnerW - C.FOG_START_X : runnerW, H);
      ctx.drawImage(ICONS[selected], Math.round(mouse.x) - 8, Math.round(mouse.y) - 8);
    } else if (selected === 'boulder') {
      ok = ok && c <= boulderMaxCol;
      ctx.fillStyle = ok ? 'rgba(184, 248, 24, 0.3)' : 'rgba(216, 40, 0, 0.3)';
      ctx.fillRect(x, 0, T, C.GROUND_ROW * T);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(boulder, x, 0);
    } else if (selected === 'pit') {
      ok = ok && c >= limitCol;
      ctx.fillStyle = ok ? 'rgba(184, 248, 24, 0.3)' : 'rgba(216, 40, 0, 0.3)';
      ctx.fillRect(x, 0, 2 * T, H);
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, C.GROUND_ROW * T, 2 * T, 2 * T);
    } else {
      ok = ok && c >= limitCol && r < C.GROUND_ROW;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(ICONS[selected], x, r * T);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#b8f818' : '#d82800';
      ctx.strokeRect(x + 0.5, r * T + 0.5, T - 1, T - 1);
    }
    ctx.globalAlpha = 1;
  }

  connect();
  requestAnimationFrame(render);
})();
