# Serpens Infernalis v2 — ECS Rewrite Plan

## Stack
- **Language**: TypeScript (strict mode)
- **Modules**: ES modules (import/export)
- **Rendering**: Canvas 2D for now (debug/procedural graphics), designed for sprite swap later
- **Audio**: Web Audio API (existing architecture preserved)
- **Testing**: Vitest (fast, ESM-native, TS-native)
- **Bundler**: Vite (dev server + build)
- **Libraries**: Encouraged where they reduce slop

## Core Principles
- Entities store data (components). Systems operate on data. Renderers draw data.
- Entity never knows HOW it's drawn. System never knows WHAT it's drawing.
- Composition over inheritance — new entity types = new component combinations.
- Test piece by piece. Not every commit needs a working game.
- No slop. Readable, minimal, no unnecessary abstraction.

---

## Phase 1: Foundation

Create the core ECS infrastructure with full test coverage.

### 1.1 — Project setup
- Initialize npm + TypeScript + Vite + Vitest
- Configure tsconfig (strict, ESM, path aliases)
- Directory structure: `src/core/`, `src/systems/`, `src/rendering/`, `src/data/`, `tests/`

### 1.2 — EventBus
- `on(event, fn)`, `off(event, fn)`, `emit(event, data)`, `defer(event, data)`, `flush()`
- Typed events (discriminated union or generic map)
- Tests: subscribe/emit, deferred flush ordering, off removes listener

### 1.3 — World (Entity-Component Store)
- `spawn(...componentPairs)`, `destroy(id)`, `add(id, comp, data)`, `get(id, comp)`, `has(id, comp)`, `remove(id, comp)`
- `tag(id, ...names)`, `untag(id, name)`, `hasTag(id, name)`
- `query(...components)`, `queryTagged(tag, ...components)`
- `addSystem(name, fn, phase)`, `runPhase(phase)`
- Typed component access via generics
- Tests: spawn/destroy lifecycle, query correctness, tag filtering, system execution order

### 1.4 — SpatialGrid
- `add(id, x, y)`, `remove(id)`, `move(id, from, to)`, `at(x, y)`, `isBlocked(x, y, world)`
- `queryArea(cx, cy, r, world, ...components)`
- `toPathGrid(world)` — Uint8Array for BFS
- Tests: add/move/remove, boundary checks, area queries, blocked detection

### 1.5 — ParticlePool
- Pre-allocated fixed array (500 slots)
- `emit(x, y, vx, vy, life, size, hue, smoke)`, `update(dt)`, `draw(ctx)`
- fillRect, no shadowBlur, no arc
- Tests: emit fills slot, update advances physics, expired particles recycle

---

## Phase 2: Render Pipeline

Layered offscreen canvases with dirty-flagging.

### 2.1 — RenderPipeline
- Array of layers: `{ name, canvas, ctx, renderFn, dirty, alwaysDirty }`
- `addLayer(name, fn, opts)`, `markDirty(name)`, `render(mainCtx)`, `resize(w, h)`
- Only dirty/alwaysDirty layers redraw
- Tests: dirty-flagging logic, layer ordering

### 2.2 — Renderer registry
- Map of `drawable.type` -> render function
- `registerRenderer(type, fn)`, lookup + dispatch in RenderSystem
- Placeholder procedural renderers for: pew, candle, hellfire, snakeHead, snakeSegment, altar, statue, stainedGlass, crack, bloodPool, pentagram
- Tests: dispatch to correct renderer, missing type fallback

---

## Phase 3: ECS Core — Entity Conversion

Convert all game objects to entities. Each sub-task is independent and testable.

### 3.1 — Component type definitions
- Define TypeScript interfaces for all components: Position, Collider, Velocity, Drawable, Animated, LightSource, Collectible, Lifetime, Flammable, ChainLink, PlayerControlled, AI, Hostile, Shield, PowerUp, Corruption, Lightning, GameState
- Component registry type map for generic World.get<T>()

