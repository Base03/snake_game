# Serpens Infernalis — Implementation Plan

## Constraints

- **Build**: Concatenation into single `<script>` block. No modules. All global scope.
- **Load order**: New core files must come before files that use them.
- **Invariant**: Game must be fully playable after every task. No broken intermediate states.
- **Testing**: Manual — build, open, verify test scenarios. No test framework.

## Verification Checklist (run after every task)

```
[ ] Game starts on "Ignite" click
[ ] Snake moves in 4 directions (keyboard)
[ ] Snake eats candles, grows, score increases
[ ] Candles spawn on timer, expire with smoke
[ ] Hellfire spawns after 6 candles eaten, cracks appear
[ ] Pews burn when candle/hellfire adjacent
[ ] Corruption increases — windows redden, vignette appears
[ ] Phase 2 snake (burning, eyes flicker) at 6+ candles
[ ] Phase 3 snake (demon, horns, glowing eyes) at 13+ candles
[ ] Pentagram appears at corruption > 0.5
[ ] Statues cry blood at corruption > 0.6
[ ] Lightning flashes periodically
[ ] Tail burns on timer, blood spawns
[ ] Death on wall/pew/self collision, game-over overlay
[ ] Audio: organ hymn plays, crossfades pure→dark
[ ] Audio: SFX (eat, burn, candle-out, death, lightning, pew-burn)
[ ] Wallpaper mode (AI autopilot) works
[ ] Touch input works (if testable)
```

---

## PHASE 1: Core Infrastructure + Quick Perf Wins

Goal: Create the core classes (EventBus, ParticlePool) and integrate them into the existing game for immediate performance improvements. No architectural change yet — just drop-in replacements.

### Task 1.1 — EventBus + ParticlePool classes

**Create**: `src/core.js` containing `EventBus` and `ParticlePool` classes.

**EventBus**: Map-based pub/sub with `on()`, `off()`, `emit()`, `defer()`, `flush()`.

**ParticlePool**: Pre-allocated fixed array (500 slots). `emit()`, `update(dt)`, `draw(ctx)`. Uses `fillRect` not `arc`. No `shadowBlur`.

**Build change**: Add `core.js` as first file in concatenation (before audio.js).

**Integration**: None yet — classes exist but aren't wired in.

**Test**: Game loads without errors. Classes accessible from console (`new EventBus()`, `new ParticlePool()`).

### Task 1.2 — Replace particle system

**Change**: In `game.js`:
- Replace `let particles = []` with `const particles = new ParticlePool(500)`
- Replace all `particles.push({...})` calls with `particles.emit(x, y, vx, vy, life, size, hue, smoke)`
- Replace `updateParticles(dt)` with `particles.update(dt)`
- Replace `drawParticles()` with `particles.draw(ctx)`
- Remove `emitFlame()`, `emitDeath()`, `emitCandleOut()` — rewrite as helpers that call `particles.emit()`

**Test**: Run verification checklist. Particles should look slightly different (square not round, no glow) but functionally identical. Reduced stutter during heavy particle scenes (death, pew burning).

### Task 1.3 — Wire EventBus for audio + corruption

**Create**: Global `const bus = new EventBus()` in core.js.

**Change**: Dual-emit pattern — existing direct calls remain, but also emit events:

In `game.js` `moveSnake()`:
- After `AudioEngine.playEat()`: add `bus.emit('collectible:eaten', {type, x, y})`
- After `Church.setCorruption()`: add `bus.emit('corruption:changed', {value})`

In `game.js` `die()`:
- After `AudioEngine.playDeath()`: add `bus.emit('snake:died', {x, y})`

In `game.js` `burnTail()`:
- After `AudioEngine.playBurn()`: add `bus.emit('snake:tailBurned', {x, y})`

In `church.js` `tryBurnPewsNear()`:
- After `AudioEngine.playPewBurn()`: add `bus.emit('pew:ignited', {x, y})`

In `church.js` `update()` lightning section:
- After `AudioEngine.playLightning()`: add `bus.emit('lightning:flash', {})`

**No subscriber changes yet** — events fire into the void. This validates the bus works without breaking anything.

**Test**: Verification checklist passes. Open console, run `bus.on('collectible:eaten', e => console.log('EAT', e))` — eat a candle — see log.

---

### ✅ CHECKPOINT 1

