// ── Entity ID ────────────────────────────────────────────────
// Branded type: prevents passing raw numbers as entity IDs.
declare const __entityId: unique symbol;
export type EntityId = number & { readonly [__entityId]: true };

// ── Components ───────────────────────────────────────────────
// Plain data objects. No methods, no inheritance.

export interface Position {
  x: number;
  y: number;
}

export interface Collider {
  solid: boolean;
  trigger: boolean;
}

export interface Velocity {
  dx: number;
  dy: number;
  interval: number; // ms between moves
  accumulator: number;
}

export interface Drawable {
  layer: number;
  type: string; // renderer lookup key
  zIndex: number;
  visible: boolean;
  data?: Record<string, unknown>;
}

export interface Animated {
  state: string;
  t: number;
  speed: number;
  data: Record<string, unknown>;
}

export interface LightSource {
  radius: number;
  color: [number, number, number];
  intensity: number;
  flicker: number;
}

export interface Collectible {
  type: string;
  baseScore: number;
  segments: number;
}

export interface Lifetime {
  birth: number;
  duration: number;
  freshness: number;
}

export interface Flammable {
  burning: boolean;
  burnT: number;
  burnDuration: number;
  spreadRadius: number;
}

export interface ChainLink {
  headId: EntityId | null;
  parentId: EntityId | null;
  childId: EntityId | null;
  index: number;
}

export interface PlayerControlled {
  nextDir: { x: number; y: number };
}

export interface AI {
  type: string;
  target: EntityId | { x: number; y: number } | null;
  state: string;
  data: Record<string, unknown>;
}

export interface Hostile {
  targets: string[];
}

export interface Shield {
  remaining: number;
}

export interface PowerUp {
  effect: string;
  duration: number;
  magnitude: number;
}

export interface LightningReactive {
  flashMultiplier: number;
}

export interface Corruption {
  value: number;
  target: number;
}

export interface Lightning {
  timer: number;
  alpha: number;
}

export interface GameState {
  score: number;
  alive: boolean;
  started: boolean;
  gameTime: number;
}

// ── Component Registry ───────────────────────────────────────
// Maps string keys to component data types.
// world.get(id, 'position') returns Position | undefined.

export interface ComponentMap {
  position: Position;
  collider: Collider;
  velocity: Velocity;
  drawable: Drawable;
  animated: Animated;
  lightSource: LightSource;
  collectible: Collectible;
  lifetime: Lifetime;
  flammable: Flammable;
  chainLink: ChainLink;
  playerControlled: PlayerControlled;
  ai: AI;
  hostile: Hostile;
  shield: Shield;
  powerUp: PowerUp;
  lightningReactive: LightningReactive;
  corruption: Corruption;
  lightning: Lightning;
  gameState: GameState;
}

export type ComponentKey = keyof ComponentMap;

// ── Component Pair (for spawn) ───────────────────────────────

export type ComponentPair<K extends ComponentKey = ComponentKey> = [
  K,
  ComponentMap[K],
];

/** Type-safe helper for building component pairs. */
export function cp<K extends ComponentKey>(
  key: K,
  data: ComponentMap[K],
): ComponentPair<K> {
  return [key, data];
}

// ── Event Map ────────────────────────────────────────────────

export interface EventMap {
  "chain:moved": { headId: EntityId; x: number; y: number };
  "chain:blocked": {
    headId: EntityId;
    x: number;
    y: number;
    isPlayer: boolean;
  };
  "chain:killed": {
    headId: EntityId;
    killerId: EntityId;
    x: number;
    y: number;
    cause: string;
  };
  "chain:tailBurned": {
    headId: EntityId;
    tailId: EntityId;
    x: number;
    y: number;
  };
  "chain:grew": { headId: EntityId; newSegId: EntityId; count: number };
  "collectible:eaten": {
    entityId: EntityId;
    eaterId: EntityId;
    type: string;
    freshness: number;
    x: number;
    y: number;
  };
  "collectible:spawned": {
    entityId: EntityId;
    type: string;
    x: number;
    y: number;
  };
  "collectible:expired": {
    entityId: EntityId;
    type: string;
    x: number;
    y: number;
  };
  "collectible:stolen": {
    entityId: EntityId;
    thiefId: EntityId;
    x: number;
    y: number;
  };
  "hellfire:spawned": { x: number; y: number };
  "entity:ignited": { id: EntityId; sourceId: EntityId };
  "entity:burnedOut": { id: EntityId };
  "entity:destroyed": { id: EntityId };
  "corruption:changed": { value: number; delta: number };
  "corruption:threshold": { threshold: number; name: string; value: number };
  "lightning:flash": { alpha: number };
  "grid:changed": Record<string, never>;
  "blood:spawned": { x: number; y: number };
  "input:direction": { dx: number; dy: number };
  "game:started": Record<string, never>;
  "game:over": { score: number; corruption: number; cause: string };
}

export type EventKey = keyof EventMap;

// ── System Phases ────────────────────────────────────────────

export const Phase = {
  INPUT: 0,
  AI: 1,
  UPDATE: 2,
  RENDER: 3,
  AUDIO: 4,
} as const;

export type Phase = (typeof Phase)[keyof typeof Phase];

// ── ComponentReader (decouples SpatialGrid from World) ───────

export interface ComponentReader {
  get<K extends ComponentKey>(
    id: EntityId,
    key: K,
  ): ComponentMap[K] | undefined;
  has(id: EntityId, key: ComponentKey): boolean;
}
