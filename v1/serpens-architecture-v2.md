# Serpens Infernalis — Architecture v2: ECS Rewrite

---

## Part I: Current State Audit

### File Inventory

| File | Lines | Role | Pain Level |
|------|-------|------|------------|
| `game.js` | 751 | Game loop, snake logic, AI, input, particles, candle/hellfire rendering, HUD | **High** — does too many unrelated things |
| `church.js` | 893 | Level gen, collision grid, pew/altar/window/glyph/statue/crack drawing, snake appearance, corruption state, lightning, vignette | **Critical** — god object |
| `audio.js` | 914 | Web Audio engine: Effect/Track/Song/Scheduler classes, SFX, drone, bells, corruption crossfade | **Medium** — well-structured internally but isolated from game events |
| **Total** | **2,558** | | |

### What Works Well

**Audio architecture.** The Effect → Track → Song → Scheduler pipeline is solid. Lookahead scheduling avoids drift. The corruption crossfade (pure/dark song volumes) is elegant. Most reusable subsystem — survives the rewrite nearly intact.

**Visual atmosphere.** The layered rendering creates genuine depth. The fire tracing pentagram is a standout. The corruption-driven aesthetic transformation from one `[0,1]` float is a good instinct.

**AI autopilot.** BFS + tail-reachability + flood-fill is a competent snake AI. It survives long enough to demo the full corruption arc in wallpaper mode.

### Why It Stutters

| Cause | Severity | Location |
|-------|----------|----------|
| Gradient allocation per frame (~60+) | **High** | drawCandle, drawHellfire, drawPews, drawStainedGlass |
| Full tile redraw every frame (672 tiles) | **High** | drawTiles — 40,320 rect fills/sec for the floor alone |
| `ctx.shadowBlur` on every particle | **Medium** | drawParticles — triggers Gaussian blur pass per call |
| `particles.splice()` in loop | **Medium** | updateParticles — O(n) per removal, 200+ particles |
| Web Audio node GC pressure | **Medium** | Track.play() — 42 node graphs created/sec across 6 tracks |
| `snake.some()` O(n) collision | **Low now, High with enemies** | moveSnake |
| `getBurningPews()` array allocation per frame | **Low** | game loop |
| String-keyed tileCorr hashmap | **Low** | addTileCorr — string concat on every access |
| `performance.now()` vs rAF timestamp drift | **Low** | candle birth vs age calculation use different clocks |

### Structural Problems

**church.js is a god object.** 893 lines, 25+ functions, one IIFE. It owns: level generation, pew grid, pew burning, corruption state, tile corruption, blood pools, stained glass rendering, light beams, altar rendering, pew rendering, statue state + rendering, crack state + rendering, pentagram state + rendering, lightning state + rendering, vignette rendering, snake appearance, demon horn rendering. Everything depends on it. Nothing can be tested independently.

**game.js scatters state across 15+ module-level variables.** `snake`, `candles`, `particles`, `dir`, `nextDir`, `score`, `alive`, `gameStarted`, `totalCandlesEaten`, `gameTime`, three accumulators. Adding demons means adding more globals. No encapsulation.

**Direct coupling between all three files.** `moveSnake()` calls `Church.addTileCorr()`, `Church.setCandlesEaten()`, `Church.setCorruption()`, `Church.spawnBlood()`, `AudioEngine.playEat()`. `spawnCandle()` calls `Church.addCrack()`, `Church.tryBurnPewsNear()`. Snake appearance lives in `church.js` because it needs `corruption`. Every new interaction requires touching multiple files.

**No spatial structure.** `tryBurnPewsNear` scans all pews. `snake.some()` scans all segments. `candles.some()` scans all candles. Collision is O(entities). Adding enemies that interact with pews/candles/snake compounds this quadratically.

**Rendering and logic are interleaved.** `drawCandle` (50 lines), `drawHellfire` (35 lines), `drawSnake` (120 lines) in game.js. 12 draw functions in church.js. The snake's visual style is computed in church.js but drawn in game.js. No clear boundary between simulation and presentation.

---

## Part II: Feature Catalog

### Current Features

| Category | Features |
|----------|----------|
| Core mechanics | Grid-based snake (110ms tick), tail burning (1800ms), candle→hellfire transition at 6 eaten, score (base + freshness), pew/statue collision, AI autopilot |
| Snake phases | Green natural (0-5) → burning transition (6-12) → demon (13+), horns grow at 8+, tail flame at 6+ |
| Environment | Pew burning, floor crack persistence, stained glass + directional light beams, lightning flashes, pentagram fire-tracing (corruption > 0.5), blood pools, corruption vignette |
| Particles | Flames, smoke, sparks, death burst, candle-out smoke |
| Audio | Dual-hymn organ (C major → C minor crossfade), choir, sub-bass drone, bells, 6 SFX types, per-track effects |
| UI | Touch/keyboard input, HUD (segments, candles, score), game-over overlay with corruption-based title |

### Planned Extensions

| Feature | Components Needed | Notes |
|---------|-------------------|-------|
| **Demons** (flame thieves) | Position, Drawable, Collider, Animated, AI, ChainLink (optional), Velocity | Spawn from cracks. Pathfind to candles. Consume on contact. Imp (fast) vs Brute (slow, destroys pews). |
| **Priests** (altar guardians) | Position, Drawable, Collider, Animated, AI, Velocity | Patrol altar row. Throw holy water projectiles. Active pre-corruption. |
| **Cultists** (replace priests) | Position, Drawable, Collider, Animated, AI, Velocity | Same behavior slot as priests. Throw sacrifices the snake can eat. |
| **Holy water** (projectile) | Position, Drawable, Collider, Velocity, Lifetime, Hostile | Grid-based 4-directional travel. Kills snake on contact. |
| **Sacrifice** (projectile) | Position, Drawable, Collectible, LightSource, Velocity, Lifetime | Snake eats it like a candle — same CollectibleSystem handles it. |
| **Power-ups** | Position, Drawable, Collectible, Lifetime, PowerUp | Temporary invincibility (add Shield to segments), speed boost, multi-eat. |
| **Centipede demon** | Same as snake: Position, Drawable, Collider, ChainLink, AI, Velocity | Reuses ChainMovementSystem. Head has AI instead of PlayerControlled. |
| **Boss encounters** | Position, Drawable, Collider, Animated, AI, Health | Spawn at corruption thresholds. |

---

## Part III: ECS Architecture

### Why ECS

The argument isn't performance (entity count is < 200). The argument is **composition**.

A statue is `(Position, Drawable, Collider, Animated)`. A pew is `(Position, Drawable, Collider, Flammable)`. What's hellfire? It's a candle with `Flammable` added — `(Position, Drawable, Collectible, LightSource, Lifetime, Flammable)`. What's a sacrifice thrown by a cultist? `(Position, Drawable, Collectible, LightSource, Velocity, Lifetime)` — the snake eats it using the exact same system that handles candles.

