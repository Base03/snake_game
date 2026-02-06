import type { Drawable, EntityId } from "../core/types.js";
import type { World } from "../core/World.js";

export type RendererFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridSize: number,
  drawable: Drawable,
  entity: EntityId,
  world: World,
) => void;

const registry = new Map<string, RendererFn>();

export function registerRenderer(type: string, fn: RendererFn): void {
  registry.set(type, fn);
}

export function getRenderer(type: string): RendererFn | undefined {
  return registry.get(type);
}

// ── Shared utilities ──────────────────────────────────────────

// Deterministic pseudo-random from seed
function hash(n: number): number {
  let x = Math.sin(n * 127.1 + n * 311.7) * 43758.5453;
  x -= Math.floor(x);
  return x;
}

/**
 * Shared hellfire effect: radial glow + bezier flame tongues.
 * Used by hellfire renderer, burning pews, and pentagram vertices.
 *
 * @param cx      Center x (pixel)
 * @param cy      Center y (pixel)
 * @param size    Base size in pixels (roughly 1 grid unit)
 * @param hue     Base flame hue
 * @param flicker Seed for animation phase offset
 * @param now     Current time (ms)
 * @param flames  Number of flame tongues (default 4)
 * @param alpha   Overall intensity multiplier (default 1)
 */
export function drawHellfireEffect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  hue: number,
  flicker: number,
  now: number,
  flames = 4,
  alpha = 1,
): void {
  // Radial glow
  const crackGlow =
    (0.5 + Math.sin(now * 0.006 + flicker) * 0.1) * alpha;
  const gR = size * 0.9;
  const gGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, gR);
  gGrad.addColorStop(0, `rgba(255,60,0,${crackGlow * 0.5})`);
  gGrad.addColorStop(0.5, `rgba(200,20,0,${crackGlow * 0.2})`);
  gGrad.addColorStop(1, "rgba(100,0,0,0)");
  ctx.fillStyle = gGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, gR, 0, Math.PI * 2);
  ctx.fill();

  // Flame tongues — each gets a unique phase offset via hash
  for (let i = 0; i < flames; i++) {
    const theta = hash(flicker * 13.7 + i * 91.3) * Math.PI * 2;
    const angle =
      (i / flames) * Math.PI * 2 + Math.sin(now * 0.008 + theta) * 0.5;
    const dist =
      size * 0.08 + Math.sin(now * 0.01 + theta * 1.3) * size * 0.06;
    const fx = cx + Math.cos(angle) * dist;
    const fy = cy + Math.sin(angle) * dist;
    const fH =
      (size * 0.5 + Math.sin(now * 0.012 + theta * 0.7) * size * 0.18) *
      alpha;
    const fW = size * 0.18;
    const fHue = hue + Math.sin(now * 0.01 + theta * 1.1) * 10;
    const fGrad = ctx.createLinearGradient(fx, fy, fx, fy - fH);
    fGrad.addColorStop(0, `hsla(${fHue},100%,50%,${0.85 * alpha})`);
    fGrad.addColorStop(0.4, `hsla(${fHue + 20},100%,58%,${0.6 * alpha})`);
    fGrad.addColorStop(1, `hsla(${fHue + 35},100%,75%,0)`);
    ctx.fillStyle = fGrad;
    const flk = Math.sin(now * 0.015 + theta * 0.9) * fW * 0.5;
    ctx.beginPath();
    ctx.moveTo(fx - fW, fy);
    ctx.bezierCurveTo(
      fx - fW * 0.5, fy - fH * 0.4,
      fx + flk - fW * 0.3, fy - fH * 0.8,
      fx + flk, fy - fH,
    );
    ctx.bezierCurveTo(
      fx + flk + fW * 0.3, fy - fH * 0.8,
      fx + fW * 0.5, fy - fH * 0.4,
      fx + fW, fy,
    );
    ctx.fill();
  }

  // Bright core
  ctx.fillStyle = `rgba(255,200,100,${0.3 * alpha})`;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

