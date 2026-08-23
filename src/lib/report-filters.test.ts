import { describe, expect, it } from "vitest";
import { ORDER_PREFIXES } from "./order-code";
import { buildReportStatusDates, matchesReportFilters, reportEffectiveDate, reportOrderCodeParts, type ReportFilters } from "./report-filters";
import type { Order, OrderLog, OrderStatus } from "@/types";

const baseFilters: ReportFilters = {
  period: "Custom",
  start: "2026-08-23",
  end: "2026-08-23",
  orderPrefix: "All",
  orderSuffix: "All",
  status: "All",
};

function order(orderCode: string, orderStatus: OrderStatus, createdAtClient = "2026-08-23T00:01:00") {
  return { orderCode, orderStatus, createdAtClient } as Order;
}

describe("report filters", () => {
  it("includes the entire first and last custom-date days in local time", () => {
    expect(matchesReportFilters(order("COD4000A", "Delivered"), baseFilters)).toBe(true);
    expect(matchesReportFilters(order("COD4000A", "Delivered", "2026-08-23T23:59:59.999"), baseFilters)).toBe(true);
    expect(matchesReportFilters(order("COD4000A", "Delivered", "2026-08-22T23:59:59.999"), baseFilters)).toBe(false);
    expect(matchesReportFilters(order("COD4000A", "Delivered", "2026-08-24T00:00:00"), baseFilters)).toBe(false);
  });

  it.each(ORDER_PREFIXES)("matches the %s order-ID type", prefix => {
    expect(matchesReportFilters(order(`${prefix}4000A`, "Delivered"), { ...baseFilters, orderPrefix: prefix }, "2026-08-23T12:00:00")).toBe(true);
  });

  it.each(["Pending", "Processing", "Delivered", "Canceled", "Returned"] as const)("matches the %s status", status => {
    const storedStatus: OrderStatus = status === "Canceled" ? "Cancelled" : status;
    expect(matchesReportFilters(order("COD4000A", storedStatus), { ...baseFilters, orderPrefix: "COD", status }, "2026-08-23T12:00:00")).toBe(true);
  });

  it("uses the status-change date instead of the order-created date", () => {
    const delivered = order("COD4000A", "Delivered", "2026-08-01T12:00:00");
    const filters = { ...baseFilters, orderPrefix: "COD", status: "Delivered" } as const;
    expect(matchesReportFilters(delivered, filters, "2026-08-23T15:30:00")).toBe(true);
    expect(matchesReportFilters(delivered, filters, "2026-08-22T15:30:00")).toBe(false);
  });

  it("keeps only the latest transition date for every order and status", () => {
    const log = (newValue: unknown, clientTimestamp: string, action = "Status changed") => ({
      orderId: "order-1", action, description: action === "Status changed" ? `Pending -> ${String(newValue)}` : action,
      newValue, clientTimestamp,
    }) as OrderLog;
    const dates = buildReportStatusDates([
      log("Processing", "2026-08-20T09:00:00"),
      log("Delivered", "2026-08-21T09:00:00"),
      log("Processing", "2026-08-23T09:00:00"),
      log({ orderStatus: "Delivered" }, "2026-08-24T09:00:00", "Delivery confirmed"),
      log("Cancelled", "2026-08-25T09:00:00"),
    ]);
    expect(dates["order-1"]).toMatchObject({
      Processing: "2026-08-23T09:00:00",
      Delivered: "2026-08-24T09:00:00",
      Canceled: "2026-08-25T09:00:00",
    });
  });

  it("uses creation for Pending legacy orders and delivery confirmation as a Delivered fallback", () => {
    const pending = { id: "pending", createdAtClient: "2026-08-20T10:00:00" } as Order;
    const delivered = { id: "delivered", createdAtClient: "2026-08-01T10:00:00", deliveryConfirmation: { confirmedAtClient: "2026-08-23T10:00:00" } } as Order;
    expect(reportEffectiveDate(pending, "Pending", {})).toBe("2026-08-20T10:00:00");
    expect(reportEffectiveDate(delivered, "Delivered", {})).toBe("2026-08-23T10:00:00");
    expect(reportEffectiveDate(pending, "Processing", {})).toBeNull();
  });

  it("uses a valid visible code ahead of stale stored parts and normalizes legacy stored parts", () => {
    expect(reportOrderCodeParts({ orderCode: "COD4000A", orderPrefix: "FC", orderSuffix: "B" })).toEqual({ prefix: "COD", suffix: "A" });
    expect(reportOrderCodeParts({ orderCode: "legacy", orderPrefix: " cod ", orderSuffix: " a " })).toEqual({ prefix: "COD", suffix: "A" });
  });
});