A snake segment and a demon are both `(Position, Collider, Drawable)`. The collision system doesn't know or care which is which. A demon that catches fire when it walks through hellfire? Slap `Flammable` on it — the `FlammableSystem` handles it automatically.

Without ECS, every new entity type requires a new class, a new update path in the game loop, new rendering code, and new collision checks against every other type. With ECS, you assemble components and the existing systems handle the rest.

### World

```javascript
class World {
  constructor() {
    this.nextId = 0;
    this.stores = new Map();    // componentName → Map<entityId, componentData>
    this.tags = new Map();      // tag → Set<entityId>
    this.systems = [];          // { name, fn, phase }
    this.bus = new EventBus();
    this.grid = null;           // SpatialGrid — initialized on level gen
    this.time = { now: 0, dt: 0, gameTime: 0 };
  }

  // --- Entity lifecycle ---

  spawn(...componentPairs) {
    // componentPairs: ['position', {x,y}], ['drawable', {layer,sprite}], ...
    const id = this.nextId++;
    for (let i = 0; i < componentPairs.length; i += 2) {
      this.add(id, componentPairs[i], componentPairs[i + 1]);
    }
    return id;
  }

  destroy(id) {
    // Remove from spatial grid if it has position
    const pos = this.get(id, 'position');
    if (pos && this.grid) this.grid.remove(id);
    // Remove from all component stores
    for (const store of this.stores.values()) store.delete(id);
    for (const set of this.tags.values()) set.delete(id);
    this.bus.emit('entity:destroyed', { id });
  }

  // --- Component access ---

  add(id, component, data = {}) {
    if (!this.stores.has(component)) this.stores.set(component, new Map());
    this.stores.get(component).set(id, data);
    // Auto-register in spatial grid when position added
    if (component === 'position' && this.grid) this.grid.add(id, data.x, data.y);
    return this;
  }

  get(id, component) {
    return this.stores.get(component)?.get(id) ?? null;
  }

  has(id, component) {
    return this.stores.get(component)?.has(id) ?? false;
  }

  remove(id, component) {
    this.stores.get(component)?.delete(id);
  }

  // --- Tags (components with no data, just flags) ---

  tag(id, ...tagNames) {
    for (const t of tagNames) {
      if (!this.tags.has(t)) this.tags.set(t, new Set());
      this.tags.get(t).add(id);
    }
  }

  untag(id, tagName) {
    this.tags.get(tagName)?.delete(id);
  }

  hasTag(id, tagName) {
    return this.tags.get(tagName)?.has(id) ?? false;
  }

  // --- Queries ---

  // All entities with ALL listed components
  query(...components) {
    const stores = components.map(c => this.stores.get(c)).filter(Boolean);
    if (stores.length !== components.length) return [];
    // Iterate smallest store for efficiency
    const smallest = stores.reduce((a, b) => a.size < b.size ? a : b);
    const results = [];
    for (const id of smallest.keys()) {
      if (stores.every(s => s.has(id))) results.push(id);
    }
    return results;
  }

  // All entities with ALL listed components AND tag
  queryTagged(tag, ...components) {
    const tagSet = this.tags.get(tag);
    if (!tagSet) return [];
    const stores = components.map(c => this.stores.get(c)).filter(Boolean);
    if (stores.length !== components.length) return [];
    const results = [];
    for (const id of tagSet) {
      if (stores.every(s => s.has(id))) results.push(id);
    }
    return results;
  }

  // --- Systems ---

  addSystem(name, fn, phase = 'update') {
    this.systems.push({ name, fn, phase });
  }

  runPhase(phase) {
    for (const sys of this.systems) {
      if (sys.phase === phase) sys.fn(this);
    }
  }
}
```

### EventBus

```javascript
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.queue = [];      // deferred events (processed between frames)
    this.immediate = [];  // processed immediately
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  off(event, fn) {
    const list = this.listeners.get(event);
    if (list) this.listeners.set(event, list.filter(f => f !== fn));
  }

  // Fire immediately (within current system)
  emit(event, data) {
    const list = this.listeners.get(event);
    if (list) for (const fn of list) fn(data);
  }

  // Queue for end-of-frame processing (safe for entity creation/destruction)
  defer(event, data) {
    this.queue.push({ event, data });
  }

  flush() {
    const q = this.queue;
    this.queue = [];
    for (const { event, data } of q) this.emit(event, data);
  }
}
```

### SpatialGrid

Replaces the flat `pewGrid` Uint8Array. Supports O(1) point queries and O(r²) area queries.

```javascript
class SpatialGrid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    // Each cell: small array of entity IDs
    this.cells = new Array(cols * rows).fill(null).map(() => []);
    // Parallel static flags for fast pathfinding (walls, altar)
    this.blocked = new Uint8Array(cols * rows);
  }

  _idx(x, y) { return y * this.cols + x; }
  _inBounds(x, y) { return x >= 0 && x < this.cols && y >= 0 && y < this.rows; }

  add(id, x, y) {
    if (!this._inBounds(x, y)) return;
    this.cells[this._idx(x, y)].push(id);
  }

  remove(id) {
    // Called from world.destroy — scans to find cell
    // (Could track entity→cell mapping for O(1), but entity count is small)
    for (const cell of this.cells) {
      const idx = cell.indexOf(id);
      if (idx >= 0) { cell[idx] = cell[cell.length - 1]; cell.pop(); return; }
    }
  }

  move(id, fromX, fromY, toX, toY) {
    if (this._inBounds(fromX, fromY)) {
      const cell = this.cells[this._idx(fromX, fromY)];
      const idx = cell.indexOf(id);
      if (idx >= 0) { cell[idx] = cell[cell.length - 1]; cell.pop(); }
    }
    if (this._inBounds(toX, toY)) {
      this.cells[this._idx(toX, toY)].push(id);
    }
  }

  // All entity IDs at a specific tile
  at(x, y) {
    if (!this._inBounds(x, y)) return [];
    return this.cells[this._idx(x, y)];
  }

  // Is tile blocked? (static geometry OR any entity with Collider)
  isBlocked(x, y, world) {
    if (!this._inBounds(x, y)) return true;
    if (this.blocked[this._idx(x, y)]) return true;
    return this.cells[this._idx(x, y)].some(id => world.has(id, 'collider'));
  }

  // All entities within Manhattan distance `r` that match a component filter
  queryArea(cx, cy, r, world, ...requiredComponents) {
    const results = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this._inBounds(x, y)) continue;
        for (const id of this.cells[this._idx(x, y)]) {
          if (requiredComponents.every(c => world.has(id, c))) {
            results.push(id);
          }
        }
      }
    }
    return results;
  }

  // Generate pathfinding grid (Uint8Array: 0=free, 1=blocked)
  toPathGrid(world) {
    const g = new Uint8Array(this.cols * this.rows);
    for (let i = 0; i < g.length; i++) {
      if (this.blocked[i]) { g[i] = 1; continue; }
      for (const id of this.cells[i]) {
        if (world.has(id, 'collider')) { g[i] = 1; break; }
      }
    }
    return g;
  }
}
```

