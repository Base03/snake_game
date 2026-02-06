export interface Layer {
  name: string;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  render: (ctx: OffscreenCanvasRenderingContext2D) => void;
  dirty: boolean;
  alwaysDirty: boolean;
}

export class RenderPipeline {
  private layers: Layer[] = [];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  addLayer(
    name: string,
    renderFn: (ctx: OffscreenCanvasRenderingContext2D) => void,
    opts?: { alwaysDirty?: boolean },
  ): void {
    const canvas = new OffscreenCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(`Failed to get 2d context for layer "${name}"`);
    this.layers.push({
      name,
      canvas,
      ctx,
      render: renderFn,
      dirty: true,
      alwaysDirty: opts?.alwaysDirty ?? false,
    });
  }

  markDirty(name: string): void {
    for (const layer of this.layers) {
      if (layer.name === name) {
        layer.dirty = true;
        return;
      }
    }
  }

  getLayer(name: string): Layer | undefined {
    return this.layers.find((l) => l.name === name);
  }

  render(mainCtx: CanvasRenderingContext2D): void {
    for (const layer of this.layers) {
      if (layer.dirty || layer.alwaysDirty) {
        layer.ctx.clearRect(0, 0, this.width, this.height);
        layer.render(layer.ctx);
        layer.dirty = false;
      }
      mainCtx.drawImage(layer.canvas, 0, 0);
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const layer of this.layers) {
      layer.canvas.width = width;
      layer.canvas.height = height;
      layer.dirty = true;
    }
  }
}
