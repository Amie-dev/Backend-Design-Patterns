import type { CustomerProfile } from "../domain/customer";

/** The inside owns the interface; adapters provide the data. */
export interface CustomerRepository {
  findById(id: string): Promise<CustomerProfile | null>;
}
