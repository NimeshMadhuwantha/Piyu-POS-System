import { calculateLineWeight, formatLKR, orderTotalWeight } from "./calculations";
import { primaryOrderStatus } from "./order-status";
import { format } from "date-fns";
import type { DeliveryConfirmation, Order } from "../types";

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `94${digits.slice(1)}`;
  return digits;
}

export function invoiceMessage(order: Order) {
  const items = order.items.map((item, index) =>
    `${index + 1}. ${item.name}${item.variant ? ` (${item.variant})` : ""} | Qty: ${item.quantity}${item.weight ? ` | Weight: ${calculateLineWeight(item.weight, item.quantity).toLocaleString("en-LK", { maximumFractionDigits: 2 })} g` : ""} | ${formatLKR(item.subtotal)}`,
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
    `Total weight: ${orderTotalWeight(order).toLocaleString("en-LK", { maximumFractionDigits: 2 })} g`,
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
  const number = whatsappNumber(order.customer.mobile2 || order.customer.mobile1);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(invoiceMessage(order))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function deliveredInvoiceMessage(order: Order, delivery: DeliveryConfirmation) {
  const date = format(new Date(delivery.confirmedAtClient), "dd/MM/yyyy");
  const mobiles = [order.customer.mobile1, order.customer.mobile2].filter(Boolean).join(" / ");
  const items = order.items.map((item, index) => `${index + 1}. ${item.name}${item.variant ? ` (${item.variant})` : ""} x ${item.quantity}`).join("\n");
  return [
    "ආයුබෝවන්...",
    "",
    `ඔබගේ ඇනවුම (${date}) Deliver 🚛 සඳහා භාරදෙන ලදී.`,
    `රැගෙන ඒමට පෙර ඔබ ලබා දුන් දුරකථන අංකයට (${mobiles}) ඔවුන් අමතන 📲 බැවින් ඒ පිළිබඳව අවධානයෙන් කටයුතු කරන මෙන් දැනුවත් කරමු.`,
    "",
    "Item list",
    items,
    "",
    `Tracking number: ${delivery.trackingNumber}`,
    `Weight: ${delivery.parcelWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g`,
    `Value: ${formatLKR(delivery.value)}`,
    delivery.deliveryPaid ? "Deliver Paid" : "",
    "",
    "Piyu Product අප ආයතනය හා සම්බන්ධ වූවාට ස්තූතී🙏🙏🙏",
    "",
    "🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸",
  ].filter((line, index, values) => line !== "" || values[index - 1] !== "").join("\n");
}

export function openWhatsAppDeliveredInvoice(order: Order, delivery: DeliveryConfirmation) {
  const number = whatsappNumber(order.customer.whatsappNumber || order.customer.mobile2 || order.customer.mobile1);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(deliveredInvoiceMessage(order, delivery))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
