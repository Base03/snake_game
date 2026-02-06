export class ParticlePool {
  private readonly max: number;
  private count = 0;

  // Struct-of-arrays for cache-friendly iteration
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly hue: Float32Array;
  private readonly smoke: Int32Array;

  constructor(max = 500) {
    this.max = max;
    this.px = new Float32Array(max);
    this.py = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.hue = new Float32Array(max);
    this.smoke = new Int32Array(max);
  }

  get activeCount(): number {
    return this.count;
  }

  emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    hue: number,
    smoke = false,
  ): void {
    if (this.count >= this.max) return;
    const i = this.count;
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.hue[i] = hue;
    this.smoke[i] = smoke ? 1 : 0;
    this.count++;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      // All index accesses below are safe: i < this.count <= this.max
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) {
        // Swap with last active particle, shrink count
        this.count--;
        if (i < this.count) {
          this.px[i]! = this.px[this.count]!;
          this.py[i]! = this.py[this.count]!;
          this.vx[i]! = this.vx[this.count]!;
          this.vy[i]! = this.vy[this.count]!;
          this.life[i]! = this.life[this.count]!;
          this.maxLife[i]! = this.maxLife[this.count]!;
          this.size[i]! = this.size[this.count]!;
          this.hue[i]! = this.hue[this.count]!;
          this.smoke[i]! = this.smoke[this.count]!;
        }
        continue; // re-check swapped particle at same index
      }
      this.px[i]! += this.vx[i]! * dt;
      this.py[i]! += this.vy[i]! * dt;
      i++;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.count; i++) {
      const t = this.life[i]! / this.maxLife[i]!;
      const s = this.size[i]! * (0.5 + t * 0.5);

      if (this.smoke[i]) {
        ctx.globalAlpha = t * 0.35;
        ctx.fillStyle = "#787064";
      } else {
        ctx.globalAlpha = t * 0.9;
        ctx.fillStyle = `hsl(${this.hue[i]! | 0},100%,${(50 + t * 40) | 0}%)`;
      }
      ctx.fillRect(
        this.px[i]! - s * 0.5,
        this.py[i]! - s * 0.5,
        s,
        s,
      );
    }
    ctx.globalAlpha = 1;
  }
}