// ── Pew ────────────────────────────────────────────────────────
// Warm wood block with grain lines. End caps get a cross detail.
registerRenderer("pew", (ctx, x, y, G, drawable, _entity, world) => {
  const data = drawable.data ?? {};
  const dx = (data["dx"] as number) ?? 0;
  const w = (data["width"] as number) ?? 1;
  const burning = (data["burning"] as boolean) ?? false;
  const now = world.time.now;

  // Wood grain (shared between normal and burning)
  const seed = hash(dx * 31.7 + ((data["row"] as number) ?? 0) * 17.3);
  const woodH = 25 + seed * 8;
  const baseS = 40 + seed * 15;
  const baseL = 28 + seed * 8;

  if (burning) {
    const bt = Math.min(((data["burnT"] as number) ?? 0) / 3500, 1);
    // Darkened/charred wood — full opacity, just darker colors
    const woodS = baseS * (1 - bt * 0.6);
    const woodL = baseL * (1 - bt * 0.7);
    ctx.fillStyle = `hsl(${woodH},${woodS}%,${woodL}%)`;
    ctx.fillRect(x + 1, y + 1, G - 2, G - 2);
    // Top rail (charred)
    ctx.fillStyle = `hsl(${woodH + 3},${Math.max(woodS - 5, 0)}%,${Math.max(woodL - 3, 4)}%)`;
    ctx.fillRect(x + 2, y + 1, G - 4, 3);
    // Grain lines (fading as it chars)
    if (bt < 0.9) {
      ctx.strokeStyle = `hsla(${woodH - 5},${woodS}%,${Math.max(woodL - 8, 2)}%,${0.4 * (1 - bt)})`;
      ctx.lineWidth = 0.5;
      for (let g = 0; g < 3; g++) {
        const gy = y + 4 + g * (G * 0.25);
        ctx.beginPath();
        ctx.moveTo(x + 2, gy);
        ctx.lineTo(x + G - 2, gy + Math.sin(seed + g) * 1.5);
        ctx.stroke();
      }
    }
    // Hellfire centered on each pew tile, same size as standalone hellfire
    const hue = (data["fireHue"] as number) ?? 15;
    drawHellfireEffect(
      ctx,
      x + G / 2,
      y + G / 2,       // centered on tile
      G * 1.8,         // match standalone hellfire size
      hue,
      dx * 1.7,
      now,
      3,               // 3 flame tongues per pew tile
      bt,              // intensity ramps with burn progress
    );
  } else {
    // Normal pew
    ctx.fillStyle = `hsl(${woodH},${baseS}%,${baseL}%)`;
    ctx.fillRect(x + 1, y + 1, G - 2, G - 2);
    // Top rail highlight
    ctx.fillStyle = `hsl(${woodH + 3},${baseS - 5}%,${baseL + 10}%)`;
    ctx.fillRect(x + 2, y + 1, G - 4, 3);
    // Grain lines
    ctx.strokeStyle = `hsla(${woodH - 5},${baseS}%,${baseL - 8}%,0.4)`;
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 3; g++) {
      const gy = y + 4 + g * (G * 0.25);
      ctx.beginPath();
      ctx.moveTo(x + 2, gy);
      ctx.lineTo(x + G - 2, gy + Math.sin(seed + g) * 1.5);
      ctx.stroke();
    }
    // Bottom shadow
    ctx.fillStyle = `hsl(${woodH},${baseS}%,${baseL - 10}%)`;
    ctx.fillRect(x + 1, y + G - 3, G - 2, 2);
  }

  // End caps with cross detail
  if (dx === 0 || dx === w - 1) {
    const capLum = burning ? 12 : 35;
    ctx.fillStyle = `hsl(22,40%,${capLum}%)`;
    ctx.fillRect(dx === 0 ? x + 1 : x + G - 4, y + 1, 3, G - 2);
    if (!burning) {
      const capX = dx === 0 ? x + 2.5 : x + G - 2.5;
      ctx.strokeStyle = "rgba(200,160,80,0.3)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(capX, y + G * 0.25);
      ctx.lineTo(capX, y + G * 0.75);
      ctx.moveTo(capX - 2, y + G * 0.4);
      ctx.lineTo(capX + 2, y + G * 0.4);
      ctx.stroke();
    }
  }
});

