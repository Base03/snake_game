import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { cp } from "../core/types.js";
import type {
  WallDrawable,
  AltarDrawable,
  StainedGlassDrawable,
  StatueDrawable,
} from "../rendering/drawableData.js";
import { FLOOR, WALL, ALTAR, STAINED_GLASS, STATUE } from "./tags.js";
import {
  LAYER_FLOOR,
  LAYER_STRUCTURE,
  Z_BASE,
  Z_DETAIL,
  Z_ABOVE,
} from "./layers.js";
import { WARM_LIGHT_COLOR } from "./defaults.js";

export function spawnFloorTile(world: World, x: number, y: number): EntityId {
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "tile",
      layer: LAYER_FLOOR,
      zIndex: Z_BASE,
    }),
  );
  world.tag(id, FLOOR);
  return id;
}

export interface WallOpts {
  side?: number; // 0=top, 1=right, 2=bottom, 3=left
}

export function spawnWall(
  world: World,
  x: number,
  y: number,
  opts: WallOpts = {},
): EntityId {
  const data: WallDrawable = { side: opts.side ?? 0 };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "wall",
      layer: LAYER_FLOOR,
      zIndex: Z_DETAIL,
      data,
    }),
    cp("collider", { solid: true, trigger: false }),
  );
  world.tag(id, WALL);
  return id;
}

export interface AltarOpts {
  tileW?: number;
  tileH?: number;
  corruption?: number;
}

export function spawnAltar(
  world: World,
  x: number,
  y: number,
  opts: AltarOpts = {},
): EntityId {
  const tileW = opts.tileW ?? 7;
  const tileH = opts.tileH ?? 3;
  const data: AltarDrawable = { tileW, tileH, corruption: opts.corruption ?? 0 };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "altar",
      layer: LAYER_STRUCTURE,
      zIndex: Z_BASE,
      data,
    }),
    cp("collider", {
      solid: true,
      trigger: false,
      width: tileW,
      height: tileH,
    }),
  );
  world.tag(id, ALTAR);

  // Register entity in all grid cells it occupies (position only registers top-left)
  if (world.grid) {
    for (let dy = 0; dy < tileH; dy++) {
      for (let dx = 0; dx < tileW; dx++) {
        if (dx === 0 && dy === 0) continue;
        world.grid.add(id, x + dx, y + dy);
      }
    }
  }

  return id;
}

export interface StainedGlassOpts {
  hue: number;
  side: number; // 0=left, 1=right
  corruption?: number;
}

export function spawnStainedGlass(
  world: World,
  x: number,
  y: number,
  opts: StainedGlassOpts,
): EntityId {
  const data: StainedGlassDrawable = {
    hue: opts.hue,
    corruption: opts.corruption ?? 0,
    side: opts.side,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "stainedGlass",
      layer: LAYER_STRUCTURE,
      zIndex: Z_ABOVE,
      data,
    }),
    cp("lightSource", {
      radius: 5,
      color: WARM_LIGHT_COLOR,
      intensity: 0.6,
      flicker: 0.1,
    }),
    cp("lightningReactive", { flashMultiplier: 0.5 }),
  );
  world.tag(id, STAINED_GLASS);
  return id;
}

export interface StatueOpts {
  side: number; // 0=left, 1=right
  crying?: boolean;
  corruption?: number;
}

export function spawnStatue(
  world: World,
  x: number,
  y: number,
  opts: StatueOpts,
): EntityId {
  const data: StatueDrawable = {
    side: opts.side,
    crying: opts.crying ?? false,
    corruption: opts.corruption ?? 0,
    tearY: 0,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "statue",
      layer: LAYER_STRUCTURE,
      zIndex: Z_DETAIL,
      data,
    }),
    cp("collider", { solid: true, trigger: false }),
    cp("animated", { state: "idle", t: 0, speed: 1, data: {} }),
  );
  world.tag(id, STATUE);
  return id;
}
