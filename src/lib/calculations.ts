import type { DiscountType, OrderItem, PaymentMethod, ShippingDetails } from "@/types";

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const money = (value: number) => Math.round(safe(value) * 100) / 100;

export function effectiveShippingCharge(paymentMethod: PaymentMethod | undefined, shippingCharge: number) {
  return paymentMethod === "Cash on Delivery (COD)" ? 0 : money(shippingCharge);
}

export function calculateLineSubtotal(quantity: number, unitPrice: number, discount = 0, discountType: DiscountType = "percent") {
  const gross = safe(quantity) * safe(unitPrice);
  const discountAmount = discountType === "amount"
    ? Math.min(gross, safe(discount))
    : gross * Math.min(100, safe(discount)) / 100;
  return money(gross - discountAmount);
}

export function calculateOrderSummary(items: Pick<OrderItem, "quantity" | "unitPrice" | "discount" | "discountType">[], orderDiscount = 0, deliveryCharge = 0) {
  const totalItemCount = items.length;
  const totalQty = items.reduce((sum, item) => sum + safe(item.quantity), 0);
  const totalUnitPrice = money(items.reduce((sum, item) => sum + safe(item.quantity) * safe(item.unitPrice), 0));
  const totalDiscount = money(items.reduce((sum, item) => {
    const gross = safe(item.quantity) * safe(item.unitPrice);
    const discountAmount = item.discountType === "amount"
      ? Math.min(gross, safe(item.discount))
      : gross * Math.min(100, safe(item.discount)) / 100;
    return sum + discountAmount;
  }, 0));
  const itemsSubtotal = money(Math.max(0, totalUnitPrice - totalDiscount));
  const shippingCost = money(safe(deliveryCharge));
  const grandTotal = money(Math.max(0, itemsSubtotal - safe(orderDiscount) + shippingCost));
  return { totalItemCount, totalQty, totalUnitPrice, totalDiscount, itemsSubtotal, shippingCost, orderDiscount: money(safe(orderDiscount)), grandTotal };
}

export function calculateTotals(items: Pick<OrderItem, "quantity" | "unitPrice" | "discount" | "discountType">[], orderDiscount = 0, deliveryCharge = 0, amountPaid = 0, paymentMethod?: PaymentMethod) {
  const summary = calculateOrderSummary(items, orderDiscount, deliveryCharge);
  const paid = money(Math.min(summary.grandTotal, safe(amountPaid)));
  const balance = money(Math.max(0, summary.grandTotal - paid));
  return { itemsSubtotal: summary.itemsSubtotal, grandTotal: summary.grandTotal, amountPaid: paid, balance, codAmount: paymentMethod === "Cash on Delivery (COD)" ? balance : 0 };
}

export function formatLKR(value: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(safe(value));
}

export function formatItemDiscount(item: Pick<OrderItem, "discount" | "discountType">) {
  if (safe(item.discount) <= 0) return "-";
  return item.discountType === "amount" ? formatLKR(item.discount) : `${safe(item.discount)}%`;
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
