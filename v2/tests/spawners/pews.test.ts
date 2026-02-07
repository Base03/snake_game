import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import { spawnPew, spawnPewRow } from "@spawners/pews";
import { PEW } from "@spawners/tags";
import type { PewDrawable } from "@rendering/drawableData";
import { PEW_BURN_DURATION, DEFAULT_SPREAD_RADIUS } from "@spawners/defaults";

describe("spawnPew", () => {
  it("creates entity with position, drawable, collider, flammable", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, { dx: 0, width: 8, row: 6 });
    expect(w.get(id, "position")).toEqual({ x: 10, y: 6 });
    expect(w.get(id, "drawable")!.type).toBe("pew");
    expect(w.get(id, "collider")!.solid).toBe(true);
    expect(w.get(id, "flammable")!.burning).toBe(false);
  });

  it("tags entity as pew", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, { dx: 0, width: 8, row: 6 });
    expect(w.hasTag(id, PEW)).toBe(true);
  });

  it("stores pew data in drawable", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, { dx: 3, width: 8, row: 6 });
    const d = w.get(id, "drawable")!.data as PewDrawable;
    expect(d.dx).toBe(3);
    expect(d.width).toBe(8);
    expect(d.row).toBe(6);
  });

  it("defaults to not burning", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, { dx: 0, width: 8, row: 6 });
    expect(w.get(id, "flammable")!.burning).toBe(false);
  });

  it("can be spawned burning", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, {
      dx: 0,
      width: 8,
      row: 6,
      burning: true,
      burnT: 1500,
    });
    expect(w.get(id, "flammable")!.burning).toBe(true);
    expect(w.get(id, "flammable")!.burnT).toBe(1500);
  });

  it("accepts custom fire hue", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, {
      dx: 0,
      width: 8,
      row: 6,
      fireHue: 270,
    });
    const d = w.get(id, "drawable")!.data as PewDrawable;
    expect(d.fireHue).toBe(270);
  });

  it("flammable has correct burn duration", () => {
    const w = new World();
    const id = spawnPew(w, 10, 6, { dx: 0, width: 8, row: 6 });
    expect(w.get(id, "flammable")!.burnDuration).toBe(PEW_BURN_DURATION);
    expect(w.get(id, "flammable")!.spreadRadius).toBe(DEFAULT_SPREAD_RADIUS);
  });
});

describe("spawnPewRow", () => {
  it("spawns correct number of pew tiles", () => {
    const w = new World();
    const ids = spawnPewRow(w, { y: 6, startX: 10, width: 8 });
    expect(ids).toHaveLength(8);
  });

  it("positions tiles sequentially", () => {
    const w = new World();
    const ids = spawnPewRow(w, { y: 6, startX: 10, width: 4 });
    for (let i = 0; i < 4; i++) {
      expect(w.get(ids[i]!, "position")).toEqual({ x: 10 + i, y: 6 });
    }
  });

  it("sets correct dx index for each tile", () => {
    const w = new World();
    const ids = spawnPewRow(w, { y: 6, startX: 10, width: 4 });
    for (let i = 0; i < 4; i++) {
      expect((w.get(ids[i]!, "drawable")!.data as PewDrawable).dx).toBe(i);
    }
  });

  it("propagates burning state to all tiles", () => {
    const w = new World();
    const ids = spawnPewRow(w, {
      y: 6,
      startX: 10,
      width: 3,
      burning: true,
      burnT: 2000,
    });
    for (const id of ids) {
      expect(w.get(id, "flammable")!.burning).toBe(true);
      expect(w.get(id, "flammable")!.burnT).toBe(2000);
    }
  });

  it("all tiles tagged as pew", () => {
    const w = new World();
    const ids = spawnPewRow(w, { y: 6, startX: 10, width: 3 });
    for (const id of ids) {
      expect(w.hasTag(id, PEW)).toBe(true);
    }
  });
});
