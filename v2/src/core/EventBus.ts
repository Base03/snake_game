import type { EventMap } from "./types.js";

type Listener<T> = (data: T) => void;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class EventBus<M extends {} = EventMap> {
  private listeners = new Map<keyof M, Set<Listener<never>>>();
  private deferred: Array<{ event: keyof M; data: unknown }> = [];

  on<K extends keyof M>(event: K, fn: Listener<M[K]>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<never>);
  }

  off<K extends keyof M>(event: K, fn: Listener<M[K]>): void {
    this.listeners.get(event)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof M>(event: K, data: M[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Listener<M[K]>)(data);
  }

  defer<K extends keyof M>(event: K, data: M[K]): void {
    this.deferred.push({ event, data });
  }

  flush(): void {
    const batch = this.deferred;
    this.deferred = [];
    for (const { event, data } of batch) {
      this.emit(event as keyof M, data as M[keyof M]);
    }
  }
}