// ── Altar ──────────────────────────────────────────────────────
// Stone base with gold trim, cloth, and cross ON the altar.
registerRenderer("altar", (ctx, x, y, G, drawable) => {
  const data = drawable.data ?? {};
  const tileW = (data["tileW"] as number) ?? 6;
  const tileH = (data["tileH"] as number) ?? 3;
  const aW = tileW * G;
  const aH = tileH * G;
  const corruption = (data["corruption"] as number) ?? 0;

  // Stone base
  ctx.fillStyle = "#3d2d25";
  ctx.fillRect(x + 2, y + 2, aW - 4, aH - 2);
  // Stone texture lines
  ctx.strokeStyle = "rgba(80,60,45,0.3)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < tileH; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + i * G);
    ctx.lineTo(x + aW - 4, y + i * G + Math.sin(i * 3.7) * 2);
    ctx.stroke();
  }

  // Gold trim
  const trimAlpha = 0.5 - corruption * 0.3;
  ctx.strokeStyle = `rgba(210,175,90,${trimAlpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, aW - 6, aH - 4);
  ctx.strokeStyle = `rgba(180,145,70,${trimAlpha * 0.6})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 6, y + 6, aW - 12, aH - 10);

  // Cloth
  const clothH = 6;
  const clothHue = corruption > 0.4 ? 0 : 120 - corruption * 200;
  ctx.fillStyle = `hsl(${clothHue},${25 + corruption * 45}%,${18 + corruption * 6}%)`;
  ctx.fillRect(x + 8, y + aH - clothH - 2, aW - 16, clothH);
  // Cloth fringe
  ctx.fillStyle = `rgba(210,175,90,${trimAlpha * 0.7})`;
  ctx.fillRect(x + 8, y + aH - clothH - 2, aW - 16, 1.5);

  // Cross — centered ON the altar front face
  const crossX = x + aW / 2;
  const crossY = y + aH * 0.5;
  ctx.save();
  ctx.translate(crossX, crossY);
  const inv =
    corruption > 0.55 ? Math.min((corruption - 0.55) * 2.2, 1) : 0;
  ctx.rotate(Math.PI * inv);
  ctx.strokeStyle = `rgba(210,175,90,${Math.max(0.45 - corruption * 0.2, 0.08)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -aH * 0.35);
  ctx.lineTo(0, aH * 0.25);
  ctx.moveTo(-G * 0.5, -aH * 0.12);
  ctx.lineTo(G * 0.5, -aH * 0.12);
  ctx.stroke();
  if (corruption > 0.5) {
    ctx.strokeStyle = `rgba(200,30,0,${(corruption - 0.5) * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
});

