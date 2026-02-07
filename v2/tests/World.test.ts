import { describe, it, expect, vi } from "vitest";
import { World } from "@core/World";
import { cp, Phase } from "@core/types";
import type { EntityId } from "@core/types";

describe("World", () => {
  // ── Entity lifecycle ───────────────────────────────────

  it("spawn returns unique ids", () => {
    const w = new World();
    const a = w.spawn();
    const b = w.spawn();
    expect(a).not.toBe(b);
  });

  it("spawn attaches components", () => {
    const w = new World();
    const id = w.spawn(
      cp("position", { x: 3, y: 7 }),
      cp("collider", { solid: true, trigger: false }),
    );
    expect(w.get(id, "position")).toEqual({ x: 3, y: 7 });
    expect(w.get(id, "collider")).toEqual({ solid: true, trigger: false });
  });

  it("destroy removes all components", () => {
    const w = new World();
    const id = w.spawn(
      cp("position", { x: 0, y: 0 }),
      cp("collider", { solid: true, trigger: false }),
    );
    w.destroy(id);
    expect(w.has(id, "position")).toBe(false);
    expect(w.has(id, "collider")).toBe(false);
  });

  it("destroy emits entity:destroyed", () => {
    const w = new World();
    const id = w.spawn();
    const fn = vi.fn();
    w.bus.on("entity:destroyed", fn);
    w.destroy(id);
    expect(fn).toHaveBeenCalledWith({ id });
  });

  it("destroy is idempotent", () => {
    const w = new World();
    const id = w.spawn();
    w.destroy(id);
    expect(() => w.destroy(id)).not.toThrow();
  });

  // ── Component access ───────────────────────────────────

  it("add and get component after spawn", () => {
    const w = new World();
    const id = w.spawn();
    w.add(id, "position", { x: 5, y: 10 });
    expect(w.get(id, "position")).toEqual({ x: 5, y: 10 });
  });

  it("get returns undefined for missing component", () => {
    const w = new World();
    const id = w.spawn();
    expect(w.get(id, "position")).toBeUndefined();
  });

  it("has returns correct boolean", () => {
    const w = new World();
    const id = w.spawn(cp("position", { x: 0, y: 0 }));
    expect(w.has(id, "position")).toBe(true);
    expect(w.has(id, "collider")).toBe(false);
  });

  it("remove deletes component", () => {
    const w = new World();
    const id = w.spawn(cp("position", { x: 0, y: 0 }));
    w.remove(id, "position");
    expect(w.has(id, "position")).toBe(false);
    expect(w.get(id, "position")).toBeUndefined();
  });

  // ── Tags ───────────────────────────────────────────────

  it("tag and hasTag", () => {
    const w = new World();
    const id = w.spawn();
    w.tag(id, "snake", "player");
    expect(w.hasTag(id, "snake")).toBe(true);
    expect(w.hasTag(id, "player")).toBe(true);
    expect(w.hasTag(id, "enemy")).toBe(false);
  });

  it("untag removes tag", () => {
    const w = new World();
    const id = w.spawn();
    w.tag(id, "snake");
    w.untag(id, "snake");
    expect(w.hasTag(id, "snake")).toBe(false);
  });

  // ── Queries ────────────────────────────────────────────

  it("query returns entities with all requested components", () => {
    const w = new World();
    const a = w.spawn(cp("position", { x: 0, y: 0 }));
    const b = w.spawn(
      cp("position", { x: 1, y: 1 }),
      cp("collider", { solid: true, trigger: false }),
    );
    w.spawn(cp("collider", { solid: true, trigger: false }));

    const result = w.query("position", "collider");
    expect(result).toEqual([b]);

    const posOnly = w.query("position");
    expect(posOnly).toContain(a);
    expect(posOnly).toContain(b);
  });

  it("query returns empty for non-existent component", () => {
    const w = new World();
    w.spawn(cp("position", { x: 0, y: 0 }));
    expect(w.query("velocity")).toEqual([]);
  });

  it("queryTagged filters by tag", () => {
    const w = new World();
    const a = w.spawn(cp("position", { x: 0, y: 0 }));
    const b = w.spawn(cp("position", { x: 1, y: 1 }));
    w.tag(a, "snake");

    expect(w.queryTagged("snake", "position")).toEqual([a]);
  });

  it("queryTagged with no components returns all tagged", () => {
    const w = new World();
    const a = w.spawn();
    const b = w.spawn();
    w.tag(a, "pew");
    w.tag(b, "pew");

    const result = w.queryTagged("pew");
    expect(result).toContain(a);
    expect(result).toContain(b);
    expect(result).toHaveLength(2);
  });

  // ── Systems ────────────────────────────────────────────

  it("addSystem and runPhase calls systems in order", () => {
    const w = new World();
    const calls: string[] = [];
    w.addSystem("a", () => calls.push("a"), Phase.UPDATE);
    w.addSystem("b", () => calls.push("b"), Phase.UPDATE);
    w.runPhase(Phase.UPDATE);
    expect(calls).toEqual(["a", "b"]);
  });

  it("runPhase only runs systems for that phase", () => {
    const w = new World();
    const fn = vi.fn();
    w.addSystem("input", fn, Phase.INPUT);
    w.runPhase(Phase.UPDATE);
    expect(fn).not.toHaveBeenCalled();
  });

  it("system receives world instance", () => {
    const w = new World();
    let received: World | null = null;
    w.addSystem(
      "test",
      (world) => {
        received = world;
      },
      Phase.UPDATE,
    );
    w.runPhase(Phase.UPDATE);
    expect(received).toBe(w);
  });
});
