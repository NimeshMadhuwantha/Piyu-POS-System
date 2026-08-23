import { isThisMonth, isThisWeek, isToday, isYesterday } from "date-fns";
import { parseOrderCode } from "./order-code";
import { primaryOrderStatus, type PrimaryOrderStatus } from "./order-status";
import type { Order, OrderLog, OrderStatus } from "@/types";

export type ReportPeriod = "Today" | "Yesterday" | "This Week" | "This Month" | "Custom" | "All time";

export interface ReportFilters {
  period: ReportPeriod;
  start: string;
  end: string;
  orderPrefix: string;
  orderSuffix: string;
  status: "All" | PrimaryOrderStatus;
}

type ReportFilterOrder = Pick<Order, "createdAtClient" | "orderCode" | "orderPrefix" | "orderSuffix" | "orderStatus">;
export type ReportStatusDates = Record<string, Partial<Record<PrimaryOrderStatus, string>>>;

const ORDER_STATUSES: OrderStatus[] = ["New", "Pending", "Confirmed", "Processing", "Packed", "Shipped", "Delivered", "Delivery Failed", "Cancelled", "Canceled", "Returned"];

function reportStatusFromValue(value: unknown): PrimaryOrderStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const status = ORDER_STATUSES.find(candidate => candidate.toLowerCase() === normalized.toLowerCase());
  return status ? primaryOrderStatus(status) : null;
}

function logStatus(log: Pick<OrderLog, "action" | "description" | "newValue">) {
  if (log.action === "Delivery confirmed") return "Delivered";
  if (log.action !== "Status changed" && log.action !== "Order created") return null;
  const value = typeof log.newValue === "object" && log.newValue !== null && "orderStatus" in log.newValue
    ? (log.newValue as { orderStatus?: unknown }).orderStatus
    : log.newValue;
  const directStatus = reportStatusFromValue(value);
  if (directStatus) return directStatus;
  const descriptionStatus = log.action === "Status changed" ? log.description.match(/->\s*(.+?)\s*$/)?.[1] : null;
  return reportStatusFromValue(descriptionStatus);
}

export function buildReportStatusDates(logs: Array<Pick<OrderLog, "orderId" | "action" | "description" | "newValue" | "clientTimestamp">>) {
  return logs.reduce<ReportStatusDates>((dates, log) => {
    const status = logStatus(log);
    const timestamp = new Date(log.clientTimestamp);
    if (!status || Number.isNaN(timestamp.getTime())) return dates;
    const existing = dates[log.orderId]?.[status];
    if (!existing || timestamp > new Date(existing)) {
      dates[log.orderId] = { ...dates[log.orderId], [status]: log.clientTimestamp };
    }
    return dates;
  }, {});
}

export function reportEffectiveDate(order: Pick<Order, "id" | "createdAtClient" | "deliveryConfirmation">, status: ReportFilters["status"], statusDates: ReportStatusDates) {
  if (status === "All") return order.createdAtClient;
  const loggedDate = statusDates[order.id]?.[status];
  if (loggedDate) return loggedDate;
  if (status === "Delivered" && order.deliveryConfirmation?.confirmedAtClient) return order.deliveryConfirmation.confirmedAtClient;
  // Pending is assigned when an order is created, even for legacy orders whose
  // creation log is no longer available.
  if (status === "Pending") return order.createdAtClient;
  return null;
}

function normalizedCodePart(value?: string) {
  return value?.trim().toUpperCase() || "";
}

export function reportOrderCodeParts(order: Pick<ReportFilterOrder, "orderCode" | "orderPrefix" | "orderSuffix">) {
  const parsed = parseOrderCode(order.orderCode);
  return {
    // The visible order code is authoritative. Stored parts remain fallbacks for
    // older records that did not use the current structured code format.
    prefix: parsed?.prefix || normalizedCodePart(order.orderPrefix) || normalizedCodePart(order.orderCode.match(/^[A-Za-z]+/)?.[0]),
    suffix: parsed?.suffix || normalizedCodePart(order.orderSuffix) || normalizedCodePart(order.orderCode.match(/[A-Za-z]$/)?.[0]),
  };
}

function localDateBoundary(value: string, endOfDay: boolean) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function matchesReportFilters(order: ReportFilterOrder, filters: ReportFilters, effectiveDate?: string | null) {
  const matchesStatus = filters.status === "All" || primaryOrderStatus(order.orderStatus) === filters.status;
  if (!matchesStatus) return false;

  const date = new Date(filters.status === "All" ? order.createdAtClient : effectiveDate || "");
  if (filters.period !== "All time" && Number.isNaN(date.getTime())) return false;

  const from = localDateBoundary(filters.start, false);
  const to = localDateBoundary(filters.end, true);
  const matchesDate = filters.period === "Today" ? isToday(date)
    : filters.period === "Yesterday" ? isYesterday(date)
    : filters.period === "This Week" ? isThisWeek(date, { weekStartsOn: 1 })
    : filters.period === "This Month" ? isThisMonth(date)
    : filters.period === "Custom" ? (!from || date >= from) && (!to || date <= to)
    : true;
  const code = reportOrderCodeParts(order);

  return matchesDate
    && (filters.orderPrefix === "All" || code.prefix === filters.orderPrefix)
    && (filters.orderSuffix === "All" || code.suffix === filters.orderSuffix);
}
