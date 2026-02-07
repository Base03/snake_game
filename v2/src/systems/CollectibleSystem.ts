import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { spawnSnakeSegment } from "../spawners/snake.js";
import { GAME_STATE, CORRUPTION } from "../spawners/tags.js";

/**
 * Sets up event listeners for collectible eating (growth + score)
 * and chain death (game over).
 *
 * Call once after world and bus are ready.
 */
export function setupCollectibleListeners(world: World): void {
  // ── Growth + Score on collectible:eaten ────────────────────
  world.bus.on("collectible:eaten", (data) => {
    const { entityId, eaterId: headId, freshness } = data;

    // Read collectible data before destroying
    const collectible = world.get(entityId, "collectible");
    const baseSegments = collectible?.segments ?? 1;
    const baseScore = collectible?.baseScore ?? 10;

    // Destroy the collectible entity
    world.destroy(entityId);

    // Compute growth: base segments + freshness bonus
    const totalSegments = baseSegments + Math.floor(freshness * 3);

    // Walk chain to find tail
    let tailId = headId;
    let link = world.get(tailId, "chainLink");
    while (link && link.childId !== null) {
      tailId = link.childId;
      link = world.get(tailId, "chainLink");
    }

    const tailPos = world.get(tailId, "position")!;
    let parentId = tailId;
    let index = link!.index;
    let lastSegId: EntityId = tailId;

    // Spawn new segments at tail's current position
    for (let i = 0; i < totalSegments; i++) {
      index++;
      lastSegId = spawnSnakeSegment(
        world,
        headId,
        parentId,
        tailPos.x,
        tailPos.y,
        index,
      );
      parentId = lastSegId;
    }

    // Update score
    const gsIds = world.queryTagged(GAME_STATE);
    if (gsIds.length > 0) {
      const gs = world.get(gsIds[0]!, "gameState");
      if (gs) {
        gs.score += baseScore + Math.floor(freshness * 100);
      }
    }

    world.bus.emit("chain:grew", {
      headId,
      newSegId: lastSegId,
      count: totalSegments,
    });
  });

  // ── Death on chain:killed ──────────────────────────────────
  world.bus.on("chain:killed", (data) => {
    const gsIds = world.queryTagged(GAME_STATE);
    if (gsIds.length === 0) return;
    const gsId = gsIds[0]!;
    const gs = world.get(gsId, "gameState");
    if (!gs || !gs.alive) return;

    gs.alive = false;

    const corrIds = world.queryTagged(CORRUPTION);
    const corrValue =
      corrIds.length > 0
        ? (world.get(corrIds[0]!, "corruption")?.value ?? 0)
        : 0;

    world.bus.emit("game:over", {
      score: gs.score,
      corruption: corrValue,
      cause: data.cause,
    });
  });
}
