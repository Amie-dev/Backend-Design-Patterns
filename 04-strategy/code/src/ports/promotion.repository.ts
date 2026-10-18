export type FestivalPromotion = {
  readonly id: string;
  readonly fixedAmount: number;
  readonly excludedProductIds: readonly string[];
  readonly startsAt: Date;
  readonly endsAt: Date;
};

export interface PromotionRepository {
  /** Returns the promotion that is live at `now`, or null. */
  findActive(now: Date): Promise<FestivalPromotion | null>;
}
