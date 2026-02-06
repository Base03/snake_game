import type { World, SystemFn } from "../core/World.js";
import { getRenderer } from "../rendering/renderers.js";

/**
 * Creates a RENDER-phase system that queries all entities with
 * position + drawable, sorts by layer/zIndex, and dispatches
 * to the matching renderer function.
 */
export function createRenderSystem(
  ctx: CanvasRenderingContext2D,
  gridSize: number,
): SystemFn {
  return (world: World) => {
    ctx.fillStyle = "#08060a";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const entities = world.query("position", "drawable");

    entities.sort((a, b) => {
      const da = world.get(a, "drawable")!;
      const db = world.get(b, "drawable")!;
      return da.layer - db.layer || da.zIndex - db.zIndex;
    });

    for (const id of entities) {
      const pos = world.get(id, "position")!;
      const drawable = world.get(id, "drawable")!;
      if (!drawable.visible) continue;
      const renderer = getRenderer(drawable.type);
      if (renderer) {
        renderer(
          ctx,
          pos.x * gridSize,
          pos.y * gridSize,
          gridSize,
          drawable,
          id,
          world,
        );
      }
    }
  };
}
