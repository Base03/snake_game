import { describe, it, expect } from "vitest";
import { World } from "@core/World";
import { SpatialGrid } from "@core/SpatialGrid";
import { spawnSnake, spawnSnakeSegment } from "@spawners/snake";
import { SNAKE_HEAD, SNAKE_SEGMENT } from "@spawners/tags";
import {
  SNAKE_MOVE_INTERVAL,
  SNAKE_COLOR,
  SNAKE_EYE_COLOR,
  SNAKE_SEGMENT_COLOR,
} from "@spawners/defaults";
import type { SnakeHeadDrawable, SnakeSegmentDrawable } from "@rendering/drawableData";

function worldWithGrid(cols = 20, rows = 20): World {
  const w = new World();
  w.grid = new SpatialGrid(cols, rows);
  return w;
}

describe("spawnSnake", () => {
  it("creates head + N-1 segments", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 5, 4);
    expect(head).toBeDefined();
    expect(segments).toHaveLength(3);
  });

  it("head has correct components", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 5, 3);
    expect(w.get(head, "position")).toEqual({ x: 10, y: 5 });
    expect(w.get(head, "drawable")!.type).toBe("snakeHead");
    expect(w.has(head, "velocity")).toBe(true);
    expect(w.has(head, "playerControlled")).toBe(true);
    expect(w.has(head, "chainLink")).toBe(true);
    expect(w.has(head, "collider")).toBe(true);
  });

  it("head is tagged snakeHead", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 5, 3);
    expect(w.hasTag(head, SNAKE_HEAD)).toBe(true);
  });

  it("head collider is not solid", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 5, 3);
    expect(w.get(head, "collider")!.solid).toBe(false);
    expect(w.get(head, "collider")!.trigger).toBe(true);
  });

  it("head velocity defaults to right at 110ms", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 5, 3);
    const vel = w.get(head, "velocity")!;
    expect(vel.dx).toBe(1);
    expect(vel.dy).toBe(0);
    expect(vel.interval).toBe(SNAKE_MOVE_INTERVAL);
    expect(vel.accumulator).toBe(0);
  });

  it("segments positioned leftward from head", () => {
    const w = worldWithGrid();
    const { segments } = spawnSnake(w, 10, 5, 4);
    expect(w.get(segments[0]!, "position")).toEqual({ x: 9, y: 5 });
    expect(w.get(segments[1]!, "position")).toEqual({ x: 8, y: 5 });
    expect(w.get(segments[2]!, "position")).toEqual({ x: 7, y: 5 });
  });

  it("segments tagged snakeSegment", () => {
    const w = worldWithGrid();
    const { segments } = spawnSnake(w, 10, 5, 3);
    for (const seg of segments) {
      expect(w.hasTag(seg, SNAKE_SEGMENT)).toBe(true);
    }
  });

  it("chain links form a valid linked list", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 5, 4);

    // Head: no parent, child is first segment
    const headLink = w.get(head, "chainLink")!;
    expect(headLink.headId).toBeNull();
    expect(headLink.parentId).toBeNull();
    expect(headLink.childId).toBe(segments[0]);
    expect(headLink.index).toBe(0);

    // Middle segment
    const seg1Link = w.get(segments[0]!, "chainLink")!;
    expect(seg1Link.headId).toBe(head);
    expect(seg1Link.parentId).toBe(head);
    expect(seg1Link.childId).toBe(segments[1]);
    expect(seg1Link.index).toBe(1);

    // Tail: no child
    const tailLink = w.get(segments[2]!, "chainLink")!;
    expect(tailLink.headId).toBe(head);
    expect(tailLink.parentId).toBe(segments[1]);
    expect(tailLink.childId).toBeNull();
    expect(tailLink.index).toBe(3);
  });

  it("uses default colors", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 5, 3);
    const headData = w.get(head, "drawable")!.data as SnakeHeadDrawable;
    expect(headData.color).toBe(SNAKE_COLOR);
    expect(headData.eyeColor).toBe(SNAKE_EYE_COLOR);
    const segData = w.get(segments[0]!, "drawable")!.data as SnakeSegmentDrawable;
    expect(segData.color).toBe(SNAKE_SEGMENT_COLOR);
  });

  it("accepts custom opts", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 5, 3, {
      color: "red",
      eyeColor: "blue",
      segmentColor: "green",
      moveInterval: 200,
    });
    const headData = w.get(head, "drawable")!.data as SnakeHeadDrawable;
    expect(headData.color).toBe("red");
    expect(headData.eyeColor).toBe("blue");
    expect(w.get(head, "velocity")!.interval).toBe(200);
    const segData = w.get(segments[0]!, "drawable")!.data as SnakeSegmentDrawable;
    expect(segData.color).toBe("green");
  });

  it("registers all entities in SpatialGrid", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 5, 3);
    expect(w.grid!.at(10, 5)).toContain(head);
    expect(w.grid!.at(9, 5)).toContain(segments[0]);
    expect(w.grid!.at(8, 5)).toContain(segments[1]);
  });

  it("length 1 creates head only, no segments", () => {
    const w = worldWithGrid();
    const { head, segments } = spawnSnake(w, 10, 5, 1);
    expect(segments).toHaveLength(0);
    const link = w.get(head, "chainLink")!;
    expect(link.childId).toBeNull();
  });
});

describe("spawnSnakeSegment", () => {
  it("creates segment linked to parent", () => {
    const w = worldWithGrid();
    const { head } = spawnSnake(w, 10, 5, 1);
    const segId = spawnSnakeSegment(w, head, head, 9, 5, 1);

    expect(w.get(segId, "position")).toEqual({ x: 9, y: 5 });
    expect(w.hasTag(segId, SNAKE_SEGMENT)).toBe(true);

    const segLink = w.get(segId, "chainLink")!;
    expect(segLink.headId).toBe(head);
    expect(segLink.parentId).toBe(head);
    expect(segLink.childId).toBeNull();
    expect(segLink.index).toBe(1);

    // Parent linked to child
    expect(w.get(head, "chainLink")!.childId).toBe(segId);
  });
});
