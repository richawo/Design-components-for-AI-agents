/** Frame-rate independent acceleration, with long hidden-tab steps bounded. */
export function advanceConveyor(position: number, velocity: number, goal: number, elapsed: number, period: number) {
  const dt = Math.min(.05, Math.max(0, elapsed));
  const nextVelocity = velocity + (goal - velocity) * (1 - Math.exp(-dt / (goal === 0 ? .18 : .65)));
  const next = position + nextVelocity * dt;
  return { position: period > 0 ? ((next % period) + period) % period : 0, velocity: nextVelocity };
}