---

## Part IV: Components

Components are plain data objects. No methods, no inheritance, no `this`. Systems operate on them.

### Spatial

```javascript
// Position on grid. Required for spatial grid registration.
position: { x: 0, y: 0 }

// Occupies tile, blocks movement. Used by collision queries.
collider: {
  solid: true,       // blocks snake/enemy movement
  trigger: false,    // overlaps detected but doesn't block (collectibles)
}

// Grid-based movement. Head-driven (snake, projectile) or autonomous (enemy).
velocity: {
  dx: 0, dy: 0,          // direction
  interval: 110,          // ms between moves
  accumulator: 0,         // internal timer
}
```

### Visual

```javascript
// Renderable entity. Determines which render layer and how.
drawable: {
  layer: 0,              // 0=floor, 1=environment, 2=entity, 3=effect, 4=overlay
  type: 'pew',           // renderer key — selects the draw function
  zIndex: 0,             // sort within layer
  visible: true,
}

// Animated state (statues crying, pentagram tracing, fire flickering)
animated: {
  state: 'idle',         // state machine key
  t: 0,                  // animation time
  speed: 1,              // playback rate
  data: {},              // animation-specific state (tearY, glyphGrowth, etc.)
}

// Emits light/glow (candles, hellfire, cracks, pentagram)
lightSource: {
  radius: 1.5,           // in grid units
  color: [255, 200, 100],
  intensity: 0.5,
  flicker: 0,            // 0-1, randomized per frame
}
```

### Gameplay

```javascript
// Can be consumed by snake (or stolen by demon)
collectible: {
  type: 'candle',        // 'candle' | 'hellfire' | 'sacrifice' | 'powerup'
  baseScore: 10,
  segments: 3,           // snake segments gained on eat
}

// Has a limited lifespan. Destroyed when expired.
lifetime: {
  birth: 0,              // world.time.now at creation
  duration: 14000,       // ms
  freshness: 1,          // computed: 1→0 over duration, affects score/size
}

// Burns over time, then dies. Triggers pew destruction, visual effects.
flammable: {
  burning: false,
  burnT: 0,              // ms accumulated
  burnDuration: 3500,    // ms until dead
  spreadRadius: 1,       // can ignite adjacent Flammable entities
}

// Snake/enemy chain link
chainLink: {
  headId: null,          // entity ID of chain head (for quick lookup)
  parentId: null,        // previous link (null = head)
  childId: null,         // next link (null = tail)
  index: 0,              // 0 = head, 1, 2, ... = body
}

// Player-controlled (reads input)
playerControlled: {
  nextDir: { x: 1, y: 0 },
}

// AI-controlled (computed by AISystem)
ai: {
  type: 'snake_autopilot',  // | 'demon_pathfind' | 'priest_patrol' | 'cultist_patrol'
  target: null,              // entity ID or grid position
  state: 'idle',
  data: {},                  // ai-specific state
}

// Deals damage to specific targets on contact
hostile: {
  targets: ['snake'],     // entity tags that this kills/damages
}

// Temporary invulnerability
shield: {
  remaining: 0,           // ms remaining
}

// Power-up effect applied on collection
powerUp: {
  effect: 'speed',        // 'speed' | 'invincible' | 'multi_eat'
  duration: 5000,
  magnitude: 1.5,
}

// Reacts visually to lightning strikes
lightningReactive: {
  flashMultiplier: 0.5,
}
```

### Singleton Components (One entity each)

```javascript
// The corruption state — lives on a singleton entity
corruption: {
  value: 0,              // 0→1
  target: 0,             // smoothed target
}

// Lightning state
lightning: {
  timer: 10000,
  alpha: 0,
}

// Score/game state
gameState: {
  score: 0,
  alive: true,
  started: false,
  gameTime: 0,
}
```

---

## Part V: Component Map

What every entity type is made of:

| Entity | position | collider | velocity | drawable | animated | chainLink | collectible | lifetime | flammable | lightSource | ai | playerCtl | hostile | lightningReactive |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Wall** | ✓ | ✓ | | | | | | | | | | | | |
| **Floor tile** | ✓ | | | ✓ | | | | | | | | | | |
| **Pew** | ✓ | ✓ | | ✓ | | | | | ✓ | | | | | |
| **Altar** | ✓ | ✓ | | ✓ | | | | | | | | | | |
| **Statue** | ✓ | ✓ | | ✓ | ✓ | | | | | | | | | |
| **Stained glass** | ✓ | | | ✓ | | | | | | ✓ | | | | ✓ |
| **Candle** | ✓ | | | ✓ | | | ✓ | ✓ | | ✓ | | | | |
| **Hellfire** | ✓ | | | ✓ | | | ✓ | ✓ | ✓ | ✓ | | | | |
| **Blood pool** | ✓ | | | ✓ | ✓ | | | | | | | | | |
| **Crack** | ✓ | | | ✓ | | | | | | ✓ | | | | |
| **Pentagram** | ✓ | | | ✓ | ✓ | | | | | ✓ | | | | |
| **Snake head** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ | | |
| **Snake segment** | ✓ | ✓ | | ✓ | | ✓ | | | ✓ | | | | | |
| **Demon** | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ | | | |
| **Centipede head** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | ✓ | | ✓ | |
| **Centipede seg** | ✓ | ✓ | | ✓ | | ✓ | | | ✓ | | | | ✓ | |
| **Priest** | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ | | | |
| **Cultist** | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ | | | |
| **Holy water** | ✓ | ✓ | ✓ | ✓ | | | | ✓ | | | | | ✓ | |
| **Sacrifice** | ✓ | | ✓ | ✓ | | | ✓ | ✓ | | ✓ | | | | |
| **Power-up** | ✓ | | | ✓ | ✓ | | ✓ | ✓ | | ✓ | | | | |

Notice how the snake and a centipede enemy have nearly identical component signatures. The only difference is `playerControlled` vs `ai` on the head, and `hostile` on the centipede. The `ChainMovementSystem` handles both identically.

A sacrifice and a candle differ only by having `velocity` (it moves). The `CollectibleSystem` eats both the same way. The `DrawSystem` routes to different renderers based on `drawable.type`, but the game logic is shared.

---

## Part VI: Systems

Systems are stateless functions. They query the world for entities with specific components and operate on them. Run order matters — it replaces the implicit ordering in the current monolithic game loop.

### System Execution Order

