import { describe, expect, it } from "vitest";
import { getShippingBillHeaderDate } from "./shipping-bill-date";
import { primaryOrderStatus } from "./order-status";
import { orderFormSchema } from "./validation";

describe("order workflow status", () => {
  it("keeps Processing distinct from Pending", () => {
    expect(primaryOrderStatus("Pending")).toBe("Pending");
    expect(primaryOrderStatus("Processing")).toBe("Processing");
  });

  it("allows an empty request date", () => {
    expect(orderFormSchema.shape.requestDate.safeParse("").success).toBe(true);
  });

  it("prefers a request date for the shipping header when available", () => {
    expect(getShippingBillHeaderDate({ requestDate: "2026-08-20", deliveryDate: "2026-08-25" } as any)).toBe("2026-08-20");
    expect(getShippingBillHeaderDate({ requestDate: "", deliveryDate: "2026-08-25" } as any)).toBe("2026-08-25");
  });
});
