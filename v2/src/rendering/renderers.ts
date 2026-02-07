import type { Drawable, EntityId } from "../core/types.js";
import type { World } from "../core/World.js";
import type { DrawableDataMap, DrawableType } from "./drawableData.js";

// Internal: the wrapper that RenderSystem calls with the full Drawable.
type InternalRendererFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridSize: number,
  drawable: Drawable,
  entity: EntityId,
  world: World,
) => void;

// Public: renderer callbacks receive typed data directly (no cast needed).
// G = gridSize (px per tile). Short name for Canvas2D math density.
export type RendererFn<T extends DrawableType = DrawableType> = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  G: number,
  data: DrawableDataMap[T],
  entity: EntityId,
  world: World,
) => void;

const registry = new Map<string, InternalRendererFn>();

export function registerRenderer<T extends DrawableType>(
  type: T,
  fn: RendererFn<T>,
): void {
  registry.set(type, (ctx, x, y, gs, drawable, entity, world) => {
    fn(ctx, x, y, gs, drawable.data as DrawableDataMap[T], entity, world);
  });
}

export function getRenderer(type: string): InternalRendererFn | undefined {
  return registry.get(type);
}

// ── Shared constants ────────────────────────────────────────────

// Deterministic pseudo-random from seed
function hash(n: number): number {
  let x = Math.sin(n * 127.1 + n * 311.7) * 43758.5453;
  x -= Math.floor(x);
  return x;
}

// ── Fire / Hellfire constants ───────────────────────────────────
const GLOW_PULSE_SPEED = 0.006;
const GLOW_PULSE_AMPLITUDE = 0.1;
const GLOW_BASE_INTENSITY = 0.5;
const GLOW_RADIUS_RATIO = 0.9;
const FLAME_ANGLE_WOBBLE_SPEED = 0.008;
const FLAME_ANGLE_WOBBLE_AMOUNT = 0.5;
const FLAME_DIST_BASE = 0.08;
const FLAME_DIST_OSCILLATION_SPEED = 0.01;
const FLAME_DIST_OSCILLATION_AMOUNT = 0.06;
const FLAME_HEIGHT_BASE = 0.5;
const FLAME_HEIGHT_OSCILLATION_SPEED = 0.012;
const FLAME_HEIGHT_OSCILLATION_AMOUNT = 0.18;
const FLAME_WIDTH_RATIO = 0.18;
const FLAME_HUE_OSCILLATION_SPEED = 0.01;
const FLAME_HUE_VARIATION = 10;
const FLAME_BASE_ALPHA = 0.85;
const FLAME_MID_ALPHA = 0.6;
const FLAME_FLICKER_SPEED = 0.015;
const FLAME_CORE_ALPHA = 0.3;
const FLAME_CORE_RADIUS = 0.1;
const HELLFIRE_SIZE_MULTIPLIER = 1.8;

// ── Pew constants ───────────────────────────────────────────────
const WOOD_BASE_HUE = 25;
const WOOD_HUE_VARIATION = 8;
const WOOD_BASE_SATURATION = 40;
const WOOD_SAT_VARIATION = 15;
const WOOD_BASE_LIGHTNESS = 28;
const WOOD_LIGHT_VARIATION = 8;
const CHAR_SATURATION_LOSS = 0.6;
const CHAR_LIGHTNESS_LOSS = 0.7;
const GRAIN_SPACING_RATIO = 0.25;
const GRAIN_WAVE_AMPLITUDE = 1.5;
const GRAIN_ALPHA = 0.4;
const RAIL_HUE_OFFSET = 3;
const RAIL_SAT_OFFSET = 5;
const RAIL_LIGHT_BOOST = 10;
const SHADOW_LIGHT_DROP = 10;
const PEW_FLAMES_PER_TILE = 3;
const CROSS_DETAIL_ALPHA = 0.3;

// ── Altar constants ─────────────────────────────────────────────
const TRIM_BASE_ALPHA = 0.5;
const TRIM_CORRUPTION_FADE = 0.3;
const CLOTH_CORRUPTION_TRANSITION = 0.4;
const CROSS_INVERSION_START = 0.55;
const CROSS_INVERSION_RATE = 2.2;
const CROSS_BASE_ALPHA = 0.45;
const CROSS_ALPHA_CORRUPTION_FADE = 0.2;
const CROSS_MIN_ALPHA = 0.08;
const BLOOD_GLOW_THRESHOLD = 0.5;