```
PHASE: input
  InputSystem            — reads keyboard/touch → sets playerControlled.nextDir

PHASE: ai
  SnakeAISystem          — BFS pathfinding for autopilot snake heads
  DemonAISystem          — pathfind toward nearest collectible
  PriestAISystem         — patrol altar, decide when to throw
  CultistAISystem        — same patrol, throw sacrifices

PHASE: update
  ChainMovementSystem    — move chain heads, cascade body segments
  VelocitySystem         — move non-chain entities (projectiles, lone enemies)
  CollisionSystem        — detect overlaps, emit events
  CollectibleSystem      — handle eat/steal events, update score
  FlammableSystem        — burn timers, spread fire, destroy burnt entities
  LifetimeSystem         — expire old collectibles/projectiles
  CorruptionSystem       — update corruption value, fire threshold events
  LightningSystem        — timer, flash state
  AnimationSystem        — advance all animated components (statues, pentagram, blood)
  SpawnSystem            — candle/hellfire/enemy spawn on timers + corruption thresholds
  ShieldSystem           — decrement shield timers, remove expired shields

PHASE: deferred
  EventBus.flush()       — process deferred entity creation/destruction

PHASE: render
  TileRenderSystem       — static floor layer (dirty-flagged)
  EnvironmentRenderSystem — blood, cracks, pews, altar, statues (event-driven)
  LightBeamRenderSystem  — stained glass beams (corruption/lightning-driven)
  EntityRenderSystem     — snake, candles, enemies, projectiles (every frame)
  ParticleRenderSystem   — particle pool (every frame)
  OverlayRenderSystem    — pentagram, lightning flash, vignette (every frame when active)

PHASE: audio
  AudioSyncSystem        — listens to events, triggers SFX + updates corruption crossfade
```

### Key System Implementations

#### ChainMovementSystem

Handles snake AND any future chain-based enemy. Agnostic about what controls the head.

```javascript
function chainMovementSystem(world) {
  const dt = world.time.dt * 1000;

  // Find all chain heads
  for (const id of world.query('chainLink', 'position', 'velocity')) {
    const link = world.get(id, 'chainLink');
    if (link.parentId !== null) continue;  // only heads

    const vel = world.get(id, 'velocity');
    vel.accumulator += dt;
    if (vel.accumulator < vel.interval) continue;
    vel.accumulator -= vel.interval;

    // Resolve direction: playerControlled or AI sets dx/dy on velocity
    const pc = world.get(id, 'playerControlled');
    if (pc) { vel.dx = pc.nextDir.x; vel.dy = pc.nextDir.y; }

    if (vel.dx === 0 && vel.dy === 0) continue;

    const pos = world.get(id, 'position');
    const newX = pos.x + vel.dx, newY = pos.y + vel.dy;

    // Collision check: is target tile blocked?
    if (world.grid.isBlocked(newX, newY, world)) {
      world.bus.emit('chain:blocked', {
        headId: id, x: newX, y: newY,
        isPlayer: !!pc,
      });
      continue;
    }

    // Cascade: walk chain tail→head, each takes parent's old position
    // (Collect positions first, then move — avoids grid inconsistency)
    const chain = [];
    let cur = id;
    while (cur !== null) {
      const p = world.get(cur, 'position');
      const cl = world.get(cur, 'chainLink');
      chain.push({ id: cur, oldX: p.x, oldY: p.y, childId: cl.childId });
      cur = cl.childId;
    }

    // Move head
    world.grid.move(id, pos.x, pos.y, newX, newY);
    pos.x = newX; pos.y = newY;

    // Cascade body
    for (let i = 1; i < chain.length; i++) {
      const seg = chain[i];
      const segPos = world.get(seg.id, 'position');
      const prevOld = chain[i - 1];
      world.grid.move(seg.id, segPos.x, segPos.y, prevOld.oldX, prevOld.oldY);
      segPos.x = prevOld.oldX;
      segPos.y = prevOld.oldY;
    }

    world.bus.emit('chain:moved', { headId: id, x: newX, y: newY });
  }
}
```

#### CollisionSystem

Runs after movement. Checks what's overlapping what.

```javascript
function collisionSystem(world) {
  // Snake heads eating collectibles
  for (const headId of world.queryTagged('snakeHead', 'position')) {
    const pos = world.get(headId, 'position');
    const here = world.grid.at(pos.x, pos.y);

    for (const otherId of here) {
      if (otherId === headId) continue;

      // Collectible?
      if (world.has(otherId, 'collectible')) {
        const col = world.get(otherId, 'collectible');
        const lt = world.get(otherId, 'lifetime');
        world.bus.emit('collectible:eaten', {
          entityId: otherId,
          eaterId: headId,
          type: col.type,
          freshness: lt ? lt.freshness : 1,
          x: pos.x, y: pos.y,
        });
        world.destroy(otherId);
        continue;
      }

      // Hostile projectile?
      if (world.has(otherId, 'hostile')) {
        const h = world.get(otherId, 'hostile');
        if (h.targets.includes('snake')) {
          world.bus.emit('chain:killed', {
            headId, killerId: otherId,
            x: pos.x, y: pos.y, cause: 'hostile',
          });
        }
      }
    }
  }

  // Demons stealing collectibles
  for (const demonId of world.queryTagged('demon', 'position')) {
    const pos = world.get(demonId, 'position');
    for (const otherId of world.grid.at(pos.x, pos.y)) {
      if (world.has(otherId, 'collectible')) {
        world.bus.emit('collectible:stolen', {
          entityId: otherId, thiefId: demonId,
          x: pos.x, y: pos.y,
        });
        world.destroy(otherId);
        break;
      }
    }
  }
}
```

#### FlammableSystem

Generic. Burns pews, hellfire-adjacent demons, future flammable things.

```javascript
function flammableSystem(world) {
  const dt = world.time.dt * 1000;

  for (const id of world.query('position', 'flammable')) {
    const f = world.get(id, 'flammable');

    if (!f.burning) {
      // Check: is there an active fire source adjacent?
      // (Hellfire spawning, burning pew, etc.)
      // This is triggered by events, not polled — see FlammableIgniteListener
      continue;
    }

    f.burnT += dt;

    // Spread fire to adjacent Flammable entities
    if (f.burnT > f.burnDuration * 0.3 && !f._spread) {
      f._spread = true;
      const pos = world.get(id, 'position');
      const neighbors = world.grid.queryArea(
        pos.x, pos.y, f.spreadRadius, world, 'flammable'
      );
      for (const nId of neighbors) {
        if (nId === id) continue;
        const nf = world.get(nId, 'flammable');
        if (!nf.burning) {
          nf.burning = true;
          world.bus.emit('entity:ignited', { id: nId, sourceId: id });
        }
      }
    }

    // Destroy when fully burned
    if (f.burnT >= f.burnDuration) {
      world.bus.emit('entity:burnedOut', { id });
      // If it has a collider, removing it opens the path
      if (world.has(id, 'collider')) {
        world.remove(id, 'collider');
        world.bus.emit('grid:changed', {}); // renderers can dirty-flag
      }
      // Mark drawable as charred, or destroy entirely
      const d = world.get(id, 'drawable');
      if (d) d.type = d.type + '_charred';
    }
  }
}
```

