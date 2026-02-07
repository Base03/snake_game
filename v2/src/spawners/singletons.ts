import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { cp } from "../core/types.js";
import { GAME_STATE, CORRUPTION, LIGHTNING } from "./tags.js";
import { LIGHTNING_INITIAL_TIMER } from "./defaults.js";

export function spawnGameState(world: World): EntityId {
  const id = world.spawn(
    cp("gameState", { score: 0, alive: true, started: false, gameTime: 0 }),
  );
  world.tag(id, GAME_STATE);
  return id;
}

export function spawnCorruption(world: World): EntityId {
  const id = world.spawn(cp("corruption", { value: 0, target: 0 }));
  world.tag(id, CORRUPTION);
  return id;
}

export function spawnLightning(world: World): EntityId {
  const id = world.spawn(cp("lightning", { timer: LIGHTNING_INITIAL_TIMER, alpha: 0 }));
  world.tag(id, LIGHTNING);
  return id;
}

export interface SingletonIds {
  gameState: EntityId;
  corruption: EntityId;
  lightning: EntityId;
}

export function spawnSingletons(world: World): SingletonIds {
  return {
    gameState: spawnGameState(world),
    corruption: spawnCorruption(world),
    lightning: spawnLightning(world),
  };
}
