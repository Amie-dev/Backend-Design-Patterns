import type { CustomerProfile } from "../domain/customer";
import type { CustomerRepository } from "../ports/customer.repository";

/** Demo profiles. In a real service this is a database adapter. */
export const DEMO_CUSTOMERS: readonly CustomerProfile[] = [
  { id: "usr_premium", type: "premium" },
  { id: "usr_student", type: "student" },
  { id: "usr_guest", type: "guest" },
];

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(
    private readonly customers: readonly CustomerProfile[] = DEMO_CUSTOMERS,
  ) {}

  async findById(id: string): Promise<CustomerProfile | null> {
    return this.customers.find((customer) => customer.id === id) ?? null;
  }
}