// ── Candle constants ────────────────────────────────────────────
const CANDLE_BODY_WIDTH_RATIO = 0.35;
const CANDLE_BODY_HEIGHT_RATIO = 1.2;
const WICK_LENGTH = 5;
const CANDLE_FLICKER_SPEED_PRIMARY = 0.012;
const CANDLE_FLICKER_SPEED_SECONDARY = 0.023;
const CANDLE_FLAME_HEIGHT_BASE = 8;
const CANDLE_FLAME_HEIGHT_SPEED = 0.008;
const CANDLE_FLAME_HEIGHT_VARIATION = 3;

// ── Stained glass constants ─────────────────────────────────────
const WINDOW_HEIGHT_RATIO = 2.5;
const WINDOW_PANEL_COUNT = 4;
const PANEL_HUE_STEP = 70;
const BEAM_PULSE_SPEED = 0.001;
const BEAM_CORRUPTION_TARGET_HUE = 10;
const BEAM_HUE_OSCILLATION = 8;
const BEAM_BASE_ALPHA = 0.08;
const BEAM_CORRUPTION_ALPHA = 0.06;
const BEAM_PHASE_OFFSET = 1.7;
const BEAM_PULSE_AMPLITUDE = 0.012;
const BEAM_BASE_REACH = 5;
const BEAM_CORRUPTION_REACH = 5;
const BEAM_SPREAD_PER_PANEL = 0.8;
const BEAM_CORE_RATIO = 0.4;
const GLASS_BASE_SATURATION = 65;
const GLASS_BASE_LIGHTNESS = 45;
const GLASS_BASE_ALPHA = 0.55;
const GLASS_CORRUPTION_ALPHA_BOOST = 0.3;
const GLASS_SHIMMER_SPEED = 0.002;
const GLASS_SHIMMER_AMPLITUDE = 0.03;

// ── Crack constants ─────────────────────────────────────────────
const CRACK_GLOW_BASE = 0.25;
const CRACK_GLOW_CORRUPTION_BOOST = 0.35;
const CRACK_GLOW_PULSE_SPEED = 0.003;
const CRACK_GLOW_PULSE_AMPLITUDE = 0.08;
const CRACK_BRANCH_LENGTH_RATIO = 0.4;
const CRACK_BRANCH_GLOW_RATIO = 0.7;

// ── Blood pool constants ────────────────────────────────────────
const BLOOD_ELLIPSE_RATIO = 0.7;

// ── Pentagram constants ─────────────────────────────────────────
const PENTAGRAM_MAX_ALPHA = 0.75;
const PENTAGRAM_ALPHA_RAMP = 1.5;
const PENTAGRAM_INNER_RADIUS_RATIO = 0.6;
const PENTAGRAM_INNER_CIRCLE_THRESHOLD = 0.15;
const PENTAGRAM_STAR_THRESHOLD = 0.08;
const PENTAGRAM_VERTEX_RADIUS_RATIO = 0.85;
const PENTAGRAM_VERTEX_FIRE_SIZE = 1.2;
const PENTAGRAM_VERTEX_FIRE_ALPHA = 0.8;

// ── Statue constants ────────────────────────────────────────────
const STATUE_FIGURE_RADIUS = 0.4;
const STATUE_HEAD_OFFSET_X = 0.15;
const STATUE_HEAD_OFFSET_Y = 0.55;
const STATUE_HEAD_RADIUS = 0.35;
const STATUE_HALO_ALPHA = 0.2;
const STATUE_HALO_RADIUS = 0.55;
const STATUE_HALO_CORRUPTION_LIMIT = 0.7;
const STATUE_EYE_OFFSET = 0.12;
const STATUE_TEAR_LENGTH_RATIO = 1.8;

// ── Floor/wall constants ────────────────────────────────────────
const FLOOR_BASE_LIGHTNESS = 8;
const FLOOR_LIGHT_VARIATION = 4;
const WALL_BASE_LIGHTNESS = 12;
const WALL_LIGHT_VARIATION = 3;
const MORTAR_BASE_ALPHA = 0.4;
const MORTAR_ALPHA_VARIATION = 0.15;
const MORTAR_Y_BASE = 0.45;
const MORTAR_Y_VARIATION = 0.1;
const SPECKLE_BASE_ALPHA = 0.15;
const SPECKLE_ALPHA_VARIATION = 0.1;

