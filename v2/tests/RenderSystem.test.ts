import { describe, it, expect, vi, beforeEach } from "vitest";
import { World } from "@core/World";
import { cp } from "@core/types";
import { createRenderSystem } from "@systems/RenderSystem";
import { registerRenderer, getRenderer } from "@rendering/renderers";

function mockCtx(): CanvasRenderingContext2D {
  return {
    canvas: { width: 320, height: 320 },
    fillStyle: "",
    fillRect: vi.fn(),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("RenderSystem", () => {
  it("clears the canvas with dark background", () => {
    const ctx = mockCtx();
    const system = createRenderSystem(ctx, 16);
    const world = new World();
    system(world);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 320, 320);
  });

  it("dispatches to registered renderer", () => {
    const ctx = mockCtx();
    const testRenderer = vi.fn();
    registerRenderer("__test_entity", testRenderer);

    const world = new World();
    const id = world.spawn(
      cp("position", { x: 2, y: 3 }),
      cp("drawable", {
        type: "__test_entity",
        layer: 0,
        zIndex: 0,
        visible: true,
      }),
    );

    const system = createRenderSystem(ctx, 16);
    system(world);

    expect(testRenderer).toHaveBeenCalledTimes(1);
    expect(testRenderer).toHaveBeenCalledWith(
      ctx,
      32, // 2 * 16
      48, // 3 * 16
      16,
      expect.objectContaining({ type: "__test_entity" }),
      id,
      world,
    );
  });

  it("skips invisible entities", () => {
    const ctx = mockCtx();
    const testRenderer = vi.fn();
    registerRenderer("__test_invisible", testRenderer);

    const world = new World();
    world.spawn(
      cp("position", { x: 0, y: 0 }),
      cp("drawable", {
        type: "__test_invisible",
        layer: 0,
        zIndex: 0,
        visible: false,
      }),
    );

    const system = createRenderSystem(ctx, 16);
    system(world);
    expect(testRenderer).not.toHaveBeenCalled();
  });

  it("sorts by layer then zIndex", () => {
    const ctx = mockCtx();
    const order: string[] = [];
    registerRenderer("__test_order_a", () => order.push("a"));
    registerRenderer("__test_order_b", () => order.push("b"));
    registerRenderer("__test_order_c", () => order.push("c"));

    const world = new World();
    // Spawn in wrong order: c should be last (layer 2), b first (layer 0, z 0), a middle (layer 0, z 1)
    world.spawn(
      cp("position", { x: 0, y: 0 }),
      cp("drawable", {
        type: "__test_order_a",
        layer: 0,
        zIndex: 1,
        visible: true,
      }),
    );
    world.spawn(
      cp("position", { x: 0, y: 0 }),
      cp("drawable", {
        type: "__test_order_c",
        layer: 2,
        zIndex: 0,
        visible: true,
      }),
    );
    world.spawn(
      cp("position", { x: 0, y: 0 }),
      cp("drawable", {
        type: "__test_order_b",
        layer: 0,
        zIndex: 0,
        visible: true,
      }),
    );

    const system = createRenderSystem(ctx, 16);
    system(world);
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("entities without a registered renderer are silently skipped", () => {
    const ctx = mockCtx();
    const world = new World();
    world.spawn(
      cp("position", { x: 0, y: 0 }),
      cp("drawable", {
        type: "__nonexistent_type",
        layer: 0,
        zIndex: 0,
        visible: true,
      }),
    );

    const system = createRenderSystem(ctx, 16);
    expect(() => system(world)).not.toThrow();
  });
});