**State**: Game plays identically. ParticlePool replaces array (perf win). EventBus exists and emits events alongside direct calls. No architectural change yet.

**Deliver build, report back for review.**

---

## PHASE 2: Render Pipeline

Goal: Offscreen canvas layers. Static layers only redraw when dirty. Biggest performance win.

### Task 2.1 — RenderPipeline class + tile layer

**Create**: `RenderPipeline` class in `core.js`. Manages array of `{name, canvas, ctx, renderFn, dirty, alwaysDirty}`.

**Change**: In `game.js` `gameLoop()`:
- Create pipeline on init with 4 layers: `tiles` (static), `environment` (static), `entities` (always), `overlay` (always)
- `tiles` layer: move `Church.drawTiles()` call there, dirty-flag on corruption crossing 0.05 increments
- Other layers: just proxy to existing draw calls for now (always dirty)
- Main loop calls `pipeline.render(ctx)` instead of individual draw calls

**Test**: Verification checklist. Tile rendering visually identical. Use `performance.now()` to time 100 frames before/after — tiles layer should show fewer redraws.

### Task 2.2 — Environment layer (pews, altar, statues, blood, cracks)

**Change**: Move to environment layer:
- `Church.drawBlood()`
- `Church.drawCracks()`
- `Church.drawAltar()`
- `Church.drawPews()`
- `Church.drawStatues()`

**Dirty triggers**:
- `bus.on('pew:ignited', ...)` → dirty
- `bus.on('corruption:changed', ...)` → dirty if crossed 0.1 threshold
- `bus.on('lightning:flash', ...)` → dirty (statues visible during flash)
- New events: `bus.emit('blood:spawned', ...)` and `bus.emit('crack:spawned', ...)` from Church → dirty

Note: Burning pews animate, so environment layer will be dirty during any active burn. That's fine — it still skips redraws when nothing is burning.

**Test**: Verification checklist. Pew burning still animates. Blood/cracks still appear. Altar cross still inverts.

### Task 2.3 — Light beam layer + entity/overlay split

**Change**:
- Stained glass beams (`Church.drawStainedGlass()`) get own layer, dirty on corruption threshold + lightning
- Entity layer: candles, hellfire, snake drawing — always dirty
- Overlay layer: `Church.drawGlyph()`, `Church.drawLightning()`, `Church.drawVignette()`, `particles.draw()` — always dirty when active

**Final layer order** (back to front):
0. `tiles` — static
1. `blood_cracks` — event-driven (split from environment for finer dirty control)
2. `environment` — pews, altar, statues — event-driven
3. `lightbeams` — stained glass — corruption threshold + lightning
4. `entities` — snake, candles, hellfire — every frame
5. `overlay` — glyph, particles, lightning flash, vignette — every frame

**Test**: Verification checklist. Light beams look correct. Pentagram floats above entities. Lightning flash illuminates windows.

---

### ✅ CHECKPOINT 2

**State**: 6-layer render pipeline. Static layers skip redraw when clean. Particle pool + no shadowBlur. Game should feel noticeably smoother.

**Deliver build, report back. Compare frame timing before/after if possible.**

---

## PHASE 3: ECS Core + State Migration

Goal: Create the World, move all game objects into entities with components. Church.js shrinks to just draw functions. game.js shrinks to just the loop shell.

### Task 3.1 — World class + corruption singleton

**Create**: `World` class in `core.js`:
- `stores: Map<componentName, Map<entityId, data>>`
- `tags: Map<tag, Set<entityId>>`
- `spawn(...componentPairs)`, `destroy(id)`, `add()`, `get()`, `has()`, `remove()`
- `tag()`, `untag()`, `hasTag()`
- `query(...components)`, `queryTagged(tag, ...components)`
- `addSystem()`, `runPhase()`
- Owns `bus`, `time`, and `grid` references

**Create**: `SpatialGrid` class in `core.js`:
- `cells: Array<Array<entityId>>`, `blocked: Uint8Array`
- `add()`, `remove()`, `move()`, `at()`, `isBlocked()`, `queryArea()`, `toPathGrid()`

**Integration**: Create global `const world = new World()`. Create corruption singleton:
```
world.spawn('corruption', {value: 0, target: 0})
```
Wire: `Church.setCorruption()` now also updates corruption entity. `Church.getCorruption()` reads from entity. Dual-path — old corruption variable AND entity both exist during transition.