#### CorruptionSystem

Singleton entity. Fires threshold events that other systems subscribe to.

```javascript
function corruptionSystem(world) {
  const entities = world.query('corruption');
  if (entities.length === 0) return;
  const id = entities[0];
  const c = world.get(id, 'corruption');

  // Smooth toward target
  const prev = c.value;
  c.value += (c.target - c.value) * 0.02;
  c.value = Math.max(0, Math.min(1, c.value));

  if (Math.abs(c.value - prev) < 0.0001) return;

  world.bus.emit('corruption:changed', { value: c.value, delta: c.value - prev });

  // Check thresholds
  const thresholds = [
    [0.15, 'unease'],
    [0.30, 'taint'],
    [0.40, 'desecration'],
    [0.50, 'hellfire'],       // windows go red, pentagram begins
    [0.60, 'weeping'],        // statues cry
    [0.70, 'damnation'],      // demons start spawning
    [0.85, 'apocalypse'],     // boss territory
  ];

  for (const [threshold, name] of thresholds) {
    if (prev < threshold && c.value >= threshold) {
      world.bus.emit('corruption:threshold', { threshold, name, value: c.value });
    }
  }
}
```

#### SpawnSystem

Listens to corruption thresholds for enemy spawning. Runs candle/hellfire timers.

```javascript
function spawnSystem(world) {
  const dt = world.time.dt * 1000;
  const gs = world.query('gameState').map(id => world.get(id, 'gameState'))[0];
  if (!gs || !gs.alive) return;

  // Candle/hellfire spawn timer
  gs._spawnAcc = (gs._spawnAcc || 0) + dt;
  if (gs._spawnAcc >= 3000) {
    gs._spawnAcc -= 3000;
    spawnCollectible(world, gs);
  }

  // Tail burn timer
  gs._burnAcc = (gs._burnAcc || 0) + dt;
  if (gs._burnAcc >= 1800) {
    gs._burnAcc -= 1800;
    burnChainTail(world, gs);
  }
}

function spawnCollectible(world, gs) {
  // Count existing collectibles
  const existing = world.query('collectible').length;
  if (existing >= 12) return;

  const corr = world.query('corruption').map(id => world.get(id, 'corruption'))[0];
  const isHellfire = (gs._totalEaten || 0) >= 6;

  // Find empty tile (not blocked, no entity)
  let attempts = 0;
  while (attempts++ < 200) {
    const x = 1 + Math.floor(Math.random() * (world.grid.cols - 2));
    const y = 1 + Math.floor(Math.random() * (world.grid.rows - 2));
    if (world.grid.isBlocked(x, y, world)) continue;
    if (world.grid.at(x, y).length > 0) continue;

    if (isHellfire) {
      spawnHellfire(world, x, y);
    } else {
      spawnCandle(world, x, y);
    }
    return;
  }
}

function spawnCandle(world, x, y) {
  world.spawn(
    'position',    { x, y },
    'drawable',    { layer: 2, type: 'candle', zIndex: 0, visible: true },
    'collectible', { type: 'candle', baseScore: 10, segments: 3 },
    'lifetime',    { birth: world.time.now, duration: 14000, freshness: 1 },
    'lightSource', { radius: 1.2, color: [255, 200, 100], intensity: 0.4, flicker: Math.random() * 6.28 },
  );
}

function spawnHellfire(world, x, y) {
  const id = world.spawn(
    'position',    { x, y },
    'drawable',    { layer: 2, type: 'hellfire', zIndex: 1, visible: true },
    'collectible', { type: 'hellfire', baseScore: 15, segments: 3 },
    'lifetime',    { birth: world.time.now, duration: 14000, freshness: 1 },
    'flammable',   { burning: true, burnT: 0, burnDuration: 99999, spreadRadius: 1 },
    'lightSource', { radius: 1.8, color: [255, 60, 0], intensity: 0.6, flicker: Math.random() * 6.28 },
  );

  // Spawn crack entity at same position (persists after hellfire expires)
  world.spawn(
    'position',    { x, y },
    'drawable',    { layer: 0, type: 'crack', zIndex: 5, visible: true },
    'lightSource', { radius: 0.5, color: [180, 30, 0], intensity: 0.15, flicker: 0 },
  );

  world.bus.emit('hellfire:spawned', { x, y });
}
```

---

## Part VII: Rendering Architecture

### Layer System

Offscreen canvas layers. Each layer only redraws when dirty. Composited every frame.

```javascript
class RenderPipeline {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [];          // ordered back-to-front
    this.mainCtx = null;       // set on init
    this.spriteCache = new SpriteCache();
  }

  addLayer(name, renderFn, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    this.layers.push({
      name,
      canvas,
      ctx: canvas.getContext('2d'),
      render: renderFn,
      dirty: true,
      alwaysDirty: options.alwaysDirty || false,  // entity/particle layers
    });
  }

  markDirty(layerName) {
    const layer = this.layers.find(l => l.name === layerName);
    if (layer) layer.dirty = true;
  }

  render(mainCtx) {
    for (const layer of this.layers) {
      if (layer.dirty || layer.alwaysDirty) {
        layer.ctx.clearRect(0, 0, this.width, this.height);
        layer.render(layer.ctx, this.spriteCache);
        layer.dirty = false;
      }
      mainCtx.drawImage(layer.canvas, 0, 0);
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    for (const layer of this.layers) {
      layer.canvas.width = width;
      layer.canvas.height = height;
      layer.dirty = true;
    }
    this.spriteCache.invalidateAll();
  }
}
```

### Layer Update Frequencies

| Layer | Name | Redraws When | ~Frequency |
|-------|------|-------------|-----------|
| 0 | `tiles` | `corruption:threshold` event | ~7× per game |
| 1 | `blood_cracks` | `blood:spawned`, `hellfire:spawned` | Event-driven |
| 2 | `environment` | `entity:ignited`, `entity:burnedOut`, `grid:changed`, `corruption:threshold` | Event-driven |
| 3 | `lightbeams` | `corruption:threshold`, `lightning:flash` | Event-driven + lightning |
| 4 | `entities` | Always (snake, candles, enemies move) | **Every frame** |
| 5 | `particles` | Always | **Every frame** |
| 6 | `overlay` | Always when active (pentagram animating, vignette pulsing) | **Every frame** |

Only layers 4-6 redraw every frame. That's entities + particles + overlay — the things that are actually animating. Everything else is event-driven.

### SpriteCache

Pre-render expensive static visuals once.

```javascript
class SpriteCache {
  constructor() { this.cache = new Map(); }

  getOrCreate(key, width, height, drawFn) {
    if (this.cache.has(key)) return this.cache.get(key);
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    drawFn(c.getContext('2d'), width, height);
    this.cache.set(key, c);
    return c;
  }

  invalidate(prefix) {
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) this.cache.delete(k);
    }
  }

  invalidateAll() { this.cache.clear(); }
}
```

