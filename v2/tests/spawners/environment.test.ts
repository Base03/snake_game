import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import { SpatialGrid } from "@core/SpatialGrid";
import {
  spawnFloorTile,
  spawnWall,
  spawnAltar,
  spawnStainedGlass,
  spawnStatue,
} from "@spawners/environment";
import { FLOOR, WALL, ALTAR, STAINED_GLASS, STATUE } from "@spawners/tags";
import type {
  WallDrawable,
  AltarDrawable,
  StainedGlassDrawable,
  StatueDrawable,
} from "@rendering/drawableData";

describe("spawnFloorTile", () => {
  it("creates entity with position and drawable", () => {
    const w = new World();
    const id = spawnFloorTile(w, 5, 3);
    expect(w.get(id, "position")).toEqual({ x: 5, y: 3 });
    const d = w.get(id, "drawable")!;
    expect(d.type).toBe("tile");
    expect(d.layer).toBe(0);
  });

  it("tags entity as floor", () => {
    const w = new World();
    const id = spawnFloorTile(w, 0, 0);
    expect(w.hasTag(id, FLOOR)).toBe(true);
  });

  it("has no collider", () => {
    const w = new World();
    const id = spawnFloorTile(w, 0, 0);
    expect(w.has(id, "collider")).toBe(false);
  });
});

describe("spawnWall", () => {
  it("creates entity with position, drawable, and collider", () => {
    const w = new World();
    const id = spawnWall(w, 0, 0, { side: 3 });
    expect(w.get(id, "position")).toEqual({ x: 0, y: 0 });
    expect(w.get(id, "drawable")!.type).toBe("wall");
    expect(w.get(id, "collider")!.solid).toBe(true);
  });

  it("tags entity as wall", () => {
    const w = new World();
    const id = spawnWall(w, 0, 0);
    expect(w.hasTag(id, WALL)).toBe(true);
  });

  it("stores side in drawable data", () => {
    const w = new World();
    const id = spawnWall(w, 0, 0, { side: 2 });
    expect((w.get(id, "drawable")!.data as WallDrawable).side).toBe(2);
  });

  it("defaults side to 0", () => {
    const w = new World();
    const id = spawnWall(w, 0, 0);
    expect((w.get(id, "drawable")!.data as WallDrawable).side).toBe(0);
  });

  it("collider is solid and not a trigger", () => {
    const w = new World();
    const id = spawnWall(w, 0, 0);
    const c = w.get(id, "collider")!;
    expect(c.solid).toBe(true);
    expect(c.trigger).toBe(false);
  });
});

describe("spawnAltar", () => {
  it("creates entity at anchor position", () => {
    const w = new World();
    const id = spawnAltar(w, 8, 0);
    expect(w.get(id, "position")).toEqual({ x: 8, y: 0 });
  });

  it("has multi-tile collider matching dimensions", () => {
    const w = new World();
    const id = spawnAltar(w, 8, 0, { tileW: 6, tileH: 3 });
    const c = w.get(id, "collider")!;
    expect(c.solid).toBe(true);
    expect(c.width).toBe(6);
    expect(c.height).toBe(3);
  });

  it("defaults to 7x3 tile dimensions", () => {
    const w = new World();
    const id = spawnAltar(w, 0, 0);
    const d = w.get(id, "drawable")!.data as AltarDrawable;
    expect(d.tileW).toBe(7);
    expect(d.tileH).toBe(3);
    const c = w.get(id, "collider")!;
    expect(c.width).toBe(7);
    expect(c.height).toBe(3);
  });

  it("tags entity as altar", () => {
    const w = new World();
    const id = spawnAltar(w, 0, 0);
    expect(w.hasTag(id, ALTAR)).toBe(true);
  });

  it("stores corruption in drawable data", () => {
    const w = new World();
    const id = spawnAltar(w, 0, 0, { corruption: 0.5 });
    expect((w.get(id, "drawable")!.data as AltarDrawable).corruption).toBe(0.5);
  });

  it("defaults corruption to 0", () => {
    const w = new World();
    const id = spawnAltar(w, 0, 0);
    expect((w.get(id, "drawable")!.data as AltarDrawable).corruption).toBe(0);
  });

  it("registers in all grid cells it occupies", () => {
    const w = new World();
    w.grid = new SpatialGrid(20, 10);
    const id = spawnAltar(w, 5, 1, { tileW: 3, tileH: 2 });
    // Should be registered in all 6 cells: (5,1), (6,1), (7,1), (5,2), (6,2), (7,2)
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(w.grid.at(5 + dx, 1 + dy)).toContain(id);
      }
    }
  });

  it("blocks snake at all occupied cells", () => {
    const w = new World();
    w.grid = new SpatialGrid(20, 10);
    const id = spawnAltar(w, 5, 1, { tileW: 3, tileH: 2 });
    // All cells should be blocked
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(w.grid.isBlocked(5 + dx, 1 + dy, w)).toBe(true);
      }
    }
    // Adjacent cells should not be blocked by the altar
    expect(w.grid.isBlocked(4, 1, w)).toBe(false);
    expect(w.grid.isBlocked(8, 1, w)).toBe(false);
  });
});

