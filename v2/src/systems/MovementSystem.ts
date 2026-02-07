import type { World } from "../core/World.js";
import type { SystemFn } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { SNAKE_HEAD, COLLECTIBLE } from "../spawners/tags.js";

export function createMovementSystem(): SystemFn {
  return (world: World) => {
    const grid = world.grid;
    if (!grid) return;

    const dtMs = world.time.dt * 1000;
    const heads = world.queryTagged(
      SNAKE_HEAD,
      "velocity",
      "chainLink",
      "position",
    );

    for (const headId of heads) {
      const vel = world.get(headId, "velocity")!;
      vel.accumulator += dtMs;

      while (vel.accumulator >= vel.interval) {
        vel.accumulator -= vel.interval;

        // Commit direction from playerControlled
        const pc = world.get(headId, "playerControlled");
        if (pc) {
          vel.dx = pc.nextDir.x;
          vel.dy = pc.nextDir.y;
        }

        const headPos = world.get(headId, "position")!;
        const nx = headPos.x + vel.dx;
        const ny = headPos.y + vel.dy;

        // Wall / boundary collision
        if (grid.isBlocked(nx, ny, world)) {
          world.bus.emit("chain:killed", {
            headId,
            killerId: headId,
            x: nx,
            y: ny,
            cause: "wall",
          });
          vel.accumulator = 0;
          break;
        }

        // Self-collision: any same-chain entity at destination
        const atDest = grid.at(nx, ny);
        let selfHit = false;
        for (const eid of atDest) {
          if (eid === headId) continue;
          const link = world.get(eid, "chainLink");
          if (link && (link.headId === headId || eid === headId)) {
            selfHit = true;
            world.bus.emit("chain:killed", {
              headId,
              killerId: eid,
              x: nx,
              y: ny,
              cause: "self",
            });
            break;
          }
        }
        if (selfHit) {
          vel.accumulator = 0;
          break;
        }

        // Snapshot collectible at destination (before cascade)
        let eatenId: EntityId | null = null;
        for (const eid of atDest) {
          if (world.hasTag(eid, COLLECTIBLE) && world.has(eid, "collectible")) {
            eatenId = eid;
            break;
          }
        }

        // Cascade chain: head → tail
        const chain: EntityId[] = [headId];
        let current = world.get(headId, "chainLink")!;
        while (current.childId !== null) {
          chain.push(current.childId);
          current = world.get(current.childId, "chainLink")!;
        }

        let prevX = headPos.x;
        let prevY = headPos.y;

        // Move head
        grid.move(headId, headPos.x, headPos.y, nx, ny);
        headPos.x = nx;
        headPos.y = ny;

        // Move each segment to parent's old position
        for (let i = 1; i < chain.length; i++) {
          const segId = chain[i]!;
          const segPos = world.get(segId, "position")!;
          const oldX = segPos.x;
          const oldY = segPos.y;
          grid.move(segId, segPos.x, segPos.y, prevX, prevY);
          segPos.x = prevX;
          segPos.y = prevY;
          prevX = oldX;
          prevY = oldY;
        }

        // Post-cascade events
        world.bus.emit("chain:moved", { headId, x: nx, y: ny });

        if (eatenId !== null) {
          const collectible = world.get(eatenId, "collectible");
          const lifetime = world.get(eatenId, "lifetime");
          const eatenPos = world.get(eatenId, "position");
          world.bus.emit("collectible:eaten", {
            entityId: eatenId,
            eaterId: headId,
            type: collectible?.type ?? "unknown",
            freshness: lifetime?.freshness ?? 1,
            x: eatenPos?.x ?? nx,
            y: eatenPos?.y ?? ny,
          });
        }
      }
    }
  };
}
