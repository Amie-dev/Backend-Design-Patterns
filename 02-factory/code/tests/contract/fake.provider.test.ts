import { describePaymentProviderContract } from "./payment-provider.contract";
import { FakePaymentProvider } from "../fakes/fake-payment.provider";

describePaymentProviderContract("fake", () => new FakePaymentProvider("fake"));
