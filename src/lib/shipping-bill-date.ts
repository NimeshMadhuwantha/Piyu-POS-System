import type { Order } from "../types";

export function getShippingBillHeaderDate(order: Pick<Order, "requestDate" | "deliveryDate">): string {
  if (order.requestDate && order.requestDate.trim()) return order.requestDate.trim();
  if (order.deliveryDate && order.deliveryDate.trim()) return order.deliveryDate.trim();
  return ".......................";
}
