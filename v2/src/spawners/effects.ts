import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { cp } from "../core/types.js";
import type {
  BloodPoolDrawable,
  CrackDrawable,
  PentagramDrawable,
} from "../rendering/drawableData.js";
import { BLOOD_POOL, CRACK, PENTAGRAM } from "./tags.js";
import {
  LAYER_FLOOR,
  LAYER_OVERLAY,
  Z_DETAIL,
  Z_ABOVE,
  Z_BASE,
} from "./layers.js";

export interface BloodPoolOpts {
  alpha?: number;
  radius?: number;
  angle?: number;
}

export function spawnBloodPool(
  world: World,
  x: number,
  y: number,
  opts: BloodPoolOpts = {},
): EntityId {
  const data: BloodPoolDrawable = {
    alpha: opts.alpha ?? 0.35,
    radius: opts.radius ?? 0.8,
    angle: opts.angle ?? 0,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "bloodPool",
      layer: LAYER_FLOOR,
      zIndex: Z_ABOVE,
      data,
    }),
  );
  world.tag(id, BLOOD_POOL);
  return id;
}

export interface CrackOpts {
  angle: number;
  len: number;
  corruption?: number;
  branch?: boolean;
  branchAngle?: number;
}

export function spawnCrack(
  world: World,
  x: number,
  y: number,
  opts: CrackOpts,
): EntityId {
  const data: CrackDrawable = {
    angle: opts.angle,
    len: opts.len,
    corruption: opts.corruption ?? 0,
    branch: opts.branch ?? false,
    branchAngle: opts.branchAngle ?? 0,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "crack",
      layer: LAYER_FLOOR,
      zIndex: Z_DETAIL,
      data,
    }),
  );
  world.tag(id, CRACK);
  return id;
}

export interface PentagramOpts {
  radius?: number;
  growth?: number;
  corruption?: number;
  hue?: number;
  rotation?: number;
}

export function spawnPentagram(
  world: World,
  x: number,
  y: number,
  opts: PentagramOpts = {},
): EntityId {
  const data: PentagramDrawable = {
    radius: opts.radius ?? 3,
    growth: opts.growth ?? 0,
    corruption: opts.corruption ?? 0,
    hue: opts.hue ?? 355,
    rotation: opts.rotation ?? 0,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "pentagram",
      layer: LAYER_OVERLAY,
      zIndex: Z_BASE,
      data,
    }),
    cp("animated", { state: "idle", t: 0, speed: 1, data: {} }),
    cp("lightSource", {
      radius: 6,
      color: [200, 50, 50],
      intensity: 0.4,
      flicker: 0.15,
    }),
  );
  world.tag(id, PENTAGRAM);
  return id;
}
