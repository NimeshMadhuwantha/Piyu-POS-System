import { primaryOrderStatus } from "@/lib/order-status";
import type { OrderStatus } from "@/types";

const orderStatuses = new Set<OrderStatus>(["New","Pending","Confirmed","Processing","Packed","Shipped","Delivered","Delivery Failed","Cancelled","Canceled","Returned"]);

export function StatusBadge({value}:{value:string}) {
  const display = orderStatuses.has(value as OrderStatus) ? primaryOrderStatus(value as OrderStatus) : value;
  return <span className={`badge ${display.replaceAll(" ","")}`}>{display}</span>;
}
