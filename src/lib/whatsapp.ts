import { formatLKR } from "@/lib/calculations";
import { primaryOrderStatus } from "@/lib/order-status";
import type { Order } from "@/types";

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `94${digits.slice(1)}`;
  return digits;
}

export function invoiceMessage(order: Order) {
  const items = order.items.map((item, index) =>
    `${index + 1}. ${item.name}${item.variant ? ` (${item.variant})` : ""} x ${item.quantity} - ${formatLKR(item.subtotal)}`,
  ).join("\n");
  return [
    `*INVOICE ${order.orderCode}*`,
    `Customer: ${order.customer.name}`,
    order.customer.email ? `Email: ${order.customer.email}` : "",
    `Mobile: ${order.customer.mobile1}`,
    `Address: ${[order.customer.address1, order.customer.address2, order.customer.city, order.customer.district].filter(Boolean).join(", ")}`,
    "",
    "*Items*",
    items,
    "",
    `Items subtotal: ${formatLKR(order.itemsSubtotal)}`,
    `Order discount: -${formatLKR(order.orderDiscount)}`,
    `Delivery charge: ${formatLKR(order.deliveryCharge)}`,
    `*Grand total: ${formatLKR(order.grandTotal)}*`,
    `Paid: ${formatLKR(order.amountPaid)}`,
    `Balance / COD: ${formatLKR(order.balance)}`,
    `Payment: ${order.payment.method}`,
    `Delivery: ${order.shipping.method}${order.shipping.courier ? ` - ${order.shipping.courier}` : ""}`,
    order.deliveryDate ? `Delivery date: ${order.deliveryDate}` : "",
    `Status: ${primaryOrderStatus(order.orderStatus)}`,
  ].filter(line => line !== "").join("\n");
}

export function openWhatsAppInvoice(order: Order) {
  const number = whatsappNumber(order.customer.mobile1);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(invoiceMessage(order))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
