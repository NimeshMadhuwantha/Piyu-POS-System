import type { Order } from "../types";

export const ORDER_PREFIXES = ["FC", "BD", "WD", "ND", "COD", "IEC", "IAE", "LC", "SP", "EMS"] as const;
export const ORDER_SUFFIXES = ["A", "B"] as const;
export const FIRST_ORDER_NUMBER = 3884;

export type OrderPrefix = typeof ORDER_PREFIXES[number];
export type OrderSuffix = typeof ORDER_SUFFIXES[number];

const structuredOrderCode = new RegExp(`^(${ORDER_PREFIXES.join("|")})([1-9]\\d{3,})([${ORDER_SUFFIXES.join("")}])$`);

export function formatOrderCode(prefix: OrderPrefix, number: string, suffix: OrderSuffix) {
  return `${prefix}${number}${suffix}`;
}

export function parseOrderCode(code: string) {
  const match = structuredOrderCode.exec(code.trim().toUpperCase());
  if (!match) return null;
  return { prefix: match[1] as OrderPrefix, number: match[2], suffix: match[3] as OrderSuffix };
}

export function orderMiddleNumber(order: Pick<Order, "orderCode" | "orderNumber">) {
  if (order.orderNumber && /^[1-9]\d{3,}$/.test(order.orderNumber)) return order.orderNumber;
  return parseOrderCode(order.orderCode)?.number || null;
}

export function nextOrderNumber(orders: Array<Pick<Order, "orderCode" | "orderNumber">>) {
  const usedNumbers = orders.map(orderMiddleNumber).filter((value): value is string => Boolean(value));
  const highestUsed = usedNumbers.reduce((highest, value) => Math.max(highest, Number(value)), FIRST_ORDER_NUMBER - 1);
  return String(Math.max(FIRST_ORDER_NUMBER + orders.length, highestUsed + 1));
}

export function generateOrderCode(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), n => chars[n % chars.length]).join("");
  return `ORD-${stamp}-${suffix}`;
}
