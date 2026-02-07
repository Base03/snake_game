import type { EntityId, ComponentKey, ComponentReader } from "./types.js";

export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cells: EntityId[][];
  readonly blocked: Int32Array;
  private entityPositions = new Map<EntityId, number[]>();

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, () => []);
    this.blocked = new Int32Array(cols * rows);
  }

  private idx(x: number, y: number): number {
    return y * this.cols + x;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  add(id: EntityId, x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    this.cells[i]!.push(id);
    let indices = this.entityPositions.get(id);
    if (!indices) {
      indices = [];
      this.entityPositions.set(id, indices);
    }
    indices.push(i);
  }

  remove(id: EntityId): void {
    const indices = this.entityPositions.get(id);
    if (!indices) return;
    for (const i of indices) {
      const cell = this.cells[i]!;
      const pos = cell.indexOf(id);
      if (pos !== -1) {
        cell[pos] = cell[cell.length - 1]!;
        cell.pop();
      }
    }
    this.entityPositions.delete(id);
  }

  move(
    id: EntityId,
    _fromX: number,
    _fromY: number,
    toX: number,
    toY: number,
  ): void {
    this.remove(id);
    this.add(id, toX, toY);
  }

  at(x: number, y: number): readonly EntityId[] {
    if (!this.inBounds(x, y)) return [];
    return this.cells[this.idx(x, y)]!;
  }

  isBlocked(x: number, y: number, reader: ComponentReader): boolean {
    if (!this.inBounds(x, y)) return true;
    const i = this.idx(x, y);
    if (this.blocked[i]) return true;
    const cell = this.cells[i]!;
    for (const id of cell) {
      const collider = reader.get(id, "collider");
      if (collider?.solid) return true;
    }
    return false;
  }

  queryArea(
    cx: number,
    cy: number,
    r: number,
    reader: ComponentReader,
    ...components: ComponentKey[]
  ): EntityId[] {
    const result: EntityId[] = [];
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(this.cols - 1, cx + r);
    const minY = Math.max(0, cy - r);
    const maxY = Math.min(this.rows - 1, cy + r);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = this.cells[this.idx(x, y)]!;
        for (const id of cell) {
          if (
            components.length === 0 ||
            components.every((k) => reader.has(id, k))
          ) {
            result.push(id);
          }
        }
      }
    }
    return result;
  }

  toPathGrid(reader: ComponentReader): Int32Array {
    const grid = new Int32Array(this.cols * this.rows);
    for (let i = 0; i < grid.length; i++) {
      if (this.blocked[i]) {
        grid[i] = 1;
        continue;
      }
      const cell = this.cells[i]!;
      for (const id of cell) {
        const collider = reader.get(id, "collider");
        if (collider?.solid) {
          grid[i] = 1;
          break;
        }
      }
    }
    return grid;
  }
}
