import { createHash } from "node:crypto";

/** Selection-time gate for experiments. Implementations must be deterministic. */
export interface RolloutGate {
  isEnabled(userId: string, experiment: string): boolean;
}

/**
 * Deterministic percentage rollout: the same user always lands in the same
 * bucket for the same experiment, which keeps quote and charge consistent.
 */
export function isInRollout(
  userId: string,
  experiment: string,
  percent: number,
): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;

  const digest = createHash("sha256")
    .update(`${experiment}:${userId}`)
    .digest();

  return digest.readUInt32BE(0) % 100 < Math.trunc(percent);
}

export class PercentRolloutGate implements RolloutGate {
  constructor(private readonly percent: number) {}

  isEnabled(userId: string, experiment: string): boolean {
    return isInRollout(userId, experiment, this.percent);
  }
}
