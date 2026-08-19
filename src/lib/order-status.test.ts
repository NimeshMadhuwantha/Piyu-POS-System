import { describe, expect, it } from "vitest";
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
});
