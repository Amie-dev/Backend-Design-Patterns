export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock frozen at one instant. Tests use this to make rules deterministic. */
export function fixedClock(instant: string | Date): Clock {
  const fixed = new Date(instant);
  return { now: () => new Date(fixed.getTime()) };
}
