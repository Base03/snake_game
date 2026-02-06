import { describe, it, expect, vi, beforeEach } from "vitest";
import { RenderPipeline } from "@rendering/RenderPipeline";

// Mock OffscreenCanvas since it doesn't exist in Node
function mockOffscreenCtx() {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
  } as unknown as OffscreenCanvasRenderingContext2D;
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ctx = mockOffscreenCtx();
  }

  getContext(_type: string) {
    return this.ctx;
  }
}

// Install global mock before tests
beforeEach(() => {
  vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
});

function mockMainCtx() {
  return {
    drawImage: vi.fn(),
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("RenderPipeline", () => {
  it("addLayer creates a layer that renders on first pass", () => {
    const pipeline = new RenderPipeline(100, 100);
    const renderFn = vi.fn();
    pipeline.addLayer("bg", renderFn);

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx);

    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(mainCtx.drawImage).toHaveBeenCalledTimes(1);
  });

  it("layer does not re-render when clean", () => {
    const pipeline = new RenderPipeline(100, 100);
    const renderFn = vi.fn();
    pipeline.addLayer("bg", renderFn);

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx); // first render: dirty → renders
    pipeline.render(mainCtx); // second render: clean → skips

    expect(renderFn).toHaveBeenCalledTimes(1);
    // drawImage still called both times (compositing)
    expect(mainCtx.drawImage).toHaveBeenCalledTimes(2);
  });

  it("markDirty causes re-render", () => {
    const pipeline = new RenderPipeline(100, 100);
    const renderFn = vi.fn();
    pipeline.addLayer("bg", renderFn);

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx);
    pipeline.markDirty("bg");
    pipeline.render(mainCtx);

    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it("alwaysDirty layer re-renders every frame", () => {
    const pipeline = new RenderPipeline(100, 100);
    const renderFn = vi.fn();
    pipeline.addLayer("entities", renderFn, { alwaysDirty: true });

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx);
    pipeline.render(mainCtx);
    pipeline.render(mainCtx);

    expect(renderFn).toHaveBeenCalledTimes(3);
  });

  it("layers composite in insertion order", () => {
    const pipeline = new RenderPipeline(100, 100);
    const order: string[] = [];
    pipeline.addLayer("bg", () => order.push("bg"));
    pipeline.addLayer("entities", () => order.push("entities"));
    pipeline.addLayer("ui", () => order.push("ui"));

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx);

    expect(order).toEqual(["bg", "entities", "ui"]);
    expect(mainCtx.drawImage).toHaveBeenCalledTimes(3);
  });

  it("resize updates all layers and marks dirty", () => {
    const pipeline = new RenderPipeline(100, 100);
    const renderFn = vi.fn();
    pipeline.addLayer("bg", renderFn);

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx); // clears dirty

    pipeline.resize(200, 150);

    // Check the layer's canvas was resized
    const layer = pipeline.getLayer("bg");
    expect(layer!.canvas.width).toBe(200);
    expect(layer!.canvas.height).toBe(150);

    // Should re-render because resize marks dirty
    pipeline.render(mainCtx);
    expect(renderFn).toHaveBeenCalledTimes(2);
  });

  it("render clears layer canvas before calling renderFn", () => {
    const pipeline = new RenderPipeline(100, 100);
    pipeline.addLayer("bg", () => {});

    const mainCtx = mockMainCtx();
    pipeline.render(mainCtx);

    const layer = pipeline.getLayer("bg")!;
    expect(layer.ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });

  it("markDirty on unknown layer is a no-op", () => {
    const pipeline = new RenderPipeline(100, 100);
    expect(() => pipeline.markDirty("nonexistent")).not.toThrow();
  });

  it("getLayer returns undefined for unknown name", () => {
    const pipeline = new RenderPipeline(100, 100);
    expect(pipeline.getLayer("nope")).toBeUndefined();
  });
});
