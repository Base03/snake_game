// ── Shared spawner constants ────────────────────────────────────
// Named values for game-design decisions and duplicated magic numbers.
// Import these in spawners instead of scattering raw literals.

// ── Durations (ms) ──────────────────────────────────────────────
export const COLLECTIBLE_LIFETIME = 14000;
export const PEW_BURN_DURATION = 3500;
export const LIGHTNING_INITIAL_TIMER = 10000;

// ── Scoring ─────────────────────────────────────────────────────
export const CANDLE_BASE_SCORE = 10;
export const CANDLE_SEGMENTS = 1;
export const HELLFIRE_BASE_SCORE = 25;
export const HELLFIRE_SEGMENTS = 2;

// ── Light colors (RGB tuples) ───────────────────────────────────
export const WARM_LIGHT_COLOR: [number, number, number] = [255, 200, 100];
export const HELLFIRE_LIGHT_COLOR: [number, number, number] = [255, 100, 30];
export const PENTAGRAM_LIGHT_COLOR: [number, number, number] = [200, 50, 50];

// ── Default hues ────────────────────────────────────────────────
export const CANDLE_DEFAULT_HUE = 40;
export const HELLFIRE_DEFAULT_HUE = 15;
export const PEW_DEFAULT_FIRE_HUE = 15;

// ── Fire spread ─────────────────────────────────────────────────
export const DEFAULT_SPREAD_RADIUS = 1;

// ── Snake ────────────────────────────────────────────────────────
export const SNAKE_INITIAL_LENGTH = 8;
export const SNAKE_MOVE_INTERVAL = 110; // ms between moves
export const SNAKE_COLOR = "#2d8b2d";
export const SNAKE_EYE_COLOR = "#ffcc00";
export const SNAKE_SEGMENT_COLOR = "#1e6b1e";
