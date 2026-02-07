import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import { spawnSnake } from "@spawners/snake";
import { createInputSystem } from "@systems/InputSystem";

function setup() {
  const w = new World();
  const { enqueueDirection, system } = createInputSystem();
  const { head } = spawnSnake(w, 5, 5, 3);
  return { w, enqueue: enqueueDirection, system, head };
}

describe("InputSystem", () => {
  it("up sets nextDir to (0, -1)", () => {
    const { w, enqueue, system, head } = setup();
    enqueue(0, -1);
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 0, y: -1 });
  });

  it("down sets nextDir to (0, 1)", () => {
    const { w, enqueue, system, head } = setup();
    enqueue(0, 1);
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 0, y: 1 });
  });

  it("left sets nextDir to (-1, 0) when moving up", () => {
    const { w, enqueue, system, head } = setup();
    // Change velocity to up so left is a valid 90° turn
    const vel = w.get(head, "velocity")!;
    vel.dx = 0;
    vel.dy = -1;
    enqueue(-1, 0);
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: -1, y: 0 });
  });

  it("right sets nextDir to (1, 0)", () => {
    const { w, enqueue, system, head } = setup();
    enqueue(1, 0);
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 1, y: 0 });
  });

  it("rejects 180° reversal (moving right, press left)", () => {
    const { w, enqueue, system, head } = setup();
    // Snake starts moving right (vel.dx=1, vel.dy=0)
    enqueue(-1, 0);
    system(w);
    // nextDir should remain initial right
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 1, y: 0 });
  });

  it("allows 90° turn", () => {
    const { w, enqueue, system, head } = setup();
    // Moving right, turn up is valid
    enqueue(0, -1);
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 0, y: -1 });
  });

  it("last enqueue wins between ticks", () => {
    const { w, enqueue, system, head } = setup();
    enqueue(0, -1); // up
    enqueue(0, 1); // down overwrites — both are valid 90° turns from right
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 0, y: 1 });
  });

  it("clears pending direction after processing", () => {
    const { w, enqueue, system, head } = setup();
    enqueue(0, -1);
    system(w);
    // Manually reset nextDir, run again — should stay since no new input
    w.get(head, "playerControlled")!.nextDir = { x: 1, y: 0 };
    system(w);
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 1, y: 0 });
  });

  it("no-op when no snake entities exist", () => {
    const w = new World();
    const { enqueueDirection, system } = createInputSystem();
    enqueueDirection(0, -1);
    expect(() => system(w)).not.toThrow();
  });

  it("no-op when no input is pending", () => {
    const { w, system, head } = setup();
    system(w);
    // nextDir stays at initial right
    expect(w.get(head, "playerControlled")!.nextDir).toEqual({ x: 1, y: 0 });
  });
});
