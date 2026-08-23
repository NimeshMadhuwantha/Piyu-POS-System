import { describe, expect, it } from "vitest";
import { reportTrackingNumber } from "./report-values";
import type { Order } from "../types";

describe("report PDF values", () => {
  it("uses the latest tracking number saved by delivery confirmation", () => {
    const order = {
      shipping: { method: "Courier", trackingNumber: "older-shipping-value" },
      deliveryConfirmation: { trackingNumber: "LATEST-TRACKING" },
    } as Order;
    expect(reportTrackingNumber(order)).toBe("LATEST-TRACKING");
  });

  it("supports older orders and empty tracking numbers", () => {
    expect(reportTrackingNumber({ shipping: { method: "Courier", trackingNumber: "LEGACY-TRACKING" } })).toBe("LEGACY-TRACKING");
    expect(reportTrackingNumber({ shipping: { method: "Courier" } })).toBe("-");
  });
});
