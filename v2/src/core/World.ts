import type {
  EntityId,
  ComponentKey,
  ComponentMap,
  ComponentPair,
  Phase,
} from "./types.js";
import { EventBus } from "./EventBus.js";
import type { SpatialGrid } from "./SpatialGrid.js";

export type SystemFn = (world: World) => void;

export class World {
  private nextId = 1;
  private stores = new Map<ComponentKey, Map<EntityId, unknown>>();
  private entityTags = new Map<EntityId, Set<string>>();
  private systems: Array<{ name: string; fn: SystemFn; phase: Phase }> = [];
  private alive = new Set<EntityId>();

  readonly bus = new EventBus();
  grid: SpatialGrid | null = null;
  time = { now: 0, dt: 0, gameTime: 0 };

  // ── Entity lifecycle ─────────────────────────────────────

  spawn(...components: ComponentPair[]): EntityId {
    const id = this.nextId++ as EntityId;
    this.alive.add(id);
    for (const [key, data] of components) {
      this.add(id, key, data as ComponentMap[ComponentKey]);
    }
    return id;
  }

  destroy(id: EntityId): void {
    if (!this.alive.has(id)) return;
    this.alive.delete(id);
    for (const store of this.stores.values()) {
      store.delete(id);
    }
    this.entityTags.delete(id);
    this.grid?.remove(id);
    this.bus.emit("entity:destroyed", { id });
  }

  // ── Component access ─────────────────────────────────────

  add<K extends ComponentKey>(
    id: EntityId,
    key: K,
    data: ComponentMap[K],
  ): void {
    let store = this.stores.get(key);
    if (!store) {
      store = new Map();
      this.stores.set(key, store);
    }
    store.set(id, data);

    if (key === "position" && this.grid) {
      const pos = data as ComponentMap["position"];
      this.grid.add(id, pos.x, pos.y);
    }
  }

  get<K extends ComponentKey>(
    id: EntityId,
    key: K,
  ): ComponentMap[K] | undefined {
    return this.stores.get(key)?.get(id) as ComponentMap[K] | undefined;
  }

  has(id: EntityId, key: ComponentKey): boolean {
    return this.stores.get(key)?.has(id) ?? false;
  }

  remove(id: EntityId, key: ComponentKey): void {
    this.stores.get(key)?.delete(id);
  }

  // ── Tags ─────────────────────────────────────────────────

  tag(id: EntityId, ...names: string[]): void {
    let set = this.entityTags.get(id);
    if (!set) {
      set = new Set();
      this.entityTags.set(id, set);
    }
    for (const name of names) set.add(name);
  }

  untag(id: EntityId, name: string): void {
    this.entityTags.get(id)?.delete(name);
  }

  hasTag(id: EntityId, name: string): boolean {
    return this.entityTags.get(id)?.has(name) ?? false;
  }

  // ── Queries ──────────────────────────────────────────────

  query(...components: ComponentKey[]): EntityId[] {
    if (components.length === 0) return [];

    let smallest: Map<EntityId, unknown> | undefined;
    let smallestSize = Infinity;
    for (const key of components) {
      const store = this.stores.get(key);
      if (!store || store.size === 0) return [];
      if (store.size < smallestSize) {
        smallest = store;
        smallestSize = store.size;
      }
    }
    if (!smallest) return [];

    const result: EntityId[] = [];
    for (const id of smallest.keys()) {
      if (components.every((k) => this.stores.get(k)?.has(id))) {
        result.push(id as EntityId);
      }
    }
    return result;
  }

  queryTagged(tagName: string, ...components: ComponentKey[]): EntityId[] {
    if (components.length === 0) {
      const result: EntityId[] = [];
      for (const [id, tags] of this.entityTags) {
        if (tags.has(tagName)) result.push(id);
      }
      return result;
    }
    return this.query(...components).filter((id) => this.hasTag(id, tagName));
  }

  // ── Systems ──────────────────────────────────────────────

  addSystem(name: string, fn: SystemFn, phase: Phase): void {
    this.systems.push({ name, fn, phase });
  }

  runPhase(phase: Phase): void {
    for (const sys of this.systems) {
      if (sys.phase === phase) sys.fn(this);
    }
  }
}
