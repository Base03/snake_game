import { World } from "./core/World.js";
import { SpatialGrid } from "./core/SpatialGrid.js";
import { Phase } from "./core/types.js";
import { createRenderSystem } from "./systems/RenderSystem.js";
import { createInputSystem } from "./systems/InputSystem.js";
import { createMovementSystem } from "./systems/MovementSystem.js";
import { setupCollectibleListeners } from "./systems/CollectibleSystem.js";
import "./rendering/renderers.js"; // registers all renderers
import { generateChurch } from "./data/ChurchLayout.js";
import { spawnSnake } from "./spawners/snake.js";

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

// ── World + SpatialGrid ──────────────────────────────────────
const world = new World();
world.grid = new SpatialGrid(COLS, ROWS);

// ── Systems ──────────────────────────────────────────────────
const input = createInputSystem(window);
world.addSystem("input", input.system, Phase.INPUT);
world.addSystem("movement", createMovementSystem(), Phase.UPDATE);
world.addSystem("render", createRenderSystem(ctx, GRID), Phase.RENDER);

// ── Generate church layout ────────────────────────────────────
generateChurch(world, { cols: COLS, rows: ROWS });

// ── Spawn snake at center ─────────────────────────────────────
spawnSnake(world, Math.floor(COLS / 2), Math.floor(ROWS / 2), 8);

// ── Event listeners ──────────────────────────────────────────
setupCollectibleListeners(world);

// ── Game loop ─────────────────────────────────────────────────
let last = 0;
function loop(ts: number) {
  const dt = last ? (ts - last) / 1000 : 0;
  last = ts;
  world.time.now = ts;
  world.time.dt = dt;
  world.time.gameTime += dt;

  world.runPhase(Phase.INPUT);
  world.runPhase(Phase.UPDATE);
  world.runPhase(Phase.RENDER);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