**Cache candidates:**

| Sprite | Key | When Invalidated |
|--------|-----|-----------------|
| Pew tile (6 wood variants) | `pew:${seed}` | Never |
| Pew tile burning (per burn stage) | `pew:burn:${stage}` | Never |
| Altar | `altar:${corruptionBucket}` | `corruption:threshold` |
| Statue base | `statue:${side}:${crying}` | Crying state change |
| Candle wax body (per height) | `candle:${h10}:${hue}` | Never — flame tip drawn live |
| Window frame | `window:${side}:${corruptionBucket}` | `corruption:threshold` |

Flame tips, particles, snake segments, and the pentagram tracing animation are still drawn live (they flicker/animate per frame).

### ParticlePool

Zero-allocation particle system. Pre-allocated array, swap-deactivate, `fillRect` instead of `arc` + `shadowBlur`.

```javascript
class ParticlePool {
  constructor(max = 500) {
    this.pool = new Array(max);
    for (let i = 0; i < max; i++) {
      this.pool[i] = {
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, size: 0,
        hue: 0, smoke: false,
      };
    }
  }

  emit(x, y, vx, vy, life, size, hue, smoke = false) {
    for (const p of this.pool) {
      if (p.active) continue;
      p.active = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life; p.size = size;
      p.hue = hue; p.smoke = smoke;
      return;
    }
    // Pool exhausted — silently drop. No allocation.
  }

  update(dt) {
    const dt60 = dt * 60;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x += p.vx * dt60;
      p.y += p.vy * dt60;
      p.vy -= 0.03 * dt60;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  draw(ctx) {
    // No shadowBlur. fillRect instead of arc. Minimal state changes.
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      const s = p.size * (0.5 + t * 0.5);
      if (p.smoke) {
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = '#787064';
      } else {
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = `hsl(${p.hue | 0},100%,${(50 + t * 40) | 0}%)`;
      }
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }
    ctx.globalAlpha = 1;
  }
}
```

---

## Part VIII: Audio Integration

The existing Effect → Track → Song → Scheduler architecture survives. Changes:

### Event-Driven SFX

Currently: `AudioEngine.playEat()` called directly from `moveSnake()`. Proposed: `AudioSyncSystem` listens to events.

```javascript
function audioSyncSystem(world) {
  // Registered once at init:
  world.bus.on('collectible:eaten', ({ type }) => {
    if (type === 'hellfire') SFX.eatHellfire();
    else SFX.eat();
  });
  world.bus.on('chain:tailBurned', () => SFX.burn());
  world.bus.on('collectible:expired', () => SFX.candleOut());
  world.bus.on('chain:killed', () => SFX.death());
  world.bus.on('lightning:flash', () => SFX.lightning());
  world.bus.on('entity:ignited', () => SFX.pewBurn());
  world.bus.on('collectible:stolen', () => SFX.demonSteal());

  // Corruption crossfade on change
  world.bus.on('corruption:changed', ({ value }) => {
    AudioEngine.setCorruption(value);
  });
}
```

### Declarative SFX Data

```javascript
// sfx-data.js — data, not code
const SFX_DATA = {
  eat: {
    tracks: [
      { track: 'eat', notes: [['E4', 0.06, 0.08], ['C3', 0.08, 0.06], ['G2', 0.10, 0.04]] },
      { track: 'burn', notes: [['-', 0], ['A4', 0.15, 0.04]] },
    ],
    corruptionVariant: {
      threshold: 0.4,
      tracks: [
        { track: 'eat', notes: [['A4', 0.06, 0.08], ['C3', 0.08, 0.06], ['G2', 0.10, 0.04]] },
      ],
    },
  },
  burn: {
    tracks: [{ track: 'burn', notes: [['A4', 0.08, 0.03]] }],
  },
  // ...
};
```

### Node Pooling

Pool GainNodes (the most frequently created/destroyed). Oscillators are single-use by Web Audio spec.

```javascript
class GainPool {
  constructor(ctx, size = 32) {
    this.ctx = ctx;
    this.pool = [];
    this.free = [];
    for (let i = 0; i < size; i++) {
      const g = ctx.createGain();
      this.pool.push(g);
      this.free.push(i);
    }
  }

  acquire() {
    if (this.free.length === 0) return this.ctx.createGain();
    return this.pool[this.free.pop()];
  }

  release(node) {
    node.disconnect();
    node.gain.cancelScheduledValues(0);
    node.gain.value = 0;
    const idx = this.pool.indexOf(node);
    if (idx >= 0) this.free.push(idx);
  }

  // Schedule auto-release after note ends
  releaseAt(node, time) {
    setTimeout(() => this.release(node), (time - this.ctx.currentTime) * 1000 + 100);
  }
}
```

---

## Part IX: Entity Spawning (Level Generation)

Level generation creates all initial entities. Replaces the current `Church.generate()` god function.

