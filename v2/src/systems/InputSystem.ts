import type { World } from "../core/World.js";
import type { SystemFn } from "../core/World.js";
import { SNAKE_HEAD } from "../spawners/tags.js";

export interface InputSystemHandle {
  /** Queue a direction for the next tick. Tests call this directly. */
  enqueueDirection(dx: number, dy: number): void;
  /** The system function registered in World. */
  system: SystemFn;
}

/**
 * Creates an input system that captures direction input and writes it
 * to player-controlled snake heads.
 *
 * Returns a handle with `system` (the per-tick function) and
 * `enqueueDirection` (for programmatic input / testing).
 */
export function createInputSystem(target?: EventTarget): InputSystemHandle {
  let pendingDir: { dx: number; dy: number } | null = null;

  function enqueueDirection(dx: number, dy: number): void {
    pendingDir = { dx, dy };
  }

  if (target) {
    target.addEventListener("keydown", ((e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          enqueueDirection(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          enqueueDirection(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          enqueueDirection(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          enqueueDirection(1, 0);
          break;
      }
    }) as EventListener);
  }

  const system: SystemFn = (world: World) => {
    if (!pendingDir) return;

    const heads = world.queryTagged(
      SNAKE_HEAD,
      "playerControlled",
      "velocity",
    );

    for (const headId of heads) {
      const vel = world.get(headId, "velocity")!;
      // Reject 180° reversal
      if (pendingDir.dx === -vel.dx && pendingDir.dy === -vel.dy) continue;
      // Reject zero direction
      if (pendingDir.dx === 0 && pendingDir.dy === 0) continue;

      const pc = world.get(headId, "playerControlled")!;
      pc.nextDir = { x: pendingDir.dx, y: pendingDir.dy };
    }

    pendingDir = null;
  };

  return { enqueueDirection, system };
}
