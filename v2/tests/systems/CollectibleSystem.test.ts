import { describe, it, expect, vi } from "vitest";
import { World } from "@core/World";
import { SpatialGrid } from "@core/SpatialGrid";
import { spawnSnake } from "@spawners/snake";
import { spawnCandle, spawnHellfire } from "@spawners/collectibles";
import { spawnSingletons } from "@spawners/singletons";
import { SNAKE_SEGMENT } from "@spawners/tags";
import { setupCollectibleListeners } from "@systems/CollectibleSystem";
import { createMovementSystem } from "@systems/MovementSystem";

function worldWithGrid(cols = 20, rows = 20): World {
  const w = new World();
  w.grid = new SpatialGrid(cols, rows);
  return w;
}

function tick(world: World, system: ReturnType<typeof createMovementSystem>, dtSeconds: number) {
  world.time.dt = dtSeconds;
  system(world);
}

describe("CollectibleSystem — growth", () => {
  it("spawns segments when collectible is eaten", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 10, 3);
    spawnCandle(w, 11, 10);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);

    const initialLength = 1 + segments.length; // 3
    tick(w, moveSys, 0.11);

    // Count all segments tagged SNAKE_SEGMENT
    const allSegs = w.queryTagged(SNAKE_SEGMENT);
    // Should have grown by at least 1 (candle segments=1 + floor(freshness*3))
    expect(allSegs.length).toBeGreaterThan(segments.length);
  });

  it("new segments are linked at the tail", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 10, 2);
    spawnCandle(w, 11, 10);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);

    tick(w, moveSys, 0.11);

    // Walk chain from head to verify integrity
    let current = head;
    let link = w.get(current, "chainLink")!;
    let count = 1;
    while (link.childId !== null) {
      current = link.childId;
      link = w.get(current, "chainLink")!;
      count++;
      expect(link.headId).toBe(head);
    }
    // Chain should be longer than original
    expect(count).toBeGreaterThan(2);
    // Tail's childId should be null
    expect(link.childId).toBeNull();
  });

  it("destroys collectible entity after eating", () => {
    const w = worldWithGrid();
    spawnSnake(w, 10, 10, 1);
    const candleId = spawnCandle(w, 11, 10);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);

    tick(w, moveSys, 0.11);

    // Collectible should be destroyed
    expect(w.has(candleId, "position")).toBe(false);
  });

  it("emits chain:grew with correct count", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 10, 1);
    w.time.now = 0; // freshness depends on birth time
    const candleId = spawnCandle(w, 11, 10);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);
    const handler = vi.fn();
    w.bus.on("chain:grew", handler);

    tick(w, moveSys, 0.11);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ headId: head }),
    );
    expect(handler.mock.calls[0]![0].count).toBeGreaterThanOrEqual(1);
  });

  it("hellfire gives more segments than candle", () => {
    // Hellfire has segments=2 vs candle segments=1
    const w1 = worldWithGrid();
    spawnSnake(w1, 10, 10, 1);
    spawnCandle(w1, 11, 10);
    setupCollectibleListeners(w1);
    const grewCandle = vi.fn();
    w1.bus.on("chain:grew", grewCandle);
    tick(w1, createMovementSystem(), 0.11);

    const w2 = worldWithGrid();
    spawnSnake(w2, 10, 10, 1);
    spawnHellfire(w2, 11, 10);
    setupCollectibleListeners(w2);
    const grewHellfire = vi.fn();
    w2.bus.on("chain:grew", grewHellfire);
    tick(w2, createMovementSystem(), 0.11);

    expect(grewHellfire.mock.calls[0]![0].count).toBeGreaterThan(
      grewCandle.mock.calls[0]![0].count,
    );
  });

  it("new segments register in SpatialGrid", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 10, 2);
    spawnCandle(w, 11, 10);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);

    tick(w, moveSys, 0.11);

    // Walk to tail and check grid registration
    let tailId = head;
    let link = w.get(tailId, "chainLink")!;
    while (link.childId !== null) {
      tailId = link.childId;
      link = w.get(tailId, "chainLink")!;
    }
    const tailPos = w.get(tailId, "position")!;
    expect(w.grid!.at(tailPos.x, tailPos.y)).toContain(tailId);
  });
});

describe("CollectibleSystem — score", () => {
  it("updates gameState score on collectible eaten", () => {
    const w = worldWithGrid();
    spawnSnake(w, 10, 10, 1);
    spawnCandle(w, 11, 10);
    const singletons = spawnSingletons(w);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);

    tick(w, moveSys, 0.11);

    const gs = w.get(singletons.gameState, "gameState")!;
    expect(gs.score).toBeGreaterThan(0);
  });
});

describe("CollectibleSystem — death", () => {
  it("sets gameState.alive to false on chain:killed", () => {
    const w = worldWithGrid(5, 5);
    // Head at (3,2) moving right → (4,2) → (5,2) OOB
    spawnSnake(w, 3, 2, 1);
    const singletons = spawnSingletons(w);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);

    // Two ticks: first moves to (4,2), second hits boundary
    tick(w, moveSys, 0.22);

    const gs = w.get(singletons.gameState, "gameState")!;
    expect(gs.alive).toBe(false);
  });

  it("emits game:over on chain:killed", () => {
    const w = worldWithGrid(5, 5);
    spawnSnake(w, 3, 2, 1);
    spawnSingletons(w);
    const moveSys = createMovementSystem();
    setupCollectibleListeners(w);
    const handler = vi.fn();
    w.bus.on("game:over", handler);

    tick(w, moveSys, 0.22);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ cause: "wall" }),
    );
  });

  it("does not emit game:over twice", () => {
    const w = worldWithGrid(5, 5);
    spawnSnake(w, 3, 2, 1);
    spawnSingletons(w);
    setupCollectibleListeners(w);
    const handler = vi.fn();
    w.bus.on("game:over", handler);

    // Manually emit two kills
    const headId = w.queryTagged("snakeHead")[0]!;
    w.bus.emit("chain:killed", { headId, killerId: headId, x: 5, y: 2, cause: "wall" });
    w.bus.emit("chain:killed", { headId, killerId: headId, x: 5, y: 2, cause: "wall" });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
