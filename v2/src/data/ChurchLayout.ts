import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import type { LevelEntities } from "./LevelTypes.js";
import {
  spawnFloorTile,
  spawnWall,
  spawnAltar,
  spawnStainedGlass,
  spawnStatue,
} from "../spawners/environment.js";
import { spawnPewRow } from "../spawners/pews.js";
import { spawnCandle } from "../spawners/collectibles.js";
import { spawnPentagram } from "../spawners/effects.js";
import { spawnSingletons } from "../spawners/singletons.js";

export interface ChurchConfig {
  cols: number;
  rows: number;
}

export interface ChurchEntities extends LevelEntities {
  altar: EntityId;
  pews: EntityId[];
  windows: EntityId[];
  statues: EntityId[];
}

export function generateChurch(
  world: World,
  config: ChurchConfig,
): ChurchEntities {
  const { cols, rows } = config;
  const center = Math.floor(cols / 2); // exact center tile (odd cols)

  // ── Floor tiles ────────────────────────────────────────────
  const floors: EntityId[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      floors.push(spawnFloorTile(world, x, y));
    }
  }

  // ── Walls on all 4 boundaries ──────────────────────────────
  const walls: EntityId[] = [];
  for (let x = 0; x < cols; x++) {
    walls.push(spawnWall(world, x, 0, { side: 0 })); // top
    walls.push(spawnWall(world, x, rows - 1, { side: 2 })); // bottom
  }
  for (let y = 1; y < rows - 1; y++) {
    walls.push(spawnWall(world, 0, y, { side: 3 })); // left
    walls.push(spawnWall(world, cols - 1, y, { side: 1 })); // right
  }

  // ── Altar (top-center, 7×3, symmetric around center) ───────
  const altarX = center - 3;
  const altar = spawnAltar(world, altarX, 0);

  // ── Pentagram (center of room) ─────────────────────────────
  spawnPentagram(world, center, Math.floor(rows / 2), { radius: 3, growth: 1 });

  // ── 4-column pew layout ────────────────────────────────────
  // Pattern: w--ppppp-ppppp---ppppp-ppppp--w
  // center aisle = 3, side aisles = 1, margin = 3 (wall + 2 free)
  const pews: EntityId[] = [];
  const centerAisle = 3;
  const sideAisle = 1;
  const margin = 3;

  // Space per half (from margin to center aisle edge)
  const halfSpace = center - Math.floor(centerAisle / 2) - margin;
  const pewWidth = Math.floor((halfSpace - sideAisle) / 2);

  const leftOuter = margin;
  const leftInner = margin + pewWidth + sideAisle;
  const rightInner = center + Math.floor(centerAisle / 2) + 1;
  const rightOuter = rightInner + pewWidth + sideAisle;

  const pewColumns = [
    { startX: leftOuter, width: pewWidth },
    { startX: leftInner, width: pewWidth },
    { startX: rightInner, width: pewWidth },
    { startX: rightOuter, width: pewWidth },
  ];

  for (let row = 7; row < rows - 2; row += 3) {
    for (const col of pewColumns) {
      if (col.width > 0) {
        pews.push(
          ...spawnPewRow(world, {
            y: row,
            startX: col.startX,
            width: col.width,
          }),
        );
      }
    }
  }

  // ── Stained glass windows ──────────────────────────────────
  const windows: EntityId[] = [];
  const windowSpacing = Math.max(3, Math.floor(rows / 4));
  for (let wy = 4; wy < rows - 2; wy += windowSpacing) {
    windows.push(spawnStainedGlass(world, 0, wy, { hue: wy * 30, side: 0 }));
    windows.push(
      spawnStainedGlass(world, cols - 1, wy, { hue: wy * 30 + 180, side: 1 }),
    );
  }

  // ── Statues (above and below each stained glass window) ────
  const statues: EntityId[] = [];
  const windowYSet = new Set<number>();
  for (let wy = 4; wy < rows - 2; wy += windowSpacing) {
    windowYSet.add(wy);
  }

  for (const wy of windowYSet) {
    for (const sy of [wy - 2, wy + 1]) {
      if (sy >= 1 && sy < rows - 1 && !windowYSet.has(sy)) {
        statues.push(spawnStatue(world, 1, sy, { side: 0 }));
        statues.push(spawnStatue(world, cols - 2, sy, { side: 1 }));
      }
    }
  }

  // ── Test candles (center aisle) ─────────────────────────────
  // Placeholder until a proper SpawnerSystem exists.
  for (let cy = 8; cy < rows - 2; cy += 5) {
    spawnCandle(world, center, cy);
  }

  // ── Singletons ─────────────────────────────────────────────
  const singletons = spawnSingletons(world);

  return { floors, walls, altar, pews, windows, statues, singletons };
}
