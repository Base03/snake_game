import { describe, it, expect, vi } from "vitest";
import { World } from "@core/World";
import { SpatialGrid } from "@core/SpatialGrid";
import { cp } from "@core/types";
import { spawnSnake } from "@spawners/snake";
import { spawnCandle } from "@spawners/collectibles";
import { spawnWall } from "@spawners/environment";
import { createMovementSystem } from "@systems/MovementSystem";

function worldWithGrid(cols = 20, rows = 20): World {
  const w = new World();
  w.grid = new SpatialGrid(cols, rows);
  return w;
}

/** Simulate one frame at the given dt (seconds). */
function tick(world: World, system: ReturnType<typeof createMovementSystem>, dtSeconds: number) {
  world.time.dt = dtSeconds;
  system(world);
}

describe("MovementSystem", () => {
  it("moves head one tile per interval", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    const system = createMovementSystem();

    // dt = 110ms = one full interval (110ms default)
    tick(w, system, 0.11);

    expect(w.get(head, "position")).toEqual({ x: 11, y: 10 });
  });

  it("does not move before accumulator reaches interval", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    const system = createMovementSystem();

    tick(w, system, 0.05); // 50ms < 110ms
    expect(w.get(head, "position")).toEqual({ x: 10, y: 10 });
  });

  it("commits direction from playerControlled at tick", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    w.get(head, "playerControlled")!.nextDir = { x: 0, y: 1 };
    const system = createMovementSystem();

    tick(w, system, 0.11);

    expect(w.get(head, "position")).toEqual({ x: 10, y: 11 });
    expect(w.get(head, "velocity")!.dx).toBe(0);
    expect(w.get(head, "velocity")!.dy).toBe(1);
  });

  it("cascades body segments: each takes parent old position", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 10, 4);
    // Initial: head(10,10), s1(9,10), s2(8,10), s3(7,10)
    const system = createMovementSystem();

    tick(w, system, 0.11);

    expect(w.get(head, "position")).toEqual({ x: 11, y: 10 });
    expect(w.get(segments[0]!, "position")).toEqual({ x: 10, y: 10 });
    expect(w.get(segments[1]!, "position")).toEqual({ x: 9, y: 10 });
    expect(w.get(segments[2]!, "position")).toEqual({ x: 8, y: 10 });
  });

  it("updates SpatialGrid positions after move", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    const system = createMovementSystem();

    tick(w, system, 0.11);

    expect(w.grid!.at(11, 10)).toContain(head);
    expect(w.grid!.at(10, 10)).not.toContain(head);
  });

  it("emits chain:moved after successful move", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    const system = createMovementSystem();
    const handler = vi.fn();
    w.bus.on("chain:moved", handler);

    tick(w, system, 0.11);

    expect(handler).toHaveBeenCalledWith({ headId: head, x: 11, y: 10 });
  });

  it("emits chain:killed on wall collision (out of bounds)", () => {
    const w = worldWithGrid(5, 5);
    // Head at (4,2) moving right → (5,2) is out of bounds
    const { head } = spawnSnake(w, 4, 2, 1);
    const system = createMovementSystem();
    const handler = vi.fn();
    w.bus.on("chain:killed", handler);

    tick(w, system, 0.11);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ headId: head, cause: "wall" }),
    );
    // Head should NOT have moved
    expect(w.get(head, "position")).toEqual({ x: 4, y: 2 });
  });

  it("emits chain:killed on solid collider collision", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    // Place a wall at (11, 10) — where head will try to move
    spawnWall(w, 11, 10, { side: 0 });
    const system = createMovementSystem();
    const handler = vi.fn();
    w.bus.on("chain:killed", handler);

    tick(w, system, 0.11);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ headId: head, cause: "wall" }),
    );
  });

  it("emits chain:killed on self-collision", () => {
    const w = worldWithGrid();
    // Create a snake bent into itself. Head at (5,5) moving left.
    // Place segment at (4,5) so head collides with it.
    const { head } = spawnSnake(w, 5, 5, 3);
    // head(5,5) moving right, segs at (4,5), (3,5)
    // Change direction to left — would hit seg at (4,5)
    w.get(head, "velocity")!.dx = -1;
    w.get(head, "velocity")!.dy = 0;
    w.get(head, "playerControlled")!.nextDir = { x: -1, y: 0 };

    const system = createMovementSystem();
    const handler = vi.fn();
    w.bus.on("chain:killed", handler);

    tick(w, system, 0.11);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ headId: head, cause: "self" }),
    );
  });

  it("detects collectible at destination and emits collectible:eaten", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    // Place candle at (11, 10)
    const candleId = spawnCandle(w, 11, 10);
    const system = createMovementSystem();
    const handler = vi.fn();
    w.bus.on("collectible:eaten", handler);

    tick(w, system, 0.11);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: candleId,
        eaterId: head,
        type: "candle",
      }),
    );
  });

  it("does not destroy collectible (CollectibleSystem handles that)", () => {
    const w = worldWithGrid();
    spawnSnake(w, 10, 10, 1);
    const candleId = spawnCandle(w, 11, 10);
    const system = createMovementSystem();

    tick(w, system, 0.11);

    // Collectible still exists (has position)
    expect(w.has(candleId, "position")).toBe(true);
  });

  it("handles multiple ticks in one frame (frame drop)", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    const system = createMovementSystem();

    // dt = 220ms = two full intervals
    tick(w, system, 0.22);

    expect(w.get(head, "position")).toEqual({ x: 12, y: 10 });
  });

  it("stops moving after death (accumulator cleared)", () => {
    const w = worldWithGrid(5, 5);
    // Head at (3,2) moving right. Wall at edge (boundary at x=5).
    // After dying at x=5, should not continue moving.
    const { head } = spawnSnake(w, 3, 2, 1);
    const system = createMovementSystem();

    // 220ms = 2 ticks. First tick: 3→4 (ok). Second tick: 4→5 (OOB, die).
    tick(w, system, 0.22);

    // Head moved to 4, then died trying to reach 5
    expect(w.get(head, "position")).toEqual({ x: 4, y: 2 });
  });

  it("no-op without SpatialGrid", () => {
    const w = new World();
    // No grid attached
    const { head } = spawnSnake(w, 10, 10, 1);
    const system = createMovementSystem();
    tick(w, system, 0.11);
    expect(w.get(head, "position")).toEqual({ x: 10, y: 10 });
  });
});