**Test**: Verification checklist. `world.query('corruption')` returns one entity from console. Corruption value matches Church.corruption at all times.

### Task 3.2 — Pews as entities

**Change**: In `Church.generate()`:
- For each pew tile, call `world.spawn(...)` with `position`, `collider`, `flammable`, `drawable` components
- Tag each with `'pew'`
- Register in `SpatialGrid`
- Keep `pewGrid` Uint8Array in sync (read from grid.blocked + collider queries)

**Change**: `Church.tryBurnPewsNear()` → query `world.grid.queryArea(x, y, 1, world, 'flammable')` instead of scanning pew array.

**Change**: `Church.update()` pew burning → iterate `world.queryTagged('pew', 'flammable')` instead of pew array.

**Keep**: `Church.drawPews()` still reads from pew entities to render. Pew array can be derived from world query.

**Test**: Verification checklist. Pews appear, block movement, burn, and disappear. Hellfire ignites adjacent pews. `world.queryTagged('pew').length` matches visible pew count.

### Task 3.3 — Candles/hellfire as entities

**Change**: `spawnCandle()` and `spawnInitialCandles()`:
- Call `world.spawn(...)` with `position`, `drawable`, `collectible`, `lifetime`, `lightSource` (+ `flammable` for hellfire)
- Register in grid
- Remove from `candles[]` array — entity IS the candle now

**Change**: `moveSnake()` eat check:
- Instead of `candles.some()`, check `world.grid.at(nx, ny)` for entities with `collectible` component

**Change**: `updateCandles()` → `lifetimeSystem()`:
- Query `world.query('lifetime')`, check expiry, destroy expired entities

**Change**: candle rendering in game loop:
- Query `world.query('position', 'drawable')` where `drawable.type === 'candle'` or `'hellfire'`
- Call existing `drawCandle()`/`drawHellfire()` with entity data

**Remove**: `candles[]` array entirely.

**Test**: Verification checklist. Candles spawn, display, expire. Eating works, score increases. Hellfire spawns after 6 eaten with cracks. `world.query('collectible').length` matches HUD candle count.

### Task 3.4 — Remaining environment entities

**Convert to entities** (each a small sub-task, done in sequence):

1. **Stained glass windows**: `position`, `drawable`, `lightSource`, `lightningReactive`
2. **Statues**: `position`, `drawable`, `collider`, `animated`
3. **Blood pools**: `position`, `drawable`, `animated`
4. **Cracks**: `position`, `drawable`, `lightSource`
5. **Pentagram**: `position`, `drawable`, `animated`, `lightSource` (singleton)
6. **Lightning**: singleton entity with `lightning` component
7. **Altar**: `position`, `drawable`, `collider` (singleton)
8. **GameState**: singleton entity

Church.js draw functions stay but read from entity queries instead of closure variables. Church.generate() becomes entity spawning.

**Test**: Verification checklist. All visual elements present and behaving correctly. `world.stores` should show all component types populated. Church.js closure variables (`pews`, `stainedGlass`, `statues`, `bloodPools`, `cracks`) are gone — data lives in world.

---

### ✅ CHECKPOINT 3

**State**: All game objects are entities in the World. Church.js is reduced to draw functions + generate function. SpatialGrid handles collision. EventBus carries game events. The `candles[]` and `pews[]` arrays are gone.

**Deliver build, report back. This is the riskiest phase — verify everything works.**

---

## PHASE 4: Snake as Chain Entities + Systems

Goal: Snake becomes chain entities. Game logic moves from inline code to systems. game.js becomes a thin loop.

### Task 4.1 — Snake as chain entities

**Change**: `init()` snake creation → `spawnSnake(world, x, y, length)`:
- Head: `position`, `collider`, `velocity`, `playerControlled`, `chainLink`, `drawable`, `animated`
- Segments: `position`, `collider`, `chainLink`, `drawable`, `flammable`
- Tags: `'snake'`, `'snakeHead'` / `'snakeSegment'`
- All registered in grid

**Change**: `setDir()` → updates `playerControlled.nextDir` on head entity

**Change**: `moveSnake()` → reads chain from world, walks linked list. Still inline in game.js for now (moved to system in 4.2).

**Keep**: `drawSnake()` reads from chain entities instead of snake array. `Church.getSnakeStyle()` reads `candlesEaten` from game state entity.