### 3.2 — Level generation (entity spawning)
- `generateChurch(world, cols, rows)`: walls, altar, floor
- Spawn entities with correct component sets
- Register in SpatialGrid
- Tests: entity counts, grid population, blocked cells

### 3.3 — Pews as entities
- `spawnPewRow(world, x, y, width)`
- Components: position, collider, flammable, drawable
- Tag: 'pew'
- Tests: spawn, query by tag, grid registration

### 3.4 — Candles/hellfire as entities
- `spawnCandle(world, x, y)`, `spawnHellfire(world, x, y)`
- Candle: position, drawable, collectible, lifetime, lightSource
- Hellfire: same + flammable
- Tests: spawn, component presence, lifetime freshness calculation

### 3.5 — Static environment entities
- Stained glass: position, drawable, lightSource, lightningReactive
- Statues: position, drawable, collider, animated
- Blood pools: position, drawable, animated
- Cracks: position, drawable, lightSource
- Pentagram: position, drawable, animated, lightSource (singleton)
- Altar: position, drawable, collider (singleton)
- Tests: correct component sets, singleton queries

### 3.6 — Singleton entities
- Corruption: corruption component (value, target)
- Lightning: lightning component (timer, alpha)
- GameState: gameState component (score, alive, started, gameTime)
- Tests: singleton query returns exactly one

---

## Phase 4: Snake + Systems

Snake becomes chain entities. Game logic moves to systems.

### 4.1 — Snake as chain entities
- `spawnSnake(world, x, y, length)` — linked list of entities
- Head: position, collider, velocity, playerControlled, chainLink, drawable, animated
- Segments: position, collider, chainLink, drawable, flammable
- Tags: 'snake', 'snakeHead'/'snakeSegment'
- Tests: chain integrity, head/tail traversal, segment count

### 4.2 — InputSystem
- Keyboard + touch -> playerControlled.nextDir
- Prevent 180-degree reversal
- Tests: direction mapping, reversal prevention

### 4.3 — ChainMovementSystem
- Move chain heads, cascade body segments
- Accumulator-based timing
- Emit chain:moved, chain:blocked
- Tests: head moves, body cascades, blocked on wall/collider

### 4.4 — CollisionSystem
- After movement: check overlaps
- Snake head + collectible -> collectible:eaten
- Snake head + hostile -> chain:killed
- Tests: eat detection, kill detection, ignore non-overlapping

### 4.5 — CollectibleSystem
- On collectible:eaten: update score, grow chain, update corruption
- Tests: score calculation, chain growth, corruption increment

### 4.6 — FlammableSystem
- Burn timers, fire spread to adjacent flammables, destroy when done
- Emit entity:ignited, entity:burnedOut
- Tests: burn progression, spread radius, collider removal

### 4.7 — LifetimeSystem
- Compute freshness, destroy expired entities
- Emit collectible:expired
- Tests: freshness decay, expiry timing

### 4.8 — CorruptionSystem
- Smooth toward target, fire threshold events
- Tests: smoothing, threshold crossing detection

### 4.9 — SpawnSystem
- Candle/hellfire spawn timer, tail burn timer
- Tests: spawn rate, hellfire transition at 6 eaten

### 4.10 — LightningSystem + AnimationSystem
- Lightning: random timer, flash state
- Animation: advance animated components
- Tests: timer cycling, state machine transitions

### 4.11 — AISystem (snake autopilot)
- BFS pathfinding, tail-reachability check, flood-fill fallback
- Tests: pathfinding correctness, fallback behavior

### 4.12 — AudioSyncSystem
- Event listener -> SFX/music triggers
- Wraps existing AudioEngine
- Tests: correct event -> SFX mapping

---

## Phase 5: Enemies

Demonstrate ECS composability.

### 5.1 — Demons (flame thieves)
### 5.2 — Priests + holy water projectiles
### 5.3 — Cultists + sacrifice projectiles

---

## Phase 6: Polish

### 6.1 — Sprite-based rendering (swap renderer layer)
### 6.2 — Audio GainPool
### 6.3 — Smooth snake interpolation
### 6.4 — Screen shake + post-processing
