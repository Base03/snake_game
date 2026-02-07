// ── Per-renderer drawable data interfaces ──────────────────────
// Single source of truth for what data each renderer expects.
// Spawners import these types to build data; renderers cast to them.

// tile renderer: no data needed
export type TileDrawable = Record<string, never>;

export interface WallDrawable {
  side: number; // 0=top, 1=right, 2=bottom, 3=left
}

export interface PewDrawable {
  dx: number; // tile index within the row (0-based)
  width: number; // total row width in tiles
  row: number; // row y-coordinate (for seed variation)
  fireHue: number; // hue of fire when burning
}

export interface AltarDrawable {
  tileW: number; // width in tiles
  tileH: number; // height in tiles
  corruption: number; // TODO Phase 4: read from Corruption component, not drawable data
}

export interface StainedGlassDrawable {
  hue: number; // base hue for top panel
  corruption: number; // TODO Phase 4: read from Corruption component, not drawable data
  side: number; // 0=left wall, 1=right wall
}

export interface StatueDrawable {
  side: number; // 0=left, 1=right
  crying: boolean;
  corruption: number; // TODO Phase 4: read from Corruption component, not drawable data
  tearY: number; // tear animation progress
}

export interface CandleDrawable {
  hue: number;
  height: number; // multiplier on candle body height
  flicker: number; // seed for animation phase offset
}

export interface HellfireDrawable {
  hue: number;
  flicker: number; // seed for animation phase offset
}

export interface SnakeHeadDrawable {
  color: string; // CSS color
  eyeColor: string;
}

export interface SnakeSegmentDrawable {
  color: string; // CSS color
}

export interface BloodPoolDrawable {
  alpha: number;
  radius: number; // in grid units
  angle: number; // rotation
}

export interface CrackDrawable {
  angle: number; // radians
  len: number; // length in grid units
  corruption: number; // TODO Phase 4: read from Corruption component, not drawable data
  branch: boolean;
  branchAngle: number; // radians
}

export interface PentagramDrawable {
  radius: number; // in grid units
  growth: number; // 0–1 animation progress
  corruption: number; // TODO Phase 4: read from Corruption component, not drawable data
  hue: number;
  rotation: number; // radians
}

// ── Map from drawable type string to its data interface ────────
export interface DrawableDataMap {
  tile: TileDrawable;
  wall: WallDrawable;
  pew: PewDrawable;
  altar: AltarDrawable;
  stainedGlass: StainedGlassDrawable;
  statue: StatueDrawable;
  candle: CandleDrawable;
  hellfire: HellfireDrawable;
  snakeHead: SnakeHeadDrawable;
  snakeSegment: SnakeSegmentDrawable;
  bloodPool: BloodPoolDrawable;
  crack: CrackDrawable;
  pentagram: PentagramDrawable;
}

export type DrawableType = keyof DrawableDataMap;