**Remove**: `snake[]` array, `dir`, `nextDir` globals.

**Test**: Verification checklist. Snake moves, grows on eat, segments follow head. Self-collision kills. Tail burn removes last segment. All 3 visual phases work. Horns appear at 8+ candles.

### Task 4.2 — ChainMovementSystem + CollisionSystem

**Create**: `ChainMovementSystem` in `systems.js`:
- Query chain heads (`chainLink` where `parentId === null` + `velocity`)
- Accumulator-based timing
- Move head, cascade body positions via linked list
- Emit `chain:moved`, `chain:blocked`

**Create**: `CollisionSystem` in `systems.js`:
- After movement: check head position for overlapping `collectible` entities → emit `collectible:eaten`
- Check if head moved into `hostile` entity → emit `chain:killed`
- Check `chain:blocked` events (wall/pew/self) → emit `chain:killed` if player snake

**Change**: Remove `moveSnake()` logic from game.js. System handles it.

**Wire**: `bus.on('chain:killed', ...)` → death handler. `bus.on('collectible:eaten', ...)` → score update, chain growth, corruption update.

**Test**: Verification checklist. Movement timing identical (110ms). Eating works via collision system. Death works on wall/pew/self. Score and growth correct.

### Task 4.3 — FlammableSystem + LifetimeSystem + SpawnSystem

**Create** in `systems.js`:

**FlammableSystem**: Query `(position, flammable)`. Advance burn timers. Spread fire to adjacent flammables. Remove collider when burned out. Emit `entity:ignited`, `entity:burnedOut`.

**LifetimeSystem**: Query `(lifetime)`. Compute freshness. Destroy expired. Emit `collectible:expired`.

**SpawnSystem**: Candle/hellfire spawn timer. Tail burn timer. Uses grid for placement. Emit `collectible:spawned`, `hellfire:spawned`.

**Change**: Remove `spawnCandle()`, `burnTail()`, `updateCandles()` from game.js. Systems handle them.

**Test**: Verification checklist. Candles spawn and expire on timer. Hellfire spawns after 6 eaten. Pews burn and spread fire. Tail burns on 1800ms timer.

### Task 4.4 — CorruptionSystem + AudioSyncSystem + AISystem

**Create**:

**CorruptionSystem**: Reads game state (candles eaten, game time), computes target, smooths. Fires threshold events.

**AudioSyncSystem**: Subscribes to bus events, calls AudioEngine methods. Replaces all direct `AudioEngine.play*()` calls.

**AISystem**: Moves from inline `aiDecide()` to system. Queries grid for pathfinding. Sets `velocity` on AI-controlled chain heads.

**Change**: Remove remaining game logic from game.js. The loop becomes:
```javascript
world.runPhase('input');
world.runPhase('ai');
world.runPhase('update');
world.bus.flush();
world.runPhase('render');
```

**Remove**: `totalCandlesEaten`, `gameTime`, `score`, `alive` globals — all in gameState entity.

**Test**: Verification checklist. Full game plays correctly. Wallpaper mode works. All audio triggers correctly. Corruption phases transition smoothly.

---

### ✅ CHECKPOINT 4

**State**: Full ECS. game.js is ~100 lines (loop + setup + UI handlers). church.js is draw functions only (called by render systems). All game logic in systems. Snake is chain entities. EventBus carries all communication. SpatialGrid handles all collision.

**Deliver build, report back. This is the "done" state for the rewrite. Everything after this is new features.**

---

## PHASE 5: Enemies

Goal: Demonstrate the ECS payoff by adding 3 enemy types with minimal code.

### Task 5.1 — Demons

**Create**: `spawnDemon(world, x, y)` — assembles entity with `position`, `collider`, `velocity`, `drawable`, `animated`, `ai`.

**Create**: `DemonAISystem`:
- Query entities with `ai.type === 'demon_pathfind'`
- BFS to nearest `collectible` entity
- Move one step per tick (slower than snake)
- On overlap with collectible → `bus.emit('collectible:stolen', ...)`

**Spawn trigger**: `bus.on('corruption:threshold', ({name}) => { if (name === 'damnation') startDemonSpawner() })`

**Rendering**: New `drawDemon()` function — simple sprite, animated walk cycle.

