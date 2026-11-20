# RUN / RUIN

Two-player LAN platformer. The **runner** has to survive 2 minutes; the **builder**
spends credits to drop blocks, traps and enemies in their path in real time.

## Play

    npm run docker:start     # build + start (http://localhost:8080)
    npm run docker:logs
    npm run docker:stop

The lobby shows the address your friend should open (this computer's LAN IP,
detected by `lan-ip.js` at start). Both players pick a side and press READY.

- Runner: arrows / A D to move, Space / W / Up to jump, press again mid-air to double jump. Wall jump: in the air beside a wall, push away from it and jump for a free extra jump (not twice running off the same wall; touch the ground or another wall first). Pushing into a wall while falling slides down it slowly. Stomp slimes, bats, hoppers, crushers and cannonballs by landing on top of them. On the runner's screen a small bobbing arrow marks everything stompable; no arrow means it can't be stomped. 3 lives.
- A +1 heart appears at random times ahead of the runner; grabbing it adds a life (up to 5). The builder can't cover it, but can guard it.
- Runner moves unlock the longer you survive, each on a number key with a recharge:
  1 triple jump (0:20), 2 laser vision (0:45), 3 explode (1:10), 4 fly toward the mouse pointer (1:35).
- Builder: click an item (or press the key shown on it) to pick it, click the map to place it (drag to paint). Nothing can be placed within 5 tiles in front of the runner, except boulders, which show a warning first.
- Builder items: block, crumble, spikes, slime, pit (2 tiles per click), bat, boulder, cannon, saw, flame jet, crusher, ghost, mine (hidden from the runner), spring, ice, goo, wind and fog (both hit the whole runner screen for a few seconds), hopper, thorn slime.
- Most items need a moment to recharge after each use (shown as a shade draining off the button); spikes, pit and ice have no wait. Block and crumble share a counter instead: after every 5 bricks (any mix) both lock for 2 seconds, shown as pips on their buttons.
- The builder starts with 25 credits. Income grows: 1.5 credits/sec, then 2.25 from 0:40, then 3 from 1:20, and the bank cap rises with it (45, 60, 75).
- The server refuses any block, cannon or pit that would leave the runner no way through ("would block the path").
- M toggles sound. Extra browsers that join just watch.

The runner is a ninja. The background cycles through five scenes with different times of day (meadow at midday, desert at sunset, city at night, mountains at dawn, pine forest in the rain) in a random order each round, changing every 25 seconds.

## Tuning

Round length, lives, credit income, item costs and the runner's moves are in `public/shared.js`.
Movement and enemy speeds are at the top of `game.js`. `npm test` checks the rules.
