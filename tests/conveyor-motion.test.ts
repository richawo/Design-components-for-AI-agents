import { describe, expect, it } from "vitest";
import { advanceConveyor } from "@/lib/conveyor-motion";

describe("conveyor motion", () => {
  it("wraps both directions without losing travel at the loop boundary", () => {
    expect(advanceConveyor(99, 40, 40, .05, 100).position).toBeCloseTo(1);
    expect(advanceConveyor(1, -40, -40, .05, 100).position).toBeCloseTo(99);
  });
  it("slows into a pause instead of snapping its velocity to zero", () => {
    const paused = advanceConveyor(50, 40, 0, 1 / 60, 100);
    expect(paused.velocity).toBeGreaterThan(0);
    expect(paused.velocity).toBeLessThan(40);
    expect(paused.position).toBeGreaterThan(50);
  });
  it("does not skip a collection after a hidden-tab time gap", () => {
    expect(advanceConveyor(10, 40, 40, 20, 100).position).toBeCloseTo(12);
  });
});
