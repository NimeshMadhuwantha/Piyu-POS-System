import type { OrderStatus } from "@/types";

export type PrimaryOrderStatus = "Pending" | "Delivered" | "Canceled" | "Returned";

export function primaryOrderStatus(status: OrderStatus): PrimaryOrderStatus {
  if (status === "Delivered") return "Delivered";
  if (status === "Returned") return "Returned";
  if (status === "Cancelled" || status === "Canceled" || status === "Delivery Failed") return "Canceled";
  return "Pending";
}
