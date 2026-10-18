import type { Currency } from "../domain/money";

export type Product = {
  readonly id: string;
  readonly name: string;
  readonly unitAmount: number;
  readonly currency: Currency;
  readonly available: boolean;
};

/** Prices come from here, never from the request body. */
export interface CatalogRepository {
  findByIds(ids: readonly string[]): Promise<Product[]>;
}