```javascript
function generateChurch(world, cols, rows) {
  world.grid = new SpatialGrid(cols, rows);

  // Corruption singleton
  world.spawn('corruption', { value: 0, target: 0 });
  world.spawn('lightning', { timer: 8000 + Math.random() * 12000, alpha: 0 });
  world.spawn('gameState', { score: 0, alive: true, started: false, gameTime: 0, _totalEaten: 0 });

  // Walls (perimeter) — just mark blocked in grid, no entities needed
  for (let x = 0; x < cols; x++) {
    world.grid.blocked[0 * cols + x] = 1;
    world.grid.blocked[(rows - 1) * cols + x] = 1;
  }
  // (Actually walls are implicit — out-of-bounds check)

  // Altar: 6×3 block at top center
  const altarX = Math.floor(cols / 2) - 3;
  for (let dx = 0; dx < 6; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      world.grid.blocked[dy * cols + (altarX + dx)] = 1;
    }
  }
  world.spawn(
    'position', { x: altarX, y: 0 },
    'drawable', { layer: 1, type: 'altar', zIndex: 0, visible: true },
    'collider', { solid: true, trigger: false },
  );
  // Altar entity is one "meta" entity for rendering — collision is via grid.blocked

  // Pews
  const aisleX = Math.floor(cols / 2);
  const aisleW = 2;
  for (let row = 7; row < rows - 2; row += 3) {
    const lS = 2, lE = aisleX - Math.floor(aisleW / 2) - 1;
    if (lE > lS + 1) spawnPewRow(world, lS, row, lE - lS, cols);
    const rS = aisleX + Math.ceil(aisleW / 2) + 1, rE = cols - 2;
    if (rE > rS + 1) spawnPewRow(world, rS, row, rE - rS, cols);
  }

  // Stained glass windows
  const spacing = Math.max(3, Math.floor(rows / 4));
  for (let wy = 4; wy < rows - 2; wy += spacing) {
    for (const side of [0, 1]) {
      world.spawn(
        'position',           { x: side === 0 ? 0 : cols - 1, y: wy },
        'drawable',           { layer: 1, type: 'stainedGlass', zIndex: 2, visible: true,
                                data: { side, hue: Math.random() * 360, pat: Math.floor(Math.random() * 3) } },
        'lightSource',        { radius: 5, color: [200, 180, 150], intensity: 0.04, flicker: 0 },
        'lightningReactive',  { flashMultiplier: 0.5 },
      );

      // Paired statue in nave
      const sx = side === 0 ? 1 : cols - 2;
      const onPew = world.grid.isBlocked(sx, wy, world);
      if (!onPew && wy > 3 && wy < rows - 2) {
        const statueId = world.spawn(
          'position',  { x: sx, y: wy },
          'drawable',  { layer: 1, type: 'statue', zIndex: 3, visible: true, data: { side } },
          'collider',  { solid: true, trigger: false },
          'animated',  { state: 'idle', t: 0, speed: 1, data: { crying: false, tearY: 0 } },
        );
        // Statue starts crying at corruption threshold — handled by event listener
      }
    }
  }

  // Pentagram (created dormant, animated system activates at corruption > 0.5)
  world.spawn(
    'position', { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    'drawable', { layer: 4, type: 'pentagram', zIndex: 10, visible: false },
    'animated', { state: 'dormant', t: 0, speed: 1, data: { growth: 0, angle: 0 } },
    'lightSource', { radius: 3, color: [255, 80, 0], intensity: 0, flicker: 0 },
  );

  // Snake
  spawnSnake(world, Math.floor(cols / 2), Math.floor(rows / 2), 8);

  // Initial candles
  spawnInitialCandles(world, cols, rows);
}

function spawnPewRow(world, x, y, width, cols) {
  // Each tile of the pew is a separate entity — so individual tiles can burn
  for (let dx = 0; dx < width; dx++) {
    const seed = Math.sin(dx * 31.7 + y * 17.3) * 0.5 + 0.5;
    const id = world.spawn(
      'position',  { x: x + dx, y },
      'drawable',  { layer: 1, type: 'pew', zIndex: 1, visible: true,
                     data: { seed, isEndCap: dx === 0 || dx === width - 1 } },
      'collider',  { solid: true, trigger: false },
      'flammable', { burning: false, burnT: 0, burnDuration: 3500, spreadRadius: 1 },
    );
    world.tag(id, 'pew');
  }
}

function spawnSnake(world, startX, startY, length) {
  let prevId = null;
  let headId = null;

  for (let i = 0; i < length; i++) {
    const isHead = i === 0;
    const x = startX - i, y = startY;

    const components = [
      'position',  { x, y },
      'drawable',  { layer: 2, type: isHead ? 'snakeHead' : 'snakeSegment', zIndex: 5, visible: true },
      'collider',  { solid: true, trigger: false },
      'chainLink', { headId: null, parentId: null, childId: null, index: i },
    ];

    if (isHead) {
      components.push(
        'velocity',          { dx: 1, dy: 0, interval: 110, accumulator: 0 },
        'playerControlled',  { nextDir: { x: 1, y: 0 } },
        'animated',          { state: 'phase1', t: 0, speed: 1, data: {} },
      );
    } else {
      components.push(
        'flammable', { burning: false, burnT: 0, burnDuration: 500, spreadRadius: 0 },
      );
    }

    const id = world.spawn(...components);
    world.tag(id, isHead ? 'snakeHead' : 'snakeSegment');
    world.tag(id, 'snake');

    if (isHead) headId = id;

    // Link chain
    const link = world.get(id, 'chainLink');
    link.headId = headId || id;
    if (prevId !== null) {
      link.parentId = prevId;
      world.get(prevId, 'chainLink').childId = id;
    }

    prevId = id;
  }

  return headId;
}
```

---

## Part X: Event Catalog

Complete list of events the bus carries. Any system or renderer can subscribe.

| Event | Data | Emitted By | Subscribers |
|-------|------|-----------|------------|
| `chain:moved` | `{headId, x, y}` | ChainMovementSystem | CorruptionSystem (tile corruption), EntityRenderSystem |
| `chain:blocked` | `{headId, x, y, isPlayer}` | ChainMovementSystem | If isPlayer → death handler |
| `chain:killed` | `{headId, killerId, x, y, cause}` | CollisionSystem / chain:blocked handler | GameState, AudioSync, ParticleEmitter |
| `chain:tailBurned` | `{headId, tailId, x, y}` | SpawnSystem (burn timer) | AudioSync, ParticleEmitter, Blood spawner |
| `chain:grew` | `{headId, newSegId, count}` | CollectibleSystem | HUD |
| `collectible:eaten` | `{entityId, eaterId, type, freshness, x, y}` | CollisionSystem | Score updater, CorruptionSystem, AudioSync, SpawnSystem (totalEaten counter) |
| `collectible:spawned` | `{entityId, type, x, y}` | SpawnSystem | — |
| `collectible:expired` | `{entityId, type, x, y}` | LifetimeSystem | AudioSync, ParticleEmitter |
| `collectible:stolen` | `{entityId, thiefId, x, y}` | CollisionSystem | AudioSync, Score (penalty?), ParticleEmitter |
| `hellfire:spawned` | `{x, y}` | SpawnSystem | Crack spawner, EnvironmentRender (dirty) |
| `entity:ignited` | `{id, sourceId}` | FlammableSystem | AudioSync, ParticleEmitter, EnvironmentRender (dirty) |
| `entity:burnedOut` | `{id}` | FlammableSystem | Grid (remove collider), EnvironmentRender (dirty) |
| `entity:destroyed` | `{id}` | World.destroy() | Cleanup listeners |
| `corruption:changed` | `{value, delta}` | CorruptionSystem | AudioSync, OverlayRender |
| `corruption:threshold` | `{threshold, name, value}` | CorruptionSystem | SpawnSystem (enemy waves), AnimationSystem (statue crying, pentagram activation), TileRender (dirty), EnvironmentRender (dirty), LightBeamRender (dirty) |
| `lightning:flash` | `{alpha}` | LightningSystem | AudioSync, LightBeamRender (dirty), OverlayRender |
| `grid:changed` | `{}` | FlammableSystem (collider removed) | Pathfinding caches, EnvironmentRender (dirty) |
| `blood:spawned` | `{x, y}` | Various (eat, burn, statue cry) | BloodCrackRender (dirty) |
| `input:direction` | `{dx, dy}` | InputSystem | PlayerControlled component update |
| `game:started` | `{}` | UI | All systems |
| `game:over` | `{score, corruption, cause}` | Death handler | UI overlay, AudioSync |

---

## Part XI: File Structure

