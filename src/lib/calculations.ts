import type { OrderItem, PaymentMethod, ShippingDetails } from "@/types";

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const money = (value: number) => Math.round(safe(value) * 100) / 100;

export function effectiveShippingCharge(paymentMethod: PaymentMethod | undefined, shippingCharge: number) {
  return paymentMethod === "Cash on Delivery (COD)" ? 0 : money(shippingCharge);
}

export function calculateLineSubtotal(quantity: number, unitPrice: number, discountPercent = 0) {
  const gross = safe(quantity) * safe(unitPrice);
  const percentage = Math.min(100, safe(discountPercent));
  return money(gross * (1 - percentage / 100));
}

export function calculateTotals(items: Pick<OrderItem, "quantity" | "unitPrice" | "discount">[], orderDiscount = 0, deliveryCharge = 0, amountPaid = 0, paymentMethod?: PaymentMethod) {
  const itemsSubtotal = money(items.reduce((sum, item) => sum + calculateLineSubtotal(item.quantity, item.unitPrice, item.discount), 0));
  const grandTotal = money(Math.max(0, itemsSubtotal - safe(orderDiscount) + safe(deliveryCharge)));
  const paid = money(Math.min(grandTotal, safe(amountPaid)));
  const balance = money(Math.max(0, grandTotal - paid));
  return { itemsSubtotal, grandTotal, amountPaid: paid, balance, codAmount: paymentMethod === "Cash on Delivery (COD)" ? balance : 0 };
}

export function formatLKR(value: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(safe(value));
}

export function calculateLineWeight(unitWeight = 0, quantity = 0) {
  return safe(unitWeight) * safe(quantity);
}

export function calculateItemsWeight(items: Pick<OrderItem, "weight" | "quantity">[]) {
  return items.reduce((sum, item) => sum + calculateLineWeight(item.weight, item.quantity), 0);
}

export function orderTotalWeight(order: { items: Pick<OrderItem, "weight" | "quantity">[]; shipping: Pick<ShippingDetails, "parcelWeight"> }) {
  const hasItemWeight = order.items.some(item => safe(item.weight || 0) > 0);
  if (hasItemWeight) return calculateItemsWeight(order.items);
  return safe(order.shipping.parcelWeight || 0);
}
