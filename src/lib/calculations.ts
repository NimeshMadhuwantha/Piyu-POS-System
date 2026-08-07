import type { OrderItem, PaymentMethod } from "@/types";

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const money = (value: number) => Math.round(safe(value) * 100) / 100;

export function calculateLineSubtotal(quantity: number, unitPrice: number, discount = 0) {
  return money(Math.max(0, safe(quantity) * safe(unitPrice) - safe(discount)));
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