```
src/
  core/
    World.js              — ECS world, component stores, queries
    EventBus.js           — Pub/sub with deferred queue
    SpatialGrid.js        — Grid-based spatial index + pathfinding grid
    ParticlePool.js       — Pre-allocated particle system

  components/
    index.js              — Component schema definitions (documentation/defaults)

  systems/
    InputSystem.js        — Keyboard + touch → playerControlled.nextDir
    ChainMovementSystem.js — Move chain heads, cascade body (snake + centipede)
    VelocitySystem.js     — Move non-chain entities (projectiles, lone enemies)
    CollisionSystem.js    — Overlap detection, eat/kill events
    CollectibleSystem.js  — Score, chain growth on eat events
    FlammableSystem.js    — Burn timers, fire spread, destruction
    LifetimeSystem.js     — Expire old entities
    CorruptionSystem.js   — Corruption state machine + thresholds
    LightningSystem.js    — Random timer, flash state
    AnimationSystem.js    — Advance animated components (statues, pentagram, blood)
    SpawnSystem.js        — Collectible + enemy spawn rules
    ShieldSystem.js       — Temporary invulnerability timers
    AISystem.js           — Snake autopilot, demon pathfind, priest patrol

  rendering/
    RenderPipeline.js     — Offscreen layer manager + compositing
    SpriteCache.js        — Pre-rendered sprite cache
    renderers/
      TileRenderer.js     — Floor tiles (corruption overlay)
      BloodCrackRenderer.js — Blood pools + floor cracks
      EnvironmentRenderer.js — Pews, altar, statues
      LightBeamRenderer.js — Stained glass + directional beams
      EntityRenderer.js   — Snake, candles, hellfire, enemies, projectiles
      OverlayRenderer.js  — Pentagram, vignette, lightning flash
    draw/
      drawCandle.js       — Single candle draw function
      drawHellfire.js     — Single hellfire draw function
      drawSnake.js        — Snake segment + head + horns + tail flame
      drawPew.js          — Pew tile (normal + burning stages)
      drawStatue.js       — Statue base + crying
      drawPentagram.js    — Fire-tracing glyph

  audio/
    AudioEngine.js        — Effect/Track/Song/Scheduler (preserved)
    GainPool.js           — Recycled GainNodes
    SFXData.js            — Declarative SFX definitions
    MusicData.js          — Hymn sequences (pure + dark)
    AudioSyncSystem.js    — Event listener → SFX/music triggers

  data/
    SnakePhases.js        — Phase thresholds, color functions, horn growth
    ChurchLayout.js       — Level generation configs
    CorruptionThresholds.js — Threshold names + values

  ui/
    HUD.js                — Segments, candles, score
    Overlay.js            — Start/game-over screen
    Input.js              — Raw event capture (feeds InputSystem)

  main.js                 — Bootstrap: create World, register systems, start loop
```

---

## Part XII: Game Loop

Replaces the current monolithic `gameLoop()`:

```javascript
// main.js
function createGame() {
  const world = new World();

  // Register systems in execution order
  // --- Input ---
  world.addSystem('input', inputSystem, 'input');

  // --- AI ---
  world.addSystem('snakeAI', snakeAISystem, 'ai');
  world.addSystem('demonAI', demonAISystem, 'ai');
  world.addSystem('priestAI', priestAISystem, 'ai');

  // --- Simulation ---
  world.addSystem('chainMovement', chainMovementSystem, 'update');
  world.addSystem('velocity', velocitySystem, 'update');
  world.addSystem('collision', collisionSystem, 'update');
  world.addSystem('collectible', collectibleSystem, 'update');
  world.addSystem('flammable', flammableSystem, 'update');
  world.addSystem('lifetime', lifetimeSystem, 'update');
  world.addSystem('corruption', corruptionSystem, 'update');
  world.addSystem('lightning', lightningSystem, 'update');
  world.addSystem('animation', animationSystem, 'update');
  world.addSystem('spawn', spawnSystem, 'update');
  world.addSystem('shield', shieldSystem, 'update');

  // --- Rendering (separate phase) ---
  world.addSystem('tileRender', tileRenderSystem, 'render');
  world.addSystem('envRender', environmentRenderSystem, 'render');
  world.addSystem('beamRender', lightBeamRenderSystem, 'render');
  world.addSystem('entityRender', entityRenderSystem, 'render');
  world.addSystem('particleRender', particleRenderSystem, 'render');
  world.addSystem('overlayRender', overlayRenderSystem, 'render');

  // --- Audio (reacts to events from simulation) ---
  audioSyncSystem(world);  // registers listeners once

  // Generate level
  generateChurch(world, COLS, ROWS);

  return world;
}

let world = null;
let lastTime = 0;

function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;

  world.time.now = ts;
  world.time.dt = dt;

  world.runPhase('input');
  world.runPhase('ai');
  world.runPhase('update');
  world.bus.flush();          // process deferred entity creation/destruction
  world.runPhase('render');

  requestAnimationFrame(gameLoop);
}

// Start
world = createGame();
requestAnimationFrame(gameLoop);
```

---

## Part XIII: Migration Path

Incremental, not big-bang. Each phase produces a working game.

### Phase 1: Foundation (no visual change)

1. Create `World.js`, `EventBus.js`, `SpatialGrid.js`
2. Create `ParticlePool.js`, replace `particles` array
3. Wire EventBus alongside existing direct calls (dual-emit during transition)
4. Extract `Input.js` from inline event listeners
5. **Test**: Game plays identically, particles don't stutter

### Phase 2: Render pipeline (performance win)

1. Create `RenderPipeline.js` with offscreen layers
2. Move `drawTiles` to static layer, dirty-flag on corruption threshold
3. Move pews/altar/statues to environment layer, dirty-flag on events
4. Move stained glass to beam layer
5. Remove per-particle `shadowBlur`, switch to `fillRect`
6. **Test**: Identical visuals, measurably smoother framerate

### Phase 3: ECS conversion (architecture win)

1. Convert pews to entities with `(Position, Drawable, Collider, Flammable)`
2. Convert candles/hellfire to entities with component sets
3. Convert statues, stained glass, altar, pentagram
4. Create `FlammableSystem`, `LifetimeSystem`, `CollisionSystem`
5. Convert snake to chain entities
6. Create `ChainMovementSystem`
7. Remove `church.js` god object — its state now lives in entities
8. **Test**: Game plays identically, code is modular

### Phase 4: Enemies (feature win)

1. Create `Demon` entity assembly + `DemonAISystem`
2. Create `Priest` entity + `PriestAISystem` + holy water projectile
3. Create `Cultist` entity + sacrifice projectile (reuses `Collectible`)
4. Hook spawn to `corruption:threshold` events
5. **Test**: New enemies interact correctly with all existing systems

### Phase 5: Polish

1. Audio `GainPool`
2. `SpriteCache` for pews, altar, candle bodies
3. Smooth snake interpolation (visual only — logic stays grid-based)
4. Screen shake via render pipeline offset
5. Post-processing layer (bloom at high corruption)
