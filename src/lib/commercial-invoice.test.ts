import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommercialInvoicePdf } from "./commercial-invoice";
import type { BusinessSettings, Order } from "../types";

const { downloadBlob } = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock("@/lib/export", () => ({ downloadBlob }));

const order = {
  orderCode: "FC3885A",
  customer: { name: "Test Client", email: "client@example.com", mobile1: "0711111111", mobile2: "0777777777", address1: "10 Main Street", city: "Colombo" },
  items: [{ id: "item-1", name: "Ceylon Cinnamon", variant: "Premium", quantity: 2, unit: "packs", weight: 250, unitPrice: 1500, discount: 0, subtotal: 3000 }],
  shipping: { method: "Air Freight" },
} as Order;

const settings = { businessName: "Piyu Products", phone: "0712345678", address: "Middeniya", receiptWidth: "A4", footer: "" } as BusinessSettings;

describe("commercial invoice PDF", () => {
  afterEach(() => {
    downloadBlob.mockReset();
    vi.unstubAllGlobals();
  });

  it("creates an A4 PDF download even when the logo is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Logo unavailable")));
    await createCommercialInvoicePdf(order, settings, {
      countryAndZip: "Australia 2000",
      description: "Premium Sri Lankan food products",
      descriptionBold: true,
      descriptionItalic: false,
      totalQuantity: 2,
      totalNetWeight: "0.50 kg",
      totalGrossWeight: "0.75 kg",
      boxDimensions: "30 x 20 x 15 cm",
      shippingCharges: 2500,
    });

    expect(downloadBlob).toHaveBeenCalledOnce();
    const [filename, blob, mimeType] = downloadBlob.mock.calls[0] as [string, Blob, string];
    expect(filename).toBe("commercial-invoice-FC3885A.pdf");
    expect(mimeType).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1_000);
    expect(new TextDecoder().decode(await blob.slice(0, 8).arrayBuffer())).toContain("%PDF-");
  });
});
