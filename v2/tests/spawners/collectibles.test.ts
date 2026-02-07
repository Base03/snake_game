import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import { spawnCandle, spawnHellfire } from "@spawners/collectibles";
import { CANDLE, HELLFIRE, COLLECTIBLE } from "@spawners/tags";
import type { CandleDrawable, HellfireDrawable } from "@rendering/drawableData";
import {
  COLLECTIBLE_LIFETIME,
  CANDLE_BASE_SCORE,
  CANDLE_DEFAULT_HUE,
  HELLFIRE_BASE_SCORE,
  HELLFIRE_DEFAULT_HUE,
} from "@spawners/defaults";

describe("spawnCandle", () => {
  it("creates entity with position, drawable, collectible, lifetime, lightSource", () => {
    const w = new World();
    const id = spawnCandle(w, 5, 3);
    expect(w.get(id, "position")).toEqual({ x: 5, y: 3 });
    expect(w.get(id, "drawable")!.type).toBe("candle");
    expect(w.get(id, "collectible")!.type).toBe("candle");
    expect(w.get(id, "collectible")!.baseScore).toBe(CANDLE_BASE_SCORE);
    expect(w.has(id, "lifetime")).toBe(true);
    expect(w.has(id, "lightSource")).toBe(true);
  });

  it("tags entity as candle and collectible", () => {
    const w = new World();
    const id = spawnCandle(w, 5, 3);
    expect(w.hasTag(id, CANDLE)).toBe(true);
    expect(w.hasTag(id, COLLECTIBLE)).toBe(true);
  });

  it("has no collider", () => {
    const w = new World();
    const id = spawnCandle(w, 5, 3);
    expect(w.has(id, "collider")).toBe(false);
  });

  it("lifetime birth matches world.time.now", () => {
    const w = new World();
    w.time.now = 5000;
    const id = spawnCandle(w, 5, 3);
    expect(w.get(id, "lifetime")!.birth).toBe(5000);
    expect(w.get(id, "lifetime")!.duration).toBe(COLLECTIBLE_LIFETIME);
  });

  it("accepts custom hue and height", () => {
    const w = new World();
    const id = spawnCandle(w, 5, 3, { hue: 60, height: 0.5 });
    const d = w.get(id, "drawable")!.data as CandleDrawable;
    expect(d.hue).toBe(60);
    expect(d.height).toBe(0.5);
  });

  it("defaults hue to 40 and height to 0.8", () => {
    const w = new World();
    const id = spawnCandle(w, 5, 3);
    const d = w.get(id, "drawable")!.data as CandleDrawable;
    expect(d.hue).toBe(CANDLE_DEFAULT_HUE);
    expect(d.height).toBe(0.8);
  });
});

describe("spawnHellfire", () => {
  it("creates entity with position, drawable, collectible, lifetime, lightSource, flammable", () => {
    const w = new World();
    const id = spawnHellfire(w, 10, 4);
    expect(w.get(id, "position")).toEqual({ x: 10, y: 4 });
    expect(w.get(id, "drawable")!.type).toBe("hellfire");
    expect(w.get(id, "collectible")!.type).toBe("hellfire");
    expect(w.get(id, "collectible")!.baseScore).toBe(HELLFIRE_BASE_SCORE);
    expect(w.get(id, "collectible")!.segments).toBe(2);
    expect(w.has(id, "lifetime")).toBe(true);
    expect(w.has(id, "lightSource")).toBe(true);
    expect(w.has(id, "flammable")).toBe(true);
  });

  it("tags entity as hellfire and collectible", () => {
    const w = new World();
    const id = spawnHellfire(w, 10, 4);
    expect(w.hasTag(id, HELLFIRE)).toBe(true);
    expect(w.hasTag(id, COLLECTIBLE)).toBe(true);
  });

  it("flammable starts burning", () => {
    const w = new World();
    const id = spawnHellfire(w, 10, 4);
    expect(w.get(id, "flammable")!.burning).toBe(true);
  });

  it("accepts custom hue", () => {
    const w = new World();
    const id = spawnHellfire(w, 10, 4, { hue: 270 });
    expect((w.get(id, "drawable")!.data as HellfireDrawable).hue).toBe(270);
  });

  it("defaults hue to 15", () => {
    const w = new World();
    const id = spawnHellfire(w, 10, 4);
    expect((w.get(id, "drawable")!.data as HellfireDrawable).hue).toBe(HELLFIRE_DEFAULT_HUE);
  });

  it("lightSource has larger radius than candle", () => {
    const w = new World();
    const id = spawnHellfire(w, 10, 4);
    expect(w.get(id, "lightSource")!.radius).toBe(4);
  });
});
