/**
 * Customer types are a small closed set. A strategy key or customer type is
 * never accepted from a request body; the profile is loaded from a trusted
 * repository.
 */
export type CustomerType = "guest" | "student" | "premium";

export type CustomerProfile = {
  readonly id: string;
  readonly type: CustomerType;
};