// ── Candle ─────────────────────────────────────────────────────
// Wax body with wick and animated teardrop flame.
registerRenderer("candle", (ctx, x, y, G, drawable, _entity, world) => {
  const data = drawable.data ?? {};
  const hue = (data["hue"] as number) ?? 40;
  const heightMul = (data["height"] as number) ?? 1;
  const flicker = (data["flicker"] as number) ?? 0;
  const now = world.time.now;

  const cx = x + G / 2;
  const baseY = y + G;
  const cH = G * 1.2 * heightMul;
  const cW = G * 0.35;
  const topY = baseY - cH;

  // Wax body
  ctx.fillStyle = `hsl(${hue + 10},20%,70%)`;
  ctx.beginPath();
  ctx.roundRect(cx - cW, topY, cW * 2, cH, [3, 3, 1, 1]);
  ctx.fill();

  // Wick
  ctx.strokeStyle = "#1a0a00";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx, topY - 5);
  ctx.stroke();

  // Flame
  const flick =
    Math.sin(now * 0.012 + flicker) * 2 +
    Math.sin(now * 0.023 + flicker * 2);
  const fH = 8 + Math.sin(now * 0.008 + flicker) * 3;
  const fCx = cx + flick * 0.5;
  const fCy = topY - 5;

  // Flame body (bezier teardrop)
  const fG = ctx.createLinearGradient(fCx, fCy, fCx, fCy - fH);
  fG.addColorStop(0, "hsla(30,100%,50%,0.95)");
  fG.addColorStop(0.3, "hsla(45,100%,60%,0.9)");
  fG.addColorStop(0.7, "hsla(50,100%,80%,0.7)");
  fG.addColorStop(1, "hsla(55,100%,95%,0.3)");
  ctx.fillStyle = fG;
  ctx.beginPath();
  ctx.moveTo(fCx, fCy);
  ctx.bezierCurveTo(
    fCx - 5, fCy - fH * 0.3,
    fCx - 4 + flick * 0.3, fCy - fH * 0.8,
    fCx + flick * 0.4, fCy - fH,
  );
  ctx.bezierCurveTo(
    fCx + 4 + flick * 0.3, fCy - fH * 0.8,
    fCx + 5, fCy - fH * 0.3,
    fCx, fCy,
  );
  ctx.fill();

  // Bright core
  ctx.fillStyle = "hsla(55,100%,95%,0.5)";
  ctx.beginPath();
  ctx.ellipse(fCx, fCy - fH * 0.25, 2, fH * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
});

// ── Hellfire ───────────────────────────────────────────────────
// Delegates to shared drawHellfireEffect. Size boosted 50%.
registerRenderer("hellfire", (ctx, x, y, G, drawable, _entity, world) => {
  const data = drawable.data ?? {};
  const hue = (data["hue"] as number) ?? 15;
  const flicker = (data["flicker"] as number) ?? 0;
  drawHellfireEffect(
    ctx,
    x + G / 2,
    y + G / 2,
    G * 1.8,     // 50% larger than original G*1.2
    hue,
    flicker,
    world.time.now,
  );
});

// ── Snake Head ─────────────────────────────────────────────────
// Rounded green rectangle with directional eyes + pupils.
registerRenderer("snakeHead", (ctx, x, y, G, drawable, entity, world) => {
  const data = drawable.data ?? {};
  const headColor = (data["color"] as string) ?? "hsl(115,70%,38%)";
  const eyeColor = (data["eyeColor"] as string) ?? "#1a0a0a";

  const vel = world.get(entity, "velocity");
  const dirX = vel?.dx ?? 1;
  const dirY = vel?.dy ?? 0;

  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, G - 2, G - 2, 5);
  ctx.fill();

  const eS = 3;
  const eOX = dirX === 0 ? 5 : dirX > 0 ? 12 : 5;
  const eOY = dirY === 0 ? 5 : dirY > 0 ? 12 : 5;
  const eOX2 = dirX === 0 ? 12 : eOX;
  const eOY2 = dirY === 0 ? 12 : eOY;

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(x + eOX, y + eOY, eS, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + eOX2, y + eOY2, eS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a0a00";
  ctx.beginPath();
  ctx.arc(x + eOX + dirX, y + eOY + dirY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + eOX2 + dirX, y + eOY2 + dirY, 1.5, 0, Math.PI * 2);
  ctx.fill();
});

// ── Snake Segment ──────────────────────────────────────────────
registerRenderer("snakeSegment", (ctx, x, y, G, drawable) => {
  const data = drawable.data ?? {};
  const color = (data["color"] as string) ?? "hsl(120,55%,32%)";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, G - 3, G - 3, 3);
  ctx.fill();
});

