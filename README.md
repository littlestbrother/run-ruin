# RUN / RUIN

LAN platformer for one or two **runners** against a **builder**. The runners have to survive
2 minutes; the builder spends credits to drop blocks, traps and enemies in their path in real
time. The builder can be a person or the CPU.

## Play

    npm run docker:start     # build + start (http://localhost:8080)
    npm run docker:logs
    npm run docker:stop

The lobby shows the address your friend should open (this computer's LAN IP,
detected by `lan-ip.js` at start). Everyone picks a seat (Runner 1, Runner 2 or Builder) and presses READY.
The round starts once everyone seated is ready, with at least one runner and a builder.

- **Two runners** are a team sharing one pool of lives (5 to start, up to 7; a lone runner has 3, up to 5). A hit on either costs the team a life, and the builder wins when the pool is empty. They share one screen position, which only jumps ahead as far as the runner at the back allows. They bounce off each other, and landing on a team-mate's head springs you up.
- **Bonus lives:** every 10 enemies the runners destroy (slimes, bats, hoppers, thorn slimes, ghosts, crushers, saws — by stomp, laser or explosion) earns the team a life. Cannonballs and boulders don't count.
- **CPU builder**: switch it on in the lobby when nobody takes the Builder seat. It uses the same credits, recharges and path rule as a person. It plays harder as the round goes on, and comes back a level tougher each time the runners beat it (the level resets when the game is restarted). Its trap recipes are in `bot.js`.

- Runner: arrows / A D to move, Space / W / Up to jump, press again mid-air to double jump. Wall jump: in the air beside a wall, push away from it and jump for a free extra jump (not twice running off the same wall; touch the ground or another wall first). Pushing into a wall while falling slides down it slowly. Stomp slimes, bats, hoppers, crushers and cannonballs by landing on top of them. On the runner's screen a small bobbing arrow marks everything stompable; no arrow means it can't be stomped. 3 lives.
- A +1 heart appears at random times ahead of the runner; grabbing it adds a life. The builder can't cover it, but can guard it.
- Runner moves unlock the longer you survive, each on a number key with a recharge:
  1 triple jump (0:20), 2 laser vision (0:45), 3 explode (1:10), 4 fly toward the mouse pointer (1:35).
- Builder: click an item (or press the key shown on it) to pick it, click the map to place it (drag to paint). Nothing can be placed within 5 tiles in front of the runner, except boulders, which show a warning first.
- Builder items: block, crumble, spikes, slime, pit (2 tiles per click), bat, boulder, cannon, saw, flame jet, crusher, ghost, mine (hidden from the runner), spring, ice, goo, wind and fog (both hit the whole runner screen for a few seconds), hopper, thorn slime.
- Most items need a moment to recharge after each use (shown as a shade draining off the button); block, crumble, spikes, pit and ice have no wait.
- The builder starts with 25 credits. Income grows: 1.5 credits/sec, then 2.25 from 0:40, then 3 from 1:20, and the bank cap rises with it (45, 60, 75).
- The server refuses any block, cannon, flame jet, spike or pit that would leave the runner no way through ("would block the path"). A way through has to work with just running and the double jump, avoid spikes and flame jets, and be quick enough to stay ahead of the scrolling screen.
- M toggles sound. Extra browsers that join just watch.

The runner is a ninja. The background cycles through five scenes with different times of day (meadow at midday, desert at sunset, city at night, mountains at dawn, pine forest in the rain) in a random order each round, changing every 25 seconds.

## Tuning

Round length, lives, credit income, item costs and the runner's moves are in `public/shared.js`.
Movement and enemy speeds are at the top of `game.js`. `npm test` checks the rules.
