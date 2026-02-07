// Render layers — lower draws first.
export const LAYER_FLOOR = 0;
export const LAYER_STRUCTURE = 1; // walls, pews, altar, statues, windows
export const LAYER_ENTITY = 2; // candles, hellfire, snake, particles
export const LAYER_OVERLAY = 3; // pentagrams, UI overlays

// z-index within a layer — higher draws on top.
export const Z_BASE = 0;
export const Z_DETAIL = 1; // cracks, blood on floor; windows over walls
export const Z_ABOVE = 2; // blood pools, stained glass decoration
export const Z_SNAKE = 9;
export const Z_SNAKE_HEAD = 10;
