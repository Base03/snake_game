import { describe, it, expect } from "vitest";
import { SpatialGrid } from "@core/SpatialGrid";
import type { EntityId, ComponentReader } from "@core/types";

const id = (n: number) => n as EntityId;

function mockReader(solidIds: Set<EntityId> = new Set()): ComponentReader {
  return {
    get: ((eid: EntityId, key: string) => {
      if (key === "collider" && solidIds.has(eid))
        return { solid: true, trigger: false };
      return undefined;
    }) as ComponentReader["get"],
    has: (eid, key) => key === "collider" && solidIds.has(eid),
  };
}

describe("SpatialGrid", () => {
  it("creates correct number of cells", () => {
    const grid = new SpatialGrid(10, 8);
    expect(grid.cells).toHaveLength(80);
    expect(grid.blocked).toHaveLength(80);
  });

  it("add and at", () => {
    const grid = new SpatialGrid(5, 5);
    grid.add(id(1), 3, 4);
    expect(grid.at(3, 4)).toContain(id(1));
  });

  it("add out of bounds is silently ignored", () => {
    const grid = new SpatialGrid(5, 5);
    grid.add(id(1), -1, 0);
    grid.add(id(2), 5, 0);
    expect(grid.at(-1, 0)).toEqual([]);
  });

  it("remove", () => {
    const grid = new SpatialGrid(5, 5);
    grid.add(id(1), 2, 2);
    grid.remove(id(1));
    expect(grid.at(2, 2)).toEqual([]);
  });

  it("remove non-existent id does not throw", () => {
    const grid = new SpatialGrid(5, 5);
    expect(() => grid.remove(id(99))).not.toThrow();
  });

  it("move updates cell", () => {
    const grid = new SpatialGrid(5, 5);
    grid.add(id(1), 0, 0);
    grid.move(id(1), 0, 0, 3, 3);
    expect(grid.at(0, 0)).toEqual([]);
    expect(grid.at(3, 3)).toContain(id(1));
  });

  it("multiple entities per cell", () => {
    const grid = new SpatialGrid(5, 5);
    grid.add(id(1), 2, 2);
    grid.add(id(2), 2, 2);
    const cell = grid.at(2, 2);
    expect(cell).toContain(id(1));
    expect(cell).toContain(id(2));
  });

  it("isBlocked by static blocked flag", () => {
    const grid = new SpatialGrid(5, 5);
    grid.blocked[1 * 5 + 1] = 1;
    expect(grid.isBlocked(1, 1, mockReader())).toBe(true);
  });

  it("isBlocked by solid collider", () => {
    const grid = new SpatialGrid(5, 5);
    grid.add(id(1), 2, 2);
    expect(grid.isBlocked(2, 2, mockReader(new Set([id(1)])))).toBe(true);
  });

  it("isBlocked returns false for empty cell", () => {
    const grid = new SpatialGrid(5, 5);
    expect(grid.isBlocked(2, 2, mockReader())).toBe(false);
  });

  it("isBlocked out of bounds returns true", () => {
    const grid = new SpatialGrid(5, 5);
    expect(grid.isBlocked(-1, 0, mockReader())).toBe(true);
    expect(grid.isBlocked(5, 0, mockReader())).toBe(true);
  });

  it("queryArea finds entities in radius", () => {
    const grid = new SpatialGrid(10, 10);
    grid.add(id(1), 5, 5);
    grid.add(id(2), 6, 5);
    grid.add(id(3), 9, 9);
    const result = grid.queryArea(5, 5, 1, mockReader());
    expect(result).toContain(id(1));
    expect(result).toContain(id(2));
    expect(result).not.toContain(id(3));
  });

  it("queryArea filters by component", () => {
    const grid = new SpatialGrid(10, 10);
    grid.add(id(1), 5, 5);
    grid.add(id(2), 5, 5);
    const reader = mockReader(new Set([id(1)]));
    const result = grid.queryArea(5, 5, 0, reader, "collider");
    expect(result).toEqual([id(1)]);
  });

  it("toPathGrid marks blocked cells", () => {
    const grid = new SpatialGrid(3, 3);
    grid.blocked[0] = 1;
    grid.add(id(1), 2, 2);
    const path = grid.toPathGrid(mockReader(new Set([id(1)])));
    expect(path[0]).toBe(1); // static blocked
    expect(path[8]).toBe(1); // collider at (2,2)
    expect(path[4]).toBe(0); // center is free
  });
});
