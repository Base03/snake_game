import { World } from "./core/World.js";
import { cp, Phase } from "./core/types.js";
import { createRenderSystem } from "./systems/RenderSystem.js";
import "./rendering/renderers.js"; // registers all renderers

const GRID = 20;
const COLS = 28;
const ROWS = 21;
const W = COLS * GRID;
const H = ROWS * GRID;

// ── Canvas setup ──────────────────────────────────────────────
const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d")!;

// ── World ─────────────────────────────────────────────────────
const world = new World();
world.addSystem("render", createRenderSystem(ctx, GRID), Phase.RENDER);

// ── Spawn demo scene ──────────────────────────────────────────

// Floor tiles
for (let ty = 0; ty < ROWS; ty++) {
  for (let tx = 0; tx < COLS; tx++) {
    world.spawn(
      cp("position", { x: tx, y: ty }),
      cp("drawable", { type: "tile", layer: 0, zIndex: 0, visible: true }),
    );
  }
}

// Altar (top center, 6 wide x 3 tall — single entity at top-left of altar)
const altarX = Math.floor(COLS / 2) - 3;
world.spawn(
  cp("position", { x: altarX, y: 0 }),
  cp("drawable", {
    type: "altar",
    layer: 1,
    zIndex: 0,
    visible: true,
    data: { tileW: 6, tileH: 3, corruption: 0.2 },
  }),
);

// Pew rows (4 rows of 8-wide pews, centered)
for (const rowY of [6, 9, 12, 15]) {
  const pewX = Math.floor(COLS / 2) - 4;
  for (let dx = 0; dx < 8; dx++) {
    world.spawn(
      cp("position", { x: pewX + dx, y: rowY }),
      cp("drawable", {
        type: "pew",
        layer: 1,
        zIndex: 0,
        visible: true,
        data: { dx, width: 8, row: rowY, burning: false },
      }),
    );
  }
}

// A burning pew row
const burnY = 18;
const burnX = Math.floor(COLS / 2) - 4;
for (let dx = 0; dx < 8; dx++) {
  world.spawn(
    cp("position", { x: burnX + dx, y: burnY }),
    cp("drawable", {
      type: "pew",
      layer: 1,
      zIndex: 0,
      visible: true,
      data: { dx, width: 8, row: burnY, burning: true, burnT: 2000 },
    }),
  );
}

// Candles flanking the altar
for (const cx of [altarX - 1, altarX + 6]) {
  world.spawn(
    cp("position", { x: cx, y: 1 }),
    cp("drawable", {
      type: "candle",
      layer: 2,
      zIndex: 0,
      visible: true,
      data: { hue: 40, height: 0.8, flicker: cx * 1.7 },
    }),
  );
}

// Extra candles along the aisle
for (let i = 0; i < 4; i++) {
  const cy = 5 + i * 3;
  for (const cx of [Math.floor(COLS / 2) - 5, Math.floor(COLS / 2) + 4]) {
    world.spawn(
      cp("position", { x: cx, y: cy }),
      cp("drawable", {
        type: "candle",
        layer: 2,
        zIndex: 0,
        visible: true,
        data: { hue: 35 + i * 5, height: 0.6 + i * 0.1, flicker: cx + cy },
      }),
    );
  }
}

// Hellfire — a selection of hues
const hellfireHues = [
  { x: Math.floor(COLS / 2) - 3, y: 4, hue: 0 },   // deep red
  { x: Math.floor(COLS / 2), y: 4, hue: 15 },       // orange-red
  { x: Math.floor(COLS / 2) + 3, y: 4, hue: 40 },   // amber/yellow
  { x: 4, y: 10, hue: 270 },                         // purple
  { x: COLS - 5, y: 10, hue: 180 },                  // cyan
];
for (const hf of hellfireHues) {
  world.spawn(
    cp("position", { x: hf.x, y: hf.y }),
    cp("drawable", {
      type: "hellfire",
      layer: 2,
      zIndex: 1,
      visible: true,
      data: { hue: hf.hue, flicker: hf.x * 3.1 + hf.y * 7.3 },
    }),
  );
}

// Statues on either side
for (const [sx, side] of [
  [1, 0],
  [COLS - 2, 1],
] as const) {
  for (const sy of [3, 8, 13]) {
    world.spawn(
      cp("position", { x: sx, y: sy }),
      cp("drawable", {
        type: "statue",
        layer: 1,
        zIndex: 1,
        visible: true,
        data: { side, crying: sy === 13, corruption: 0.3, tearY: 0.7 },
      }),
    );
  }
}

// Stained glass windows
for (const [wx, side] of [
  [0, 0],
  [COLS - 1, 1],
] as const) {
  for (const wy of [5, 10, 15]) {
    world.spawn(
      cp("position", { x: wx, y: wy }),
      cp("drawable", {
        type: "stainedGlass",
        layer: 1,
        zIndex: 2,
        visible: true,
        data: { hue: wy * 30, corruption: 0.15, side },
      }),
    );
  }
}