describe("spawnStainedGlass", () => {
  it("creates entity with drawable, lightSource, and lightningReactive", () => {
    const w = new World();
    const id = spawnStainedGlass(w, 0, 5, { hue: 200, side: 0 });
    expect(w.get(id, "position")).toEqual({ x: 0, y: 5 });
    expect(w.get(id, "drawable")!.type).toBe("stainedGlass");
    expect(w.has(id, "lightSource")).toBe(true);
    expect(w.has(id, "lightningReactive")).toBe(true);
  });

  it("has no collider", () => {
    const w = new World();
    const id = spawnStainedGlass(w, 0, 5, { hue: 200, side: 0 });
    expect(w.has(id, "collider")).toBe(false);
  });

  it("tags entity as stainedGlass", () => {
    const w = new World();
    const id = spawnStainedGlass(w, 0, 5, { hue: 200, side: 0 });
    expect(w.hasTag(id, STAINED_GLASS)).toBe(true);
  });

  it("stores hue and side in drawable data", () => {
    const w = new World();
    const id = spawnStainedGlass(w, 0, 5, { hue: 120, side: 1 });
    const d = w.get(id, "drawable")!.data as StainedGlassDrawable;
    expect(d.hue).toBe(120);
    expect(d.side).toBe(1);
  });

  it("defaults corruption to 0", () => {
    const w = new World();
    const id = spawnStainedGlass(w, 0, 5, { hue: 200, side: 0 });
    expect((w.get(id, "drawable")!.data as StainedGlassDrawable).corruption).toBe(0);
  });
});

describe("spawnStatue", () => {
  it("creates entity with drawable, collider, and animated", () => {
    const w = new World();
    const id = spawnStatue(w, 1, 3, { side: 0 });
    expect(w.get(id, "position")).toEqual({ x: 1, y: 3 });
    expect(w.get(id, "drawable")!.type).toBe("statue");
    expect(w.get(id, "collider")!.solid).toBe(true);
    expect(w.get(id, "animated")!.state).toBe("idle");
  });

  it("tags entity as statue", () => {
    const w = new World();
    const id = spawnStatue(w, 1, 3, { side: 0 });
    expect(w.hasTag(id, STATUE)).toBe(true);
  });

  it("stores side, crying, corruption in drawable data", () => {
    const w = new World();
    const id = spawnStatue(w, 1, 3, { side: 1, crying: true, corruption: 0.7 });
    const d = w.get(id, "drawable")!.data as StatueDrawable;
    expect(d.side).toBe(1);
    expect(d.crying).toBe(true);
    expect(d.corruption).toBe(0.7);
  });

  it("defaults crying to false and corruption to 0", () => {
    const w = new World();
    const id = spawnStatue(w, 1, 3, { side: 0 });
    const d = w.get(id, "drawable")!.data as StatueDrawable;
    expect(d.crying).toBe(false);
    expect(d.corruption).toBe(0);
  });
});
