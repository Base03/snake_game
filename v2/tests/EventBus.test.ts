import { describe, it, expect, vi } from "vitest";
import { EventBus } from "@core/EventBus";

// Minimal event map for tests
interface TestEvents {
  ping: { value: number };
  pong: { msg: string };
}

function makeBus(): EventBus<TestEvents> {
  return new EventBus<TestEvents>();
}

describe("EventBus", () => {
  it("calls listener on emit", () => {
    const bus = makeBus();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.emit("ping", { value: 42 });
    expect(fn).toHaveBeenCalledWith({ value: 42 });
  });

  it("supports multiple listeners on same event", () => {
    const bus = makeBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("ping", a);
    bus.on("ping", b);
    bus.emit("ping", { value: 1 });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("does not call listeners for other events", () => {
    const bus = makeBus();
    const fn = vi.fn();
    bus.on("pong", fn);
    bus.emit("ping", { value: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("off removes a listener", () => {
    const bus = makeBus();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.off("ping", fn);
    bus.emit("ping", { value: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("emit with no listeners does not throw", () => {
    const bus = makeBus();
    expect(() => bus.emit("ping", { value: 1 })).not.toThrow();
  });

  it("defer does not call listeners immediately", () => {
    const bus = makeBus();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.defer("ping", { value: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("flush processes deferred events in order", () => {
    const bus = makeBus();
    const calls: number[] = [];
    bus.on("ping", (d) => calls.push(d.value));
    bus.defer("ping", { value: 1 });
    bus.defer("ping", { value: 2 });
    bus.defer("ping", { value: 3 });
    bus.flush();
    expect(calls).toEqual([1, 2, 3]);
  });

  it("events deferred during flush go to next flush", () => {
    const bus = makeBus();
    const calls: number[] = [];
    bus.on("ping", (d) => {
      calls.push(d.value);
      if (d.value === 1) bus.defer("ping", { value: 99 });
    });
    bus.defer("ping", { value: 1 });
    bus.flush();
    expect(calls).toEqual([1]);
    bus.flush();
    expect(calls).toEqual([1, 99]);
  });

  it("flush clears the queue", () => {
    const bus = makeBus();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.defer("ping", { value: 1 });
    bus.flush();
    bus.flush(); // second flush should be a no-op
    expect(fn).toHaveBeenCalledOnce();
  });
});
