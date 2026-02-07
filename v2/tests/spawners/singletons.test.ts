import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import {
  spawnGameState,
  spawnCorruption,
  spawnLightning,
  spawnSingletons,
} from "@spawners/singletons";
import { GAME_STATE, CORRUPTION, LIGHTNING } from "@spawners/tags";

describe("spawnGameState", () => {
  it("creates entity with gameState component", () => {
    const w = new World();
    const id = spawnGameState(w);
    const gs = w.get(id, "gameState")!;
    expect(gs.score).toBe(0);
    expect(gs.alive).toBe(true);
    expect(gs.started).toBe(false);
    expect(gs.gameTime).toBe(0);
  });

  it("tags entity as gameState", () => {
    const w = new World();
    const id = spawnGameState(w);
    expect(w.hasTag(id, GAME_STATE)).toBe(true);
  });

  it("has no position or drawable", () => {
    const w = new World();
    const id = spawnGameState(w);
    expect(w.has(id, "position")).toBe(false);
    expect(w.has(id, "drawable")).toBe(false);
  });
});

describe("spawnCorruption", () => {
  it("creates entity with corruption component", () => {
    const w = new World();
    const id = spawnCorruption(w);
    const c = w.get(id, "corruption")!;
    expect(c.value).toBe(0);
    expect(c.target).toBe(0);
  });

  it("tags entity as corruption", () => {
    const w = new World();
    const id = spawnCorruption(w);
    expect(w.hasTag(id, CORRUPTION)).toBe(true);
  });
});

describe("spawnLightning", () => {
  it("creates entity with lightning component", () => {
    const w = new World();
    const id = spawnLightning(w);
    const l = w.get(id, "lightning")!;
    expect(l.timer).toBe(10000);
    expect(l.alpha).toBe(0);
  });

  it("tags entity as lightning", () => {
    const w = new World();
    const id = spawnLightning(w);
    expect(w.hasTag(id, LIGHTNING)).toBe(true);
  });
});

describe("spawnSingletons", () => {
  it("returns all three singleton IDs", () => {
    const w = new World();
    const ids = spawnSingletons(w);
    expect(w.has(ids.gameState, "gameState")).toBe(true);
    expect(w.has(ids.corruption, "corruption")).toBe(true);
    expect(w.has(ids.lightning, "lightning")).toBe(true);
  });

  it("creates distinct entities", () => {
    const w = new World();
    const ids = spawnSingletons(w);
    const allIds = new Set([ids.gameState, ids.corruption, ids.lightning]);
    expect(allIds.size).toBe(3);
  });
});
