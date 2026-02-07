import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import { spawnBloodPool, spawnCrack, spawnPentagram } from "@spawners/effects";
import { BLOOD_POOL, CRACK, PENTAGRAM } from "@spawners/tags";
import type {
  BloodPoolDrawable,
  CrackDrawable,
  PentagramDrawable,
} from "@rendering/drawableData";

describe("spawnBloodPool", () => {
  it("creates entity with position and drawable", () => {
    const w = new World();
    const id = spawnBloodPool(w, 10, 14);
    expect(w.get(id, "position")).toEqual({ x: 10, y: 14 });
    expect(w.get(id, "drawable")!.type).toBe("bloodPool");
  });

  it("tags entity as bloodPool", () => {
    const w = new World();
    const id = spawnBloodPool(w, 10, 14);
    expect(w.hasTag(id, BLOOD_POOL)).toBe(true);
  });

  it("defaults alpha, radius, angle", () => {
    const w = new World();
    const id = spawnBloodPool(w, 10, 14);
    const d = w.get(id, "drawable")!.data as BloodPoolDrawable;
    expect(d.alpha).toBe(0.35);
    expect(d.radius).toBe(0.8);
    expect(d.angle).toBe(0);
  });

  it("accepts custom values", () => {
    const w = new World();
    const id = spawnBloodPool(w, 10, 14, {
      alpha: 0.5,
      radius: 1.2,
      angle: 0.7,
    });
    const d = w.get(id, "drawable")!.data as BloodPoolDrawable;
    expect(d.alpha).toBe(0.5);
    expect(d.radius).toBe(1.2);
    expect(d.angle).toBe(0.7);
  });

  it("has no collider", () => {
    const w = new World();
    const id = spawnBloodPool(w, 10, 14);
    expect(w.has(id, "collider")).toBe(false);
  });
});

describe("spawnCrack", () => {
  it("creates entity with position and drawable", () => {
    const w = new World();
    const id = spawnCrack(w, 5, 4, { angle: 0.3, len: 0.7 });
    expect(w.get(id, "position")).toEqual({ x: 5, y: 4 });
    expect(w.get(id, "drawable")!.type).toBe("crack");
  });

  it("tags entity as crack", () => {
    const w = new World();
    const id = spawnCrack(w, 5, 4, { angle: 0.3, len: 0.7 });
    expect(w.hasTag(id, CRACK)).toBe(true);
  });

  it("stores angle and len in drawable data", () => {
    const w = new World();
    const id = spawnCrack(w, 5, 4, { angle: 1.5, len: 0.9 });
    const d = w.get(id, "drawable")!.data as CrackDrawable;
    expect(d.angle).toBe(1.5);
    expect(d.len).toBe(0.9);
  });

  it("defaults corruption to 0 and branch to false", () => {
    const w = new World();
    const id = spawnCrack(w, 5, 4, { angle: 0.3, len: 0.7 });
    const d = w.get(id, "drawable")!.data as CrackDrawable;
    expect(d.corruption).toBe(0);
    expect(d.branch).toBe(false);
  });

  it("supports branching cracks", () => {
    const w = new World();
    const id = spawnCrack(w, 5, 4, {
      angle: 0.3,
      len: 0.7,
      branch: true,
      branchAngle: 0.6,
    });
    const d = w.get(id, "drawable")!.data as CrackDrawable;
    expect(d.branch).toBe(true);
    expect(d.branchAngle).toBe(0.6);
  });
});

describe("spawnPentagram", () => {
  it("creates entity with position, drawable, animated, lightSource", () => {
    const w = new World();
    const id = spawnPentagram(w, 14, 10);
    expect(w.get(id, "position")).toEqual({ x: 14, y: 10 });
    expect(w.get(id, "drawable")!.type).toBe("pentagram");
    expect(w.get(id, "animated")!.state).toBe("idle");
    expect(w.has(id, "lightSource")).toBe(true);
  });

  it("tags entity as pentagram", () => {
    const w = new World();
    const id = spawnPentagram(w, 14, 10);
    expect(w.hasTag(id, PENTAGRAM)).toBe(true);
  });

  it("defaults growth to 0 (grows via system)", () => {
    const w = new World();
    const id = spawnPentagram(w, 14, 10);
    expect((w.get(id, "drawable")!.data as PentagramDrawable).growth).toBe(0);
  });

  it("accepts custom hue and radius", () => {
    const w = new World();
    const id = spawnPentagram(w, 14, 10, { hue: 270, radius: 5 });
    const d = w.get(id, "drawable")!.data as PentagramDrawable;
    expect(d.hue).toBe(270);
    expect(d.radius).toBe(5);
  });

  it("defaults hue to 355 (red)", () => {
    const w = new World();
    const id = spawnPentagram(w, 14, 10);
    expect((w.get(id, "drawable")!.data as PentagramDrawable).hue).toBe(355);
  });

  it("has no collider", () => {
    const w = new World();
    const id = spawnPentagram(w, 14, 10);
    expect(w.has(id, "collider")).toBe(false);
  });
});
