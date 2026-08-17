import { describe, expect, it, vi } from "vitest";
import { deliveredInvoiceMessage, openWhatsAppDeliveredInvoice } from "./whatsapp";
import type { DeliveryConfirmation, Order } from "../types";

const order = {
  orderCode: "FC3885A",
  customer: { name: "Test Client", mobile1: "0711111111", mobile2: "0777777777", whatsappNumber: "0766666666", address1: "Colombo" },
  items: [{ id: "item-1", name: "Rice", variant: "Large", quantity: 2 }],
} as Order;

const delivery: DeliveryConfirmation = {
  trackingNumber: "TRACK-123",
  parcelWeight: 1250,
  value: 4500,
  deliveryPaid: true,
  confirmedAtClient: "2026-08-16T10:00:00.000Z",
  confirmedBy: "user-1",
  confirmedByName: "Admin",
};

describe("delivered WhatsApp invoice", () => {
  it("contains the Sinhala notice, mobiles, items, and delivery details", () => {
    const message = deliveredInvoiceMessage(order, delivery);
    expect(message).toContain("ආයුබෝවන්");
    expect(message).toContain("0711111111 / 0777777777");
    expect(message).toContain("Rice (Large) x 2");
    expect(message).toContain("Tracking number: TRACK-123");
    expect(message).toContain("Weight: 1,250 g");
    expect(message).toContain("Deliver Paid");
  });

  it("omits Deliver Paid when the checkbox is off", () => {
    expect(deliveredInvoiceMessage(order, { ...delivery, deliveryPaid: false })).not.toContain("Deliver Paid");
  });

  it("sends the delivered invoice to the dedicated WhatsApp number", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    openWhatsAppDeliveredInvoice(order, delivery);
    expect(open).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/94766666666?text="), "_blank", "noopener,noreferrer");
    vi.unstubAllGlobals();
  });
});
