import type { Order } from "../types";

export function reportTrackingNumber(order: Pick<Order, "deliveryConfirmation" | "shipping">) {
  return order.deliveryConfirmation?.trackingNumber || order.shipping.trackingNumber || "-";
}
