import { expect, it } from "vitest";
import { withinPlaybackBudget } from "@/lib/playback-budget";
it("bounds full-size decoders and allows twice as many compact decoders", () => {
  const full = Array.from({ length: 20 }, (_, id) => ({ id, cost: 1 }));
  const small = full.map(e => ({ ...e, cost: .5 }));
  expect(withinPlaybackBudget(full, 6, e => e.cost)).toHaveLength(6);
  expect(withinPlaybackBudget(small, 6, e => e.cost)).toHaveLength(12);
  expect(withinPlaybackBudget(small, 3, e => e.cost)).toHaveLength(6);
});
it("preserves engagement ranking with a mixed workload", () => {
  const ranked = [{ id: "focused", cost: 1 }, { id: "small", cost: .5 }, { id: "large", cost: 1 }, { id: "small-2", cost: .5 }];
  expect(withinPlaybackBudget(ranked, 2, e => e.cost).map(e => e.id)).toEqual(["focused", "small", "small-2"]);
});