// Cracks in the floor
for (const [cx, cy, angle, len] of [
  [5, 4, 0.3, 0.7],
  [22, 7, 1.8, 0.5],
  [14, 17, -0.5, 0.6],
] as const) {
  world.spawn(
    cp("position", { x: cx, y: cy }),
    cp("drawable", {
      type: "crack",
      layer: 0,
      zIndex: 1,
      visible: true,
      data: { angle, len, corruption: 0.4, branch: true, branchAngle: 0.6 },
    }),
  );
}

// Blood pools
for (const [bx, by, angle] of [
  [10, 14, 0.3],
  [18, 11, 1.1],
] as const) {
  world.spawn(
    cp("position", { x: bx, y: by }),
    cp("drawable", {
      type: "bloodPool",
      layer: 0,
      zIndex: 2,
      visible: true,
      data: { alpha: 0.35, radius: 0.8, angle },
    }),
  );
}

// ── Meta-pentagram formation ─────────────────────────────────
// Central purple pentagram (rotates clockwise)
const metaCx = Math.floor(COLS / 2);
const metaCy = Math.floor(ROWS / 2);
const centralPentagram = world.spawn(
  cp("position", { x: metaCx, y: metaCy }),
  cp("drawable", {
    type: "pentagram",
    layer: 3,
    zIndex: 0,
    visible: true,
    data: { radius: 2.2, growth: 0.9, corruption: 0.6, hue: 270, rotation: 0 },
  }),
);
world.tag(centralPentagram, "centralPentagram");

// 5 smaller orbiting pentagrams — each a different hue
const orbitRadius = 5.5; // in grid units
const orbitHues = [355, 40, 120, 200, 300]; // red, amber, green, cyan, magenta
const orbiters: Array<{ id: typeof centralPentagram; index: number }> = [];
for (let i = 0; i < 5; i++) {
  const angle = (i * 2 * Math.PI) / 5;
  const ox = metaCx + Math.cos(angle) * orbitRadius;
  const oy = metaCy + Math.sin(angle) * orbitRadius;
  const id = world.spawn(
    cp("position", { x: ox, y: oy }),
    cp("drawable", {
      type: "pentagram",
      layer: 3,
      zIndex: 0,
      visible: true,
      data: {
        radius: 1.1, growth: 0.85, corruption: 0.5,
        hue: orbitHues[i], rotation: 0,
      },
    }),
  );
  world.tag(id, "orbiter");
  orbiters.push({ id, index: i });
}

// Orbit system: spins central pentagram CW, orbits ring CCW,
// outer pentagrams maintain zero rotation relative to camera
world.addSystem("orbit", (w) => {
  const now = w.time.now;
  const cwAngle = now * 0.0004;   // central: clockwise
  const ccwAngle = -now * 0.0003; // ring: counter-clockwise

  // Rotate central pentagram
  const centralDraw = w.get(centralPentagram, "drawable");
  if (centralDraw?.data) {
    centralDraw.data["rotation"] = cwAngle;
  }

  // Orbit outer pentagrams
  for (const orb of orbiters) {
    const baseAngle = (orb.index * 2 * Math.PI) / 5 + ccwAngle;
    const pos = w.get(orb.id, "position");
    if (pos) {
      pos.x = metaCx + Math.cos(baseAngle) * orbitRadius;
      pos.y = metaCy + Math.sin(baseAngle) * orbitRadius;
    }
    // Zero rotation relative to camera
    const draw = w.get(orb.id, "drawable");
    if (draw?.data) {
      draw.data["rotation"] = 0;
    }
  }
}, Phase.UPDATE);

// Snake — head + segments
const snakeStartX = Math.floor(COLS / 2);
const snakeStartY = ROWS - 2;
world.spawn(
  cp("position", { x: snakeStartX, y: snakeStartY }),
  cp("velocity", { dx: 0, dy: -1, interval: 150, accumulator: 0 }),
  cp("drawable", {
    type: "snakeHead",
    layer: 2,
    zIndex: 10,
    visible: true,
    data: { color: "hsl(115,70%,38%)", eyeColor: "#1a0a0a" },
  }),
);
for (let i = 1; i <= 4; i++) {
  const t = i / 5;
  world.spawn(
    cp("position", { x: snakeStartX, y: snakeStartY + i }),
    cp("drawable", {
      type: "snakeSegment",
      layer: 2,
      zIndex: 9,
      visible: true,
      data: { color: `hsl(120,${55 - t * 10}%,${32 - t * 8}%)` },
    }),
  );
}

// ── Game loop ─────────────────────────────────────────────────
let last = 0;
function loop(ts: number) {
  const dt = last ? (ts - last) / 1000 : 0;
  last = ts;
  world.time.now = ts;
  world.time.dt = dt;
  world.time.gameTime += dt;

  world.runPhase(Phase.UPDATE);
  world.runPhase(Phase.RENDER);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
