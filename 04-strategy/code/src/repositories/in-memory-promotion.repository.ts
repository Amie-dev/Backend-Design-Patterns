import type {
  FestivalPromotion,
  PromotionRepository,
} from "../ports/promotion.repository";

export type InMemoryPromotionOptions = {
  readonly enabled: boolean;
  readonly promotion: FestivalPromotion;
};

export class InMemoryPromotionRepository implements PromotionRepository {
  constructor(private readonly options: InMemoryPromotionOptions) {}

  async findActive(now: Date): Promise<FestivalPromotion | null> {
    const { enabled, promotion } = this.options;

    if (!enabled) return null;
    if (now < promotion.startsAt || now >= promotion.endsAt) return null;

    return promotion;
  }
}
