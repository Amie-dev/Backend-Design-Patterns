import type { CatalogRepository, Product } from "../ports/catalog.repository";

/** Demo catalog in minor units. `prod_sale` is excluded from the campaign. */
export const DEMO_PRODUCTS: readonly Product[] = [
  {
    id: "prod_1",
    name: "Mechanical Keyboard",
    unitAmount: 25_000,
    currency: "INR",
    available: true,
  },
  {
    id: "prod_2",
    name: "USB-C Hub",
    unitAmount: 15_000,
    currency: "INR",
    available: true,
  },
  {
    id: "prod_3",
    name: "Monitor Stand",
    unitAmount: 35_000,
    currency: "INR",
    available: true,
  },
  {
    id: "prod_sale",
    name: "Clearance Mouse",
    unitAmount: 5_000,
    currency: "INR",
    available: true,
  },
  {
    id: "prod_unavailable",
    name: "Sold-out Dock",
    unitAmount: 20_000,
    currency: "INR",
    available: false,
  },
];

export class InMemoryCatalogRepository implements CatalogRepository {
  constructor(private readonly products: readonly Product[] = DEMO_PRODUCTS) {}

  async findByIds(ids: readonly string[]): Promise<Product[]> {
    const wanted = new Set(ids);
    return this.products.filter((product) => wanted.has(product.id));
  }
}
