import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { cp } from "../core/types.js";
import type { PewDrawable } from "../rendering/drawableData.js";
import { PEW } from "./tags.js";
import { LAYER_STRUCTURE, Z_BASE } from "./layers.js";
import { PEW_BURN_DURATION, PEW_DEFAULT_FIRE_HUE, DEFAULT_SPREAD_RADIUS } from "./defaults.js";

export interface PewOpts {
  dx: number; // tile index within the row (0-based)
  width: number; // total row width in tiles
  row: number; // row y-coordinate (for seed variation)
  burning?: boolean;
  burnT?: number;
  fireHue?: number;
}

export function spawnPew(
  world: World,
  x: number,
  y: number,
  opts: PewOpts,
): EntityId {
  const burning = opts.burning ?? false;
  const data: PewDrawable = {
    dx: opts.dx,
    width: opts.width,
    row: opts.row,
    fireHue: opts.fireHue ?? PEW_DEFAULT_FIRE_HUE,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "pew",
      layer: LAYER_STRUCTURE,
      zIndex: Z_BASE,
      data,
    }),
    cp("collider", { solid: true, trigger: false }),
    cp("flammable", {
      burning,
      burnT: opts.burnT ?? 0,
      burnDuration: PEW_BURN_DURATION,
      spreadRadius: DEFAULT_SPREAD_RADIUS,
    }),
  );
  world.tag(id, PEW);
  return id;
}

export interface PewRowOpts {
  y: number;
  startX: number;
  width: number;
  burning?: boolean;
  burnT?: number;
  fireHue?: number;
}

export function spawnPewRow(world: World, opts: PewRowOpts): EntityId[] {
  const ids: EntityId[] = [];
  for (let dx = 0; dx < opts.width; dx++) {
    ids.push(
      spawnPew(world, opts.startX + dx, opts.y, {
        dx,
        width: opts.width,
        row: opts.y,
        burning: opts.burning,
        burnT: opts.burnT,
        fireHue: opts.fireHue,
      }),
    );
  }
  return ids;
}