// ═════════════════════════════════════════════════════════════════
// Shared hellfire effect: radial glow + bezier flame tongues.
// Used by hellfire renderer, burning pews, and pentagram vertices.
// ═════════════════════════════════════════════════════════════════

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
  const glowIntensity =
    (GLOW_BASE_INTENSITY + Math.sin(now * GLOW_PULSE_SPEED + flicker) * GLOW_PULSE_AMPLITUDE) *
    alpha;
  const gR = size * GLOW_RADIUS_RATIO;
  const gGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, gR);
  gGrad.addColorStop(0, `rgba(255,60,0,${glowIntensity * 0.5})`);
  gGrad.addColorStop(0.5, `rgba(200,20,0,${glowIntensity * 0.2})`);
  gGrad.addColorStop(1, "rgba(100,0,0,0)");
  ctx.fillStyle = gGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, gR, 0, Math.PI * 2);
  ctx.fill();

  // Flame tongues
  for (let i = 0; i < flames; i++) {
    const theta = hash(flicker * 13.7 + i * 91.3) * Math.PI * 2;
    const angle =
      (i / flames) * Math.PI * 2 +
      Math.sin(now * FLAME_ANGLE_WOBBLE_SPEED + theta) * FLAME_ANGLE_WOBBLE_AMOUNT;
    const dist =
      size * FLAME_DIST_BASE +
      Math.sin(now * FLAME_DIST_OSCILLATION_SPEED + theta * 1.3) * size * FLAME_DIST_OSCILLATION_AMOUNT;
    const fx = cx + Math.cos(angle) * dist;
    const fy = cy + Math.sin(angle) * dist;
    const fH =
      (size * FLAME_HEIGHT_BASE +
        Math.sin(now * FLAME_HEIGHT_OSCILLATION_SPEED + theta * 0.7) *
          size *
          FLAME_HEIGHT_OSCILLATION_AMOUNT) *
      alpha;
    const fW = size * FLAME_WIDTH_RATIO;
    const fHue =
      hue + Math.sin(now * FLAME_HUE_OSCILLATION_SPEED + theta * 1.1) * FLAME_HUE_VARIATION;
    const fGrad = ctx.createLinearGradient(fx, fy, fx, fy - fH);
    fGrad.addColorStop(0, `hsla(${fHue},100%,50%,${FLAME_BASE_ALPHA * alpha})`);
    fGrad.addColorStop(0.4, `hsla(${fHue + 20},100%,58%,${FLAME_MID_ALPHA * alpha})`);
    fGrad.addColorStop(1, `hsla(${fHue + 35},100%,75%,0)`);
    ctx.fillStyle = fGrad;
    const flk = Math.sin(now * FLAME_FLICKER_SPEED + theta * 0.9) * fW * 0.5;
    ctx.beginPath();
    ctx.moveTo(fx - fW, fy);
    ctx.bezierCurveTo(fx - fW * 0.5, fy - fH * 0.4, fx + flk - fW * 0.3, fy - fH * 0.8, fx + flk, fy - fH);
    ctx.bezierCurveTo(fx + flk + fW * 0.3, fy - fH * 0.8, fx + fW * 0.5, fy - fH * 0.4, fx + fW, fy);
    ctx.fill();
  }

  // Bright core
  ctx.fillStyle = `rgba(255,200,100,${FLAME_CORE_ALPHA * alpha})`;
  ctx.beginPath();
  ctx.arc(cx, cy, size * FLAME_CORE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

// ── Pew ────────────────────────────────────────────────────────
registerRenderer("pew", (ctx, x, y, G, data, entity, world) => {
  const flammable = world.get(entity, "flammable");
  const burning = flammable?.burning ?? false;
  const now = world.time.now;

  const seed = hash(data.dx * 31.7 + data.row * 17.3);
  const woodH = WOOD_BASE_HUE + seed * WOOD_HUE_VARIATION;
  const baseS = WOOD_BASE_SATURATION + seed * WOOD_SAT_VARIATION;
  const baseL = WOOD_BASE_LIGHTNESS + seed * WOOD_LIGHT_VARIATION;

  if (burning) {
    const burnDuration = flammable?.burnDuration ?? 3500;
    const bt = Math.min((flammable?.burnT ?? 0) / burnDuration, 1);
    const woodS = baseS * (1 - bt * CHAR_SATURATION_LOSS);
    const woodL = baseL * (1 - bt * CHAR_LIGHTNESS_LOSS);
    ctx.fillStyle = `hsl(${woodH},${woodS}%,${woodL}%)`;
    ctx.fillRect(x + 1, y + 1, G - 2, G - 2);
    // Top rail (charred)
    ctx.fillStyle = `hsl(${woodH + RAIL_HUE_OFFSET},${Math.max(woodS - RAIL_SAT_OFFSET, 0)}%,${Math.max(woodL - 3, 4)}%)`;
    ctx.fillRect(x + 2, y + 1, G - 4, 3);
    // Grain lines (fading as it chars)
    if (bt < 0.9) {
      ctx.strokeStyle = `hsla(${woodH - 5},${woodS}%,${Math.max(woodL - 8, 2)}%,${GRAIN_ALPHA * (1 - bt)})`;
      ctx.lineWidth = 0.5;
      for (let g = 0; g < 3; g++) {
        const gy = y + 4 + g * (G * GRAIN_SPACING_RATIO);
        ctx.beginPath();
        ctx.moveTo(x + 2, gy);
        ctx.lineTo(x + G - 2, gy + Math.sin(seed + g) * GRAIN_WAVE_AMPLITUDE);
        ctx.stroke();
      }
    }
    drawHellfireEffect(
      ctx,
      x + G / 2,
      y + G / 2,
      G * HELLFIRE_SIZE_MULTIPLIER,
      data.fireHue,
      data.dx * 1.7,
      now,
      PEW_FLAMES_PER_TILE,
      bt,
    );
  } else {
    ctx.fillStyle = `hsl(${woodH},${baseS}%,${baseL}%)`;
    ctx.fillRect(x + 1, y + 1, G - 2, G - 2);
    ctx.fillStyle = `hsl(${woodH + RAIL_HUE_OFFSET},${baseS - RAIL_SAT_OFFSET}%,${baseL + RAIL_LIGHT_BOOST}%)`;
    ctx.fillRect(x + 2, y + 1, G - 4, 3);
    ctx.strokeStyle = `hsla(${woodH - 5},${baseS}%,${baseL - 8}%,${GRAIN_ALPHA})`;
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 3; g++) {
      const gy = y + 4 + g * (G * GRAIN_SPACING_RATIO);
      ctx.beginPath();
      ctx.moveTo(x + 2, gy);
      ctx.lineTo(x + G - 2, gy + Math.sin(seed + g) * GRAIN_WAVE_AMPLITUDE);
      ctx.stroke();
    }
    ctx.fillStyle = `hsl(${woodH},${baseS}%,${baseL - SHADOW_LIGHT_DROP}%)`;
    ctx.fillRect(x + 1, y + G - 3, G - 2, 2);
  }

  // End caps with cross detail
  if (data.dx === 0 || data.dx === data.width - 1) {
    const capLum = burning ? 12 : 35;
    ctx.fillStyle = `hsl(22,40%,${capLum}%)`;
    ctx.fillRect(data.dx === 0 ? x + 1 : x + G - 4, y + 1, 3, G - 2);
    if (!burning) {
      const capX = data.dx === 0 ? x + 2.5 : x + G - 2.5;
      ctx.strokeStyle = `rgba(200,160,80,${CROSS_DETAIL_ALPHA})`;
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
registerRenderer("altar", (ctx, x, y, G, data) => {
  const aW = data.tileW * G;
  const aH = data.tileH * G;
  const c = data.corruption;

  // Stone base
  ctx.fillStyle = "#3d2d25";
  ctx.fillRect(x + 2, y + 2, aW - 4, aH - 2);
  ctx.strokeStyle = "rgba(80,60,45,0.3)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < data.tileH; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + i * G);
    ctx.lineTo(x + aW - 4, y + i * G + Math.sin(i * 3.7) * 2);
    ctx.stroke();
  }

  // Gold trim
  const trimAlpha = TRIM_BASE_ALPHA - c * TRIM_CORRUPTION_FADE;
  ctx.strokeStyle = `rgba(210,175,90,${trimAlpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 3, y + 3, aW - 6, aH - 4);
  ctx.strokeStyle = `rgba(180,145,70,${trimAlpha * 0.6})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 6, y + 6, aW - 12, aH - 10);

  // Cloth
  const clothH = 6;
  const clothHue = c > CLOTH_CORRUPTION_TRANSITION ? 0 : 120 - c * 200;
  ctx.fillStyle = `hsl(${clothHue},${25 + c * 45}%,${18 + c * 6}%)`;
  ctx.fillRect(x + 8, y + aH - clothH - 2, aW - 16, clothH);
  ctx.fillStyle = `rgba(210,175,90,${trimAlpha * 0.7})`;
  ctx.fillRect(x + 8, y + aH - clothH - 2, aW - 16, 1.5);

  // Cross — inverts with corruption
  const crossX = x + aW / 2;
  const crossY = y + aH * 0.5;
  ctx.save();
  ctx.translate(crossX, crossY);
  const inv =
    c > CROSS_INVERSION_START
      ? Math.min((c - CROSS_INVERSION_START) * CROSS_INVERSION_RATE, 1)
      : 0;
  ctx.rotate(Math.PI * inv);
  ctx.strokeStyle = `rgba(210,175,90,${Math.max(CROSS_BASE_ALPHA - c * CROSS_ALPHA_CORRUPTION_FADE, CROSS_MIN_ALPHA)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -aH * 0.35);
  ctx.lineTo(0, aH * 0.25);
  ctx.moveTo(-G * 0.5, -aH * 0.12);
  ctx.lineTo(G * 0.5, -aH * 0.12);
  ctx.stroke();
  if (c > BLOOD_GLOW_THRESHOLD) {
    ctx.strokeStyle = `rgba(200,30,0,${(c - BLOOD_GLOW_THRESHOLD) * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
});

// ── Candle ─────────────────────────────────────────────────────
registerRenderer("candle", (ctx, x, y, G, data, _entity, world) => {
  const now = world.time.now;

  const cx = x + G / 2;
  const baseY = y + G;
  const cH = G * CANDLE_BODY_HEIGHT_RATIO * data.height;
  const cW = G * CANDLE_BODY_WIDTH_RATIO;
  const topY = baseY - cH;

  // Wax body
  ctx.fillStyle = `hsl(${data.hue + 10},20%,70%)`;
  ctx.beginPath();
  ctx.roundRect(cx - cW, topY, cW * 2, cH, [3, 3, 1, 1]);
  ctx.fill();

  // Wick
  ctx.strokeStyle = "#1a0a00";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx, topY - WICK_LENGTH);
  ctx.stroke();

  // Flame
  const flick =
    Math.sin(now * CANDLE_FLICKER_SPEED_PRIMARY + data.flicker) * 2 +
    Math.sin(now * CANDLE_FLICKER_SPEED_SECONDARY + data.flicker * 2);
  const fH =
    CANDLE_FLAME_HEIGHT_BASE +
    Math.sin(now * CANDLE_FLAME_HEIGHT_SPEED + data.flicker) * CANDLE_FLAME_HEIGHT_VARIATION;
  const fCx = cx + flick * 0.5;
  const fCy = topY - WICK_LENGTH;

  const fG = ctx.createLinearGradient(fCx, fCy, fCx, fCy - fH);
  fG.addColorStop(0, "hsla(30,100%,50%,0.95)");
  fG.addColorStop(0.3, "hsla(45,100%,60%,0.9)");
  fG.addColorStop(0.7, "hsla(50,100%,80%,0.7)");
  fG.addColorStop(1, "hsla(55,100%,95%,0.3)");
  ctx.fillStyle = fG;
  ctx.beginPath();
  ctx.moveTo(fCx, fCy);
  ctx.bezierCurveTo(fCx - 5, fCy - fH * 0.3, fCx - 4 + flick * 0.3, fCy - fH * 0.8, fCx + flick * 0.4, fCy - fH);
  ctx.bezierCurveTo(fCx + 4 + flick * 0.3, fCy - fH * 0.8, fCx + 5, fCy - fH * 0.3, fCx, fCy);
  ctx.fill();

  // Bright core
  ctx.fillStyle = "hsla(55,100%,95%,0.5)";
  ctx.beginPath();
  ctx.ellipse(fCx, fCy - fH * 0.25, 2, fH * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
});

// ── Hellfire ───────────────────────────────────────────────────
registerRenderer("hellfire", (ctx, x, y, G, data, _entity, world) => {
  drawHellfireEffect(ctx, x + G / 2, y + G / 2, G * HELLFIRE_SIZE_MULTIPLIER, data.hue, data.flicker, world.time.now);
});

// ── Snake Head ─────────────────────────────────────────────────
registerRenderer("snakeHead", (ctx, x, y, G, data, entity, world) => {
  const vel = world.get(entity, "velocity");
  const dirX = vel?.dx ?? 1;
  const dirY = vel?.dy ?? 0;

  ctx.fillStyle = data.color;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, G - 2, G - 2, 5);
  ctx.fill();

  const eS = 3;
  const eOX = dirX === 0 ? 5 : dirX > 0 ? 12 : 5;
  const eOY = dirY === 0 ? 5 : dirY > 0 ? 12 : 5;
  const eOX2 = dirX === 0 ? 12 : eOX;
  const eOY2 = dirY === 0 ? 12 : eOY;

  ctx.fillStyle = data.eyeColor;
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
registerRenderer("snakeSegment", (ctx, x, y, G, data) => {
  ctx.fillStyle = data.color;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, G - 3, G - 3, 3);
  ctx.fill();
});

// ── Statue ─────────────────────────────────────────────────────
registerRenderer("statue", (ctx, x, y, G, data) => {
  const sx = x + G / 2;
  const sy = y + G / 2;
  const r = G * STATUE_FIGURE_RADIUS;
  const headDir = data.side === 0 ? 1 : -1;

  ctx.fillStyle = "#3a3530";
  ctx.fillRect(x + 2, y + 2, G - 4, G - 4);

  const figHue = data.crying ? 0 : 30;
  const figSat = data.crying ? 10 : 6;
  const figLum = data.crying ? 32 : 40;
  ctx.fillStyle = `hsl(${figHue},${figSat}%,${figLum}%)`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, r * 0.7, r, 0, 0, Math.PI * 2);
  ctx.fill();

  const headX = sx + headDir * r * STATUE_HEAD_OFFSET_X;
  const headY = sy - r * STATUE_HEAD_OFFSET_Y;
  ctx.fillStyle = `hsl(${figHue},${figSat}%,${figLum + 5}%)`;
  ctx.beginPath();
  ctx.arc(headX, headY, r * STATUE_HEAD_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  if (data.corruption < STATUE_HALO_CORRUPTION_LIMIT) {
    const haloA = STATUE_HALO_ALPHA * (1 - data.corruption);
    ctx.strokeStyle = `rgba(210,190,120,${haloA})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(headX, headY, r * STATUE_HALO_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (data.crying) {
    const tearA = data.tearY;
    for (const eOff of [-STATUE_EYE_OFFSET, STATUE_EYE_OFFSET]) {
      ctx.fillStyle = `rgba(120,0,0,${tearA * 0.8})`;
      ctx.beginPath();
      ctx.arc(headX + eOff * G, headY, 1.2, 0, Math.PI * 2);
      ctx.fill();
      const tearLen = tearA * r * STATUE_TEAR_LENGTH_RATIO;
      ctx.fillStyle = `rgba(100,0,0,${tearA * 0.6})`;
      ctx.fillRect(headX + eOff * G - 0.8, headY, 1.6, tearLen);
    }
  }
});

// ── Stained Glass ──────────────────────────────────────────────
registerRenderer("stainedGlass", (ctx, x, y, G, data, _entity, world) => {
  const now = world.time.now;
  const c = data.corruption;
  const wH = G * WINDOW_HEIGHT_RATIO;

  const castDir = data.side === 0 ? 1 : -1;
  const beamOriginX = x + (data.side === 0 ? G : 0);
  const beamLen = G * (BEAM_BASE_REACH + c * BEAM_CORRUPTION_REACH);

  // Per-panel light beams (drawn before window frame)
  ctx.save();
  for (let i = 0; i < WINDOW_PANEL_COUNT; i++) {
    const panelY = y - wH * 0.4 + ((wH * 0.8) / WINDOW_PANEL_COUNT) * i;
    const panelH = (wH * 0.8) / WINDOW_PANEL_COUNT - 2;
    const panelCy = panelY + panelH * 0.5;
    const halfH = panelH * 0.5;
    const spread = G * BEAM_SPREAD_PER_PANEL;

    const origHue = (data.hue + i * PANEL_HUE_STEP) % 360;
    const targetHue = BEAM_CORRUPTION_TARGET_HUE + Math.sin(now * BEAM_PULSE_SPEED + i) * BEAM_HUE_OSCILLATION;
    const h = origHue + (targetHue - origHue) * c;
    const lightAlpha =
      BEAM_BASE_ALPHA + c * BEAM_CORRUPTION_ALPHA + Math.sin(now * BEAM_PULSE_SPEED + i * BEAM_PHASE_OFFSET) * BEAM_PULSE_AMPLITUDE;

    const farX = beamOriginX + castDir * beamLen;

    // Outer beam
    ctx.beginPath();
    ctx.moveTo(beamOriginX, panelCy - halfH);
    ctx.lineTo(beamOriginX, panelCy + halfH);
    ctx.lineTo(farX, panelCy + spread);
    ctx.lineTo(farX, panelCy - spread);
    ctx.closePath();
    const bGrad = ctx.createLinearGradient(beamOriginX, panelCy, farX, panelCy);
    bGrad.addColorStop(0, `hsla(${h},${50 + c * 40}%,${35 + c * 20}%,${lightAlpha * 1.8})`);
    bGrad.addColorStop(0.3, `hsla(${h},${45 + c * 35}%,${30 + c * 15}%,${lightAlpha})`);
    bGrad.addColorStop(0.7, `hsla(${h},${40 + c * 30}%,${25 + c * 10}%,${lightAlpha * 0.4})`);
    bGrad.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = bGrad;
    ctx.fill();

    // Core beam (narrower, brighter)
    const coreHalf = halfH * BEAM_CORE_RATIO;
    const coreSpread = spread * BEAM_CORE_RATIO;
    ctx.beginPath();
    ctx.moveTo(beamOriginX, panelCy - coreHalf);
    ctx.lineTo(beamOriginX, panelCy + coreHalf);
    ctx.lineTo(farX, panelCy + coreSpread);
    ctx.lineTo(farX, panelCy - coreSpread);
    ctx.closePath();
    const cGrad = ctx.createLinearGradient(beamOriginX, panelCy, farX, panelCy);
    cGrad.addColorStop(0, `hsla(${h},${60 + c * 30}%,${45 + c * 20}%,${lightAlpha * 1.2})`);
    cGrad.addColorStop(0.5, `hsla(${h},${50 + c * 25}%,${35 + c * 15}%,${lightAlpha * 0.5})`);
    cGrad.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = cGrad;
    ctx.fill();
  }
  ctx.restore();

  // Window frame
  ctx.fillStyle = "#1a1210";
  ctx.fillRect(x, y - wH * 0.5, G, wH);

  // Glass panels
  for (let i = 0; i < WINDOW_PANEL_COUNT; i++) {
    const panelY = y - wH * 0.4 + ((wH * 0.8) / WINDOW_PANEL_COUNT) * i;
    const panelH = (wH * 0.8) / WINDOW_PANEL_COUNT - 2;
    const origHue = (data.hue + i * PANEL_HUE_STEP) % 360;
    const h = origHue + (10 - origHue) * c;
    const sat = GLASS_BASE_SATURATION + c * 25;
    const lum = GLASS_BASE_LIGHTNESS + c * 15;
    const alpha = GLASS_BASE_ALPHA + c * GLASS_CORRUPTION_ALPHA_BOOST + Math.sin(now * GLASS_SHIMMER_SPEED + i) * GLASS_SHIMMER_AMPLITUDE;
    ctx.fillStyle = `hsla(${h},${sat}%,${lum}%,${alpha})`;
    ctx.fillRect(x + 1, panelY, G - 2, panelH);
    ctx.fillStyle = `hsla(${h},${sat + 10}%,${lum + 20}%,${alpha * 0.6})`;
    ctx.fillRect(x + 3, panelY + 2, G - 6, panelH - 4);
    ctx.fillStyle = `hsla(${h},${sat}%,${lum + 35}%,${alpha * 0.3})`;
    const pipY = panelY + panelH * 0.5;
    ctx.fillRect(x + G * 0.3, pipY - 1, G * 0.4, 2);
  }

  // Frame border
  ctx.strokeStyle = "#0d0a08";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y - wH * 0.5 + 0.5, G - 1, wH - 1);
});

// ── Crack ──────────────────────────────────────────────────────
registerRenderer("crack", (ctx, x, y, G, data, _entity, world) => {
  const now = world.time.now;

  const cx = x + G / 2;
  const cy = y + G / 2;
  const ex = cx + Math.cos(data.angle) * data.len * G;
  const ey = cy + Math.sin(data.angle) * data.len * G;

  const glowA =
    CRACK_GLOW_BASE +
    data.corruption * CRACK_GLOW_CORRUPTION_BOOST +
    Math.sin(now * CRACK_GLOW_PULSE_SPEED + data.angle) * CRACK_GLOW_PULSE_AMPLITUDE;
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

  if (data.branch) {
    const mx = (cx + ex) / 2;
    const my = (cy + ey) / 2;
    const bAngle = data.angle + data.branchAngle;
    const bx = mx + Math.cos(bAngle) * data.len * G * CRACK_BRANCH_LENGTH_RATIO;
    const by = my + Math.sin(bAngle) * data.len * G * CRACK_BRANCH_LENGTH_RATIO;
    ctx.strokeStyle = `rgba(140,20,0,${glowA * CRACK_BRANCH_GLOW_RATIO})`;
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
registerRenderer("bloodPool", (ctx, x, y, G, data) => {
  const bx = x + G / 2;
  const by = y + G / 2;
  const br = data.radius * G;

  const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
  grad.addColorStop(0, `rgba(70,0,0,${data.alpha})`);
  grad.addColorStop(0.6, `rgba(45,0,0,${data.alpha * 0.5})`);
  grad.addColorStop(1, "rgba(30,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(bx, by, br, br * BLOOD_ELLIPSE_RATIO, data.angle, 0, Math.PI * 2);
  ctx.fill();
});

// ── Pentagram ──────────────────────────────────────────────────
registerRenderer("pentagram", (ctx, x, y, G, data, _entity, world) => {
  const now = world.time.now;

  const cx = x + G / 2;
  const cy = y + G / 2;
  const r = data.radius * G * data.growth;
  const a = Math.min(data.growth * PENTAGRAM_ALPHA_RAMP, PENTAGRAM_MAX_ALPHA);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(data.rotation);
  ctx.globalAlpha = a;

  // Outer circle
  ctx.strokeStyle = `hsl(${data.hue},75%,${26 + data.corruption * 20}%)`;
  ctx.lineWidth = 1.5 + data.corruption * 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle
  if (data.growth > PENTAGRAM_INNER_CIRCLE_THRESHOLD) {
    ctx.strokeStyle = `hsl(${data.hue},70%,${22 + data.corruption * 15}%)`;
    ctx.lineWidth = 1 + data.corruption * 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * PENTAGRAM_INNER_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Star vertices
  const verts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 5; i++) {
    const vAngle = (i * 2 * Math.PI) / 5 + Math.PI / 2;
    verts.push({
      x: Math.cos(vAngle) * r * PENTAGRAM_VERTEX_RADIUS_RATIO,
      y: Math.sin(vAngle) * r * PENTAGRAM_VERTEX_RADIUS_RATIO,
    });
  }

  // Star lines
  if (data.growth > PENTAGRAM_STAR_THRESHOLD) {
    const order = [0, 2, 4, 1, 3, 0];
    ctx.strokeStyle = `hsl(${data.hue},90%,${30 + data.corruption * 18}%)`;
    ctx.lineWidth = 1.5 + data.corruption * 1.5;
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

  // Hellfire at each vertex (screen space)
  const cosR = Math.cos(data.rotation);
  const sinR = Math.sin(data.rotation);
  for (let i = 0; i < 5; i++) {
    const v = verts[i]!;
    const vsx = cx + v.x * cosR - v.y * sinR;
    const vsy = cy + v.x * sinR + v.y * cosR;
    drawHellfireEffect(ctx, vsx, vsy, G * PENTAGRAM_VERTEX_FIRE_SIZE, data.hue, i * 7.1, now, 3, a * PENTAGRAM_VERTEX_FIRE_ALPHA);
  }
});

// ── Floor Tile ─────────────────────────────────────────────────
registerRenderer("tile", (ctx, x, y, G) => {
  const seed = hash(x * 7.3 + y * 13.1);
  const lum = FLOOR_BASE_LIGHTNESS + seed * FLOOR_LIGHT_VARIATION;
  ctx.fillStyle = `hsl(270,5%,${lum}%)`;
  ctx.fillRect(x, y, G, G);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, G - 1, G - 1);
});

// ── Wall ──────────────────────────────────────────────────────
registerRenderer("wall", (ctx, x, y, G) => {
  const seed = hash(x * 11.3 + y * 7.7);

  const lum = WALL_BASE_LIGHTNESS + seed * WALL_LIGHT_VARIATION;
  ctx.fillStyle = `hsl(20,8%,${lum}%)`;
  ctx.fillRect(x, y, G, G);

  // Brick mortar lines
  ctx.strokeStyle = `rgba(0,0,0,${MORTAR_BASE_ALPHA + seed * MORTAR_ALPHA_VARIATION})`;
  ctx.lineWidth = 0.8;
  const midY = y + G * (MORTAR_Y_BASE + seed * MORTAR_Y_VARIATION);
  ctx.beginPath();
  ctx.moveTo(x, midY);
  ctx.lineTo(x + G, midY + Math.sin(seed * 5) * 0.8);
  ctx.stroke();
  // Vertical mortar — offset per row for brick pattern
  const offset = (Math.floor(y / G) % 2) * G * 0.4;
  const vx = x + ((G * 0.5 + offset) % G);
  if (vx > x + 2 && vx < x + G - 2) {
    ctx.beginPath();
    ctx.moveTo(vx, y);
    ctx.lineTo(vx + Math.sin(seed * 3) * 0.5, midY);
    ctx.stroke();
  }

  // Rough texture speckles
  ctx.fillStyle = `rgba(0,0,0,${SPECKLE_BASE_ALPHA + seed * SPECKLE_ALPHA_VARIATION})`;
  for (let i = 0; i < 3; i++) {
    const spx = x + hash(seed + i * 17.3) * G;
    const spy = y + hash(seed + i * 31.1) * G;
    ctx.fillRect(spx, spy, 1.5, 1.5);
  }

  // Border
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, G - 1, G - 1);
});
