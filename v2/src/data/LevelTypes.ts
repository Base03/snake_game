import type { EntityId } from "../core/types.js";
import type { SingletonIds } from "../spawners/singletons.js";

/** Base interface all level generators return. */
export interface LevelEntities {
  floors: EntityId[];
  walls: EntityId[];
  singletons: SingletonIds;
}
