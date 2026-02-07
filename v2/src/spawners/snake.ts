import type { World } from "../core/World.js";
import type { EntityId } from "../core/types.js";
import { cp } from "../core/types.js";
import { SNAKE_HEAD, SNAKE_SEGMENT } from "./tags.js";
import { LAYER_ENTITY, Z_SNAKE, Z_SNAKE_HEAD } from "./layers.js";
import {
  SNAKE_MOVE_INTERVAL,
  SNAKE_COLOR,
  SNAKE_EYE_COLOR,
  SNAKE_SEGMENT_COLOR,
} from "./defaults.js";

export interface SnakeOpts {
  color?: string;
  eyeColor?: string;
  segmentColor?: string;
  moveInterval?: number;
}

export interface SnakeIds {
  head: EntityId;
  segments: EntityId[];
}

/** Spawn a single snake segment and register it in the chain. */
export function spawnSnakeSegment(
  world: World,
  headId: EntityId,
  parentId: EntityId,
  x: number,
  y: number,
  index: number,
  color = SNAKE_SEGMENT_COLOR,
): EntityId {
  const segId = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "snakeSegment",
      layer: LAYER_ENTITY,
      zIndex: Z_SNAKE,
      data: { color },
    }),
    cp("chainLink", { headId, parentId, childId: null, index }),
    cp("collider", { solid: false, trigger: true }),
  );
  world.tag(segId, SNAKE_SEGMENT);

  // Link parent → this child
  const parentLink = world.get(parentId, "chainLink")!;
  parentLink.childId = segId;

  return segId;
}

/** Spawn a snake chain: head entity + (length-1) segment entities. */
export function spawnSnake(
  world: World,
  x: number,
  y: number,
  length: number,
  opts: SnakeOpts = {},
): SnakeIds {
  const color = opts.color ?? SNAKE_COLOR;
  const eyeColor = opts.eyeColor ?? SNAKE_EYE_COLOR;
  const segmentColor = opts.segmentColor ?? SNAKE_SEGMENT_COLOR;
  const moveInterval = opts.moveInterval ?? SNAKE_MOVE_INTERVAL;

  // Head entity
  const headId = world.spawn(
    cp("position", { x, y }),
    cp("drawable", {
      type: "snakeHead",
      layer: LAYER_ENTITY,
      zIndex: Z_SNAKE_HEAD,
      data: { color, eyeColor },
    }),
    cp("velocity", { dx: 1, dy: 0, interval: moveInterval, accumulator: 0 }),
    cp("playerControlled", { nextDir: { x: 1, y: 0 } }),
    cp("chainLink", { headId: null, parentId: null, childId: null, index: 0 }),
    cp("collider", { solid: false, trigger: true }),
  );
  world.tag(headId, SNAKE_HEAD);

  // Segment entities, extending leftward from head
  const segments: EntityId[] = [];
  let parentId = headId;
  for (let i = 1; i < length; i++) {
    const segId = spawnSnakeSegment(
      world,
      headId,
      parentId,
      x - i,
      y,
      i,
      segmentColor,
    );
    segments.push(segId);
    parentId = segId;
  }

  return { head: headId, segments };
}