// ── Statue ─────────────────────────────────────────────────────
registerRenderer("statue", (ctx, x, y, G, drawable) => {
  const data = drawable.data ?? {};
  const side = (data["side"] as number) ?? 0;
  const crying = (data["crying"] as boolean) ?? false;
  const corruption = (data["corruption"] as number) ?? 0;

  const sx = x + G / 2;
  const sy = y + G / 2;
  const r = G * 0.4;
  const headDir = side === 0 ? 1 : -1;

  ctx.fillStyle = "#3a3530";
  ctx.fillRect(x + 2, y + 2, G - 4, G - 4);

  const figHue = crying ? 0 : 30;
  const figSat = crying ? 10 : 6;
  const figLum = crying ? 32 : 40;
  ctx.fillStyle = `hsl(${figHue},${figSat}%,${figLum}%)`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, r * 0.7, r, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${figHue},${figSat}%,${figLum + 5}%)`;
  ctx.beginPath();
  ctx.arc(sx + headDir * r * 0.15, sy - r * 0.55, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  if (corruption < 0.7) {
    const haloA = 0.2 * (1 - corruption);
    ctx.strokeStyle = `rgba(210,190,120,${haloA})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
      sx + headDir * r * 0.15,
      sy - r * 0.55,
      r * 0.55,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  if (crying) {
    const tearA = (data["tearY"] as number) ?? 0.5;
    const headX = sx + headDir * r * 0.15;
    const headY = sy - r * 0.55;
    for (const eOff of [-0.12, 0.12]) {
      ctx.fillStyle = `rgba(120,0,0,${tearA * 0.8})`;
      ctx.beginPath();
      ctx.arc(headX + eOff * G, headY, 1.2, 0, Math.PI * 2);
      ctx.fill();
      const tearLen = tearA * r * 1.8;
      ctx.fillStyle = `rgba(100,0,0,${tearA * 0.6})`;
      ctx.fillRect(headX + eOff * G - 0.8, headY, 1.6, tearLen);
    }
  }
});

// ── Stained Glass ──────────────────────────────────────────────
registerRenderer("stainedGlass", (ctx, x, y, G, drawable) => {
  const data = drawable.data ?? {};
  const hue = (data["hue"] as number) ?? 200;
  const corruption = (data["corruption"] as number) ?? 0;
  const wH = G * 2.5;

  ctx.fillStyle = "#1a1210";
  ctx.fillRect(x, y - wH * 0.5, G, wH);

  const panels = 4;
  for (let i = 0; i < panels; i++) {
    const panelY = y - wH * 0.4 + ((wH * 0.8) / panels) * i;
    const panelH = (wH * 0.8) / panels - 2;
    const origHue = (hue + i * 70) % 360;
    const h = origHue + (10 - origHue) * corruption;
    const sat = 55 + corruption * 35;
    const lum = 30 + corruption * 22;
    const alpha = 0.15 + corruption * 0.25;
    ctx.fillStyle = `hsla(${h},${sat}%,${lum}%,${alpha})`;
    ctx.fillRect(x + 1, panelY, G - 2, panelH);
    ctx.fillStyle = `hsla(${h},${sat + 10}%,${lum + 15}%,${alpha * 0.5})`;
    ctx.fillRect(x + 3, panelY + 2, G - 6, panelH - 4);
  }
});