**Test**: Play to corruption > 0.7. Demons appear from cracks. They pathfind to candles. They steal candles (candle disappears, no score). They collide with pews (blocked). Snake can pass through them (or collide — TBD).

### Task 5.2 — Priests + holy water

**Create**: `spawnPriest(world, x, y)` — `position`, `collider`, `velocity`, `drawable`, `animated`, `ai`.

**Create**: `PriestAISystem`:
- Patrol altar row (back and forth)
- Every N seconds, if snake is in line-of-sight (same row or column), spawn holy water projectile

**Create**: `spawnHolyWater(world, x, y, dx, dy)` — `position`, `collider`, `velocity`, `drawable`, `lifetime`, `hostile`.

**VelocitySystem** already moves projectiles. **CollisionSystem** already detects hostile overlap with snake.

**Spawn**: Priests exist from game start (pre-corruption). Replaced by cultists at high corruption.

**Test**: Priest patrols altar. Throws holy water when snake is aligned. Holy water travels, kills snake on contact, expires after hitting wall or timeout.

### Task 5.3 — Cultists + sacrifices

**Create**: `spawnCultist(world, x, y)` — same components as priest, different `ai.type`.

**Create**: `CultistAISystem`:
- Same patrol behavior as priest
- Throws sacrifice instead of holy water

**Create**: `spawnSacrifice(world, x, y, dx, dy)` — `position`, `drawable`, `collectible`, `lightSource`, `velocity`, `lifetime`.

**Key**: Sacrifice uses **Collectible** component. The **CollisionSystem** already handles snake eating collectibles. Zero new eat logic.

**Spawn**: `bus.on('corruption:threshold', ({name}) => { if (name === 'desecration') replacePriestsWithCultists() })`

**Test**: At high corruption, priests disappear, cultists appear. Cultists throw sacrifices. Snake can eat sacrifices for score/growth. Sacrifices expire or hit walls.

---

### ✅ CHECKPOINT 5

**State**: 3 enemy types working. Demons steal candles, priests throw holy water, cultists throw beneficial sacrifices. All built from existing components and systems with minimal new code.

**Deliver build, report back. Discuss gameplay balance.**

---

## PHASE 6: Polish

### Task 6.1 — Audio GainPool + SpriteCache
### Task 6.2 — Smooth snake interpolation
### Task 6.3 — Screen shake + post-processing

(Detailed specs deferred — depends on what Checkpoint 5 reveals about priorities.)

---

## File Evolution

### After Phase 1
```
src/
  core.js      ← NEW (EventBus, ParticlePool)
  audio.js     ← unchanged
  church.js    ← minor (bus.emit calls added)
  game.js      ← ParticlePool replaces array, bus.emit calls added
  build order: core → audio → church → game
```

### After Phase 2
```
  core.js      ← adds RenderPipeline
  game.js      ← gameLoop uses pipeline.render()
```

### After Phase 3
```
  core.js      ← adds World, SpatialGrid
  church.js    ← shrinks: draw functions + generate (spawns entities)
  game.js      ← shrinks: no candles/particles arrays, reads from world
```

### After Phase 4
```
  core.js      ← EventBus, ParticlePool, World, SpatialGrid, RenderPipeline
  systems.js   ← NEW (all systems)
  audio.js     ← unchanged (AudioSyncSystem in systems.js)
  church.js    ← draw functions only (~400 lines, down from 893)
  game.js      ← loop shell + UI (~150 lines, down from 751)
  build order: core → audio → church → systems → game
```

### After Phase 5
```
  + enemies.js ← NEW (entity factories + AI systems + draw functions)
  build order: core → audio → church → systems → enemies → game
```

---

## Summary

| Phase | Tasks | Risk | Key Deliverable |
|-------|-------|------|----------------|
| **1** | 1.1, 1.2, 1.3 | Low | ParticlePool + EventBus integrated |
| **2** | 2.1, 2.2, 2.3 | Medium | 6-layer render pipeline, static layers cached |
| **3** | 3.1, 3.2, 3.3, 3.4 | **High** | All objects → entities. Church.js gutted. |
| **4** | 4.1, 4.2, 4.3, 4.4 | **High** | Snake → chain entities. All logic → systems. |
| **5** | 5.1, 5.2, 5.3 | Low | 3 enemy types, ECS payoff demonstrated |
| **6** | 6.1, 6.2, 6.3 | Low | Performance + visual polish |
