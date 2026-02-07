import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { cp } from "../core/types.js";
import type { CandleDrawable, HellfireDrawable } from "../rendering/drawableData.js";
import { CANDLE, HELLFIRE, COLLECTIBLE } from "./tags.js";
import { LAYER_ENTITY, Z_BASE } from "./layers.js";
import {
  COLLECTIBLE_LIFETIME,
  CANDLE_BASE_SCORE,
  CANDLE_SEGMENTS,
  CANDLE_DEFAULT_HUE,
  HELLFIRE_BASE_SCORE,
  HELLFIRE_SEGMENTS,
  HELLFIRE_DEFAULT_HUE,
  WARM_LIGHT_COLOR,
  HELLFIRE_LIGHT_COLOR,
  DEFAULT_SPREAD_RADIUS,
} from "./defaults.js";

export interface CandleOpts {
  hue?: number;
  height?: number;
  flicker?: number;
}

export function spawnCandle(
  world: World,
  x: number,
  y: number,
  opts: CandleOpts = {},
): EntityId {
  const data: CandleDrawable = {
    hue: opts.hue ?? CANDLE_DEFAULT_HUE,
    height: opts.height ?? 0.8,
    flicker: opts.flicker ?? x * 1.7 + y * 3.1,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "candle",
      layer: LAYER_ENTITY,
      zIndex: Z_BASE,
      data,
    }),
    cp("collectible", { type: "candle", baseScore: CANDLE_BASE_SCORE, segments: CANDLE_SEGMENTS }),
    cp("lifetime", {
      birth: world.time.now,
      duration: COLLECTIBLE_LIFETIME,
      freshness: 1,
    }),
    cp("lightSource", {
      radius: 3,
      color: WARM_LIGHT_COLOR,
      intensity: 0.5,
      flicker: 0.2,
    }),
  );
  world.tag(id, CANDLE, COLLECTIBLE);
  return id;
}

export interface HellfireOpts {
  hue?: number;
  flicker?: number;
}

export function spawnHellfire(
  world: World,
  x: number,
  y: number,
  opts: HellfireOpts = {},
): EntityId {
  const data: HellfireDrawable = {
    hue: opts.hue ?? HELLFIRE_DEFAULT_HUE,
    flicker: opts.flicker ?? x * 3.1 + y * 7.3,
  };
  const id = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "hellfire",
      layer: LAYER_ENTITY,
      zIndex: Z_BASE,
      data,
    }),
    cp("collectible", { type: "hellfire", baseScore: HELLFIRE_BASE_SCORE, segments: HELLFIRE_SEGMENTS }),
    cp("lifetime", {
      birth: world.time.now,
      duration: COLLECTIBLE_LIFETIME,
      freshness: 1,
    }),
    cp("lightSource", {
      radius: 4,
      color: HELLFIRE_LIGHT_COLOR,
      intensity: 0.7,
      flicker: 0.3,
    }),
    cp("flammable", {
      burning: true,
      burnT: 0,
      burnDuration: COLLECTIBLE_LIFETIME,
      spreadRadius: DEFAULT_SPREAD_RADIUS,
    }),
  );
  world.tag(id, HELLFIRE, COLLECTIBLE);
  return id;
}
