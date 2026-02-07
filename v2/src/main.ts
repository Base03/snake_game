import { World } from "./core/World.js";
import { Phase } from "./core/types.js";
import { createRenderSystem } from "./systems/RenderSystem.js";
import "./rendering/renderers.js"; // registers all renderers
import { generateChurch } from "./data/ChurchLayout.js";
import { spawnPentagram } from "./spawners/effects.js";

const GRID = 20;
const COLS = 31; // odd so center tile is exact
const ROWS = 25;
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

// ── Generate church layout ────────────────────────────────────
generateChurch(world, { cols: COLS, rows: ROWS });

// ── Demo pentagram (centered exactly) ─────────────────────────
spawnPentagram(world, Math.floor(COLS / 2), Math.floor(ROWS / 2), {
  radius: 2.2,
  growth: 0.9,
  corruption: 0.6,
  hue: 270,
});

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
