import { describe, expect, it } from "vitest";
import { formatOrderCode, nextOrderNumber, orderMiddleNumber, parseOrderCode } from "./order-code";

describe("structured order IDs", () => {
  it("formats and parses every part", () => {
    expect(formatOrderCode("FC", "3885", "A")).toBe("FC3885A");
    expect(parseOrderCode("COD12345B")).toEqual({ prefix: "COD", number: "12345", suffix: "B" });
    expect(parseOrderCode("ORD-legacy")).toBeNull();
  });

  it("uses the stored middle number before parsing the visible code", () => {
    expect(orderMiddleNumber({ orderCode: "FC3885A", orderNumber: "4001" })).toBe("4001");
    expect(orderMiddleNumber({ orderCode: "BD3885B" })).toBe("3885");
  });

  it("starts at 3884 and advances beyond count and used numbers", () => {
    expect(nextOrderNumber([])).toBe("3884");
    expect(nextOrderNumber([{ orderCode: "FC3884A" }])).toBe("3885");
    expect(nextOrderNumber([{ orderCode: "legacy" }, { orderCode: "WD5000B" }])).toBe("5001");
  });
});
