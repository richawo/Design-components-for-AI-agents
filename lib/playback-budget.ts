/** Six full-size decoders or twelve small showcase decoders, fewer on low-end
 * hardware. Ranking still gives deliberate hover/focus priority. */
export function withinPlaybackBudget<T>(ranked: T[], budget: number, cost: (entry: T) => number): T[] {
  const selected: T[] = [];
  for (const entry of ranked) {
    const needed = cost(entry);
    if (needed > budget) continue;
    selected.push(entry);
    budget -= needed;
  }
  return selected;
}
