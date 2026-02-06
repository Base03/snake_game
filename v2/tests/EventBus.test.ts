import { describe, it, expect } from "vitest";
import { EventBus } from "@core/EventBus";

describe("EventBus", () => {
  it("exists", () => {
    expect(new EventBus()).toBeDefined();
  });
});