// ── Crack ──────────────────────────────────────────────────────
registerRenderer("crack", (ctx, x, y, G, drawable, _entity, world) => {
  const data = drawable.data ?? {};
  const angle = (data["angle"] as number) ?? 0;
  const len = (data["len"] as number) ?? 0.5;
  const corruption = (data["corruption"] as number) ?? 0;
  const hasBranch = (data["branch"] as boolean) ?? false;
  const branchAngle = (data["branchAngle"] as number) ?? 0;
  const now = world.time.now;

  const cx = x + G / 2;
  const cy = y + G / 2;
  const ex = cx + Math.cos(angle) * len * G;
  const ey = cy + Math.sin(angle) * len * G;

  const glowA =
    0.25 + corruption * 0.35 + Math.sin(now * 0.003 + angle) * 0.08;
  ctx.strokeStyle = `rgba(200,40,0,${glowA})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.strokeStyle = "rgba(10,0,0,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  if (hasBranch) {
    const mx = (cx + ex) / 2;
    const my = (cy + ey) / 2;
    const bAngle = angle + branchAngle;
    const bx = mx + Math.cos(bAngle) * len * G * 0.4;
    const by = my + Math.sin(bAngle) * len * G * 0.4;
    ctx.strokeStyle = `rgba(140,20,0,${glowA * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = "rgba(10,0,0,0.5)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
});

// ── Blood Pool ─────────────────────────────────────────────────
registerRenderer("bloodPool", (ctx, x, y, G, drawable) => {
  const data = drawable.data ?? {};
  const alpha = (data["alpha"] as number) ?? 0.3;
  const radius = (data["radius"] as number) ?? 0.5;
  const angle = (data["angle"] as number) ?? 0;

  const bx = x + G / 2;
  const by = y + G / 2;
  const br = radius * G;

  const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
  grad.addColorStop(0, `rgba(70,0,0,${alpha})`);
  grad.addColorStop(0.6, `rgba(45,0,0,${alpha * 0.5})`);
  grad.addColorStop(1, "rgba(30,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(bx, by, br, br * 0.7, angle, 0, Math.PI * 2);
  ctx.fill();
});

// ── Pentagram ──────────────────────────────────────────────────
// Circle + star with configurable hue and rotation. Hellfire at each vertex.
// data.rotation: current rotation in radians (updated externally by systems)
registerRenderer("pentagram", (ctx, x, y, G, drawable, _entity, world) => {
  const data = drawable.data ?? {};
  const radius = (data["radius"] as number) ?? 3;
  const growth = (data["growth"] as number) ?? 1;
  const corruption = (data["corruption"] as number) ?? 0;
  const hue = (data["hue"] as number) ?? 355;
  const rotation = (data["rotation"] as number) ?? 0;
  const now = world.time.now;

  const cx = x + G / 2;
  const cy = y + G / 2;
  const r = radius * G * growth;
  const a = Math.min(growth * 1.5, 0.75);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.globalAlpha = a;

  // Outer circle
  ctx.strokeStyle = `hsl(${hue},75%,${26 + corruption * 20}%)`;
  ctx.lineWidth = 1.5 + corruption * 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle
  if (growth > 0.15) {
    ctx.strokeStyle = `hsl(${hue},70%,${22 + corruption * 15}%)`;
    ctx.lineWidth = 1 + corruption * 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Star vertices (in rotated space)
  const verts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 5; i++) {
    const vAngle = (i * 2 * Math.PI) / 5 + Math.PI / 2;
    verts.push({
      x: Math.cos(vAngle) * r * 0.85,
      y: Math.sin(vAngle) * r * 0.85,
    });
  }

  // Star lines
  if (growth > 0.08) {
    const order = [0, 2, 4, 1, 3, 0];
    ctx.strokeStyle = `hsl(${hue},90%,${30 + corruption * 18}%)`;
    ctx.lineWidth = 1.5 + corruption * 1.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const from = verts[order[i]!]!;
      const to = verts[order[i + 1]!]!;
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  // Hellfire at each vertex (screen space — rotate verts manually)
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  for (let i = 0; i < 5; i++) {
    const v = verts[i]!;
    const sx = cx + v.x * cosR - v.y * sinR;
    const sy = cy + v.x * sinR + v.y * cosR;
    drawHellfireEffect(
      ctx,
      sx,
      sy,
      G * 1.2,
      hue,
      i * 7.1,
      now,
      3,
      a * 0.8,
    );
  }
});

// ── Floor Tile ─────────────────────────────────────────────────
registerRenderer("tile", (ctx, x, y, G) => {
  const seed = hash(x * 7.3 + y * 13.1);
  const lum = 8 + seed * 4;
  ctx.fillStyle = `hsl(270,5%,${lum}%)`;
  ctx.fillRect(x, y, G, G);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, G - 1, G - 1);
});
