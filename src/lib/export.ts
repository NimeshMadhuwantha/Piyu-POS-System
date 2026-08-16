import { format } from "date-fns";
import { primaryOrderStatus } from "@/lib/order-status";
import { calculateLineWeight, orderTotalWeight } from "@/lib/calculations";
import type { Order } from "@/types";

const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function ordersCsv(orders: Order[]) {
  const itemValues = (order: Order, value: (item: Order["items"][number]) => unknown) => order.items.map(item => String(value(item) ?? "")).join(" | ");
  const rows = [[
    "Created date/time", "Updated date/time", "Order ID", "Internal record ID", "Customer ID", "Customer name", "Email", "Primary mobile", "WhatsApp number",
    "Address line 1", "Address line 2", "City", "District", "Customer note", "Item names", "Item categories", "Quantities", "Units",
    "Unit weights (g)", "Line weights (g)", "Unit prices (LKR)", "Item discounts (%)", "Line totals (LKR)", "Total item quantity", "Total weight (g)",
    "Shipping method", "Courier / company", "Tracking number", "Confirmed parcel weight (g)", "Delivery value (LKR)", "Deliver paid", "Delivery confirmed at", "Shipping note", "Request date", "Delivery date", "Payment method", "Payment status",
    "Items subtotal (LKR)", "Order discount (LKR)", "Shipping charge (LKR)", "Grand total (LKR)", "Paid (LKR)", "Balance (LKR)",
    "Order status", "Order notes", "Created by", "Created by user ID", "Updated by user ID", "Sync status",
  ], ...orders.map(order => [
    order.createdAtClient, order.updatedAtClient, order.orderCode, order.id, order.customerId || "", order.customer.name, order.customer.email || "",
    order.customer.mobile1, order.customer.mobile2 || "", order.customer.address1, order.customer.address2 || "", order.customer.city || "", order.customer.district || "",
    order.customer.note || "", itemValues(order, item => item.name), itemValues(order, item => item.variant || ""), itemValues(order, item => item.quantity),
    itemValues(order, item => item.unit), itemValues(order, item => item.weight || 0), itemValues(order, item => calculateLineWeight(item.weight, item.quantity)),
    itemValues(order, item => item.unitPrice), itemValues(order, item => item.discount), itemValues(order, item => item.subtotal),
    order.items.reduce((sum, item) => sum + item.quantity, 0), orderTotalWeight(order), order.shipping.method, order.shipping.courier || "",
    order.shipping.trackingNumber || "", order.deliveryConfirmation?.parcelWeight || "", order.deliveryConfirmation?.value ?? "", order.deliveryConfirmation?.deliveryPaid ? "Yes" : "No", order.deliveryConfirmation?.confirmedAtClient || "", order.shipping.note || "", order.requestDate, order.deliveryDate || "", order.payment.method, order.paymentStatus,
    order.itemsSubtotal, order.orderDiscount, order.deliveryCharge, order.grandTotal, order.amountPaid, order.balance, primaryOrderStatus(order.orderStatus),
    order.notes || "", order.createdByName, order.createdBy, order.updatedBy, order.pending ? "Waiting to sync" : "Synced",
  ])];
  return `\uFEFF${rows.map(row => row.map(esc).join(",")).join("\n")}`;
}

export function downloadBlob(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function reportPdf(orders: Order[], title = "Piyu POS Report", filename = `piyu-pos-${format(new Date(), "yyyy-MM-dd")}.pdf`) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const columns = [
    { label: "Date", x: 14, width: 20 }, { label: "Order", x: 34, width: 25 },
    { label: "Customer", x: 59, width: 32 }, { label: "Mobile", x: 91, width: 26 },
    { label: "Weight (g)", x: 117, width: 20, right: true }, { label: "Status", x: 137, width: 25 },
    { label: "Total", x: 162, width: 34, right: true },
  ];
  const clean = (value: unknown) => String(value ?? "").replace(/[^\x20-\x7E]/g, " ");
  const fit = (value: unknown, width: number) => {
    const text = clean(value);
    if (doc.getTextWidth(text) <= width - 3) return text;
    let shortened = text;
    while (shortened.length && doc.getTextWidth(`${shortened}...`) > width - 3) shortened = shortened.slice(0, -1);
    return `${shortened}...`;
  };
  const drawHeader = (firstPage: boolean) => {
    let y = margin;
    if (firstPage) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(fit(title, pageWidth - margin * 2), margin, 17);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, h:mm a")}`, margin, 24);
      const total = orders.reduce((sum, order) => sum + order.grandTotal, 0);
      const totalWeight = orders.reduce((sum, order) => sum + orderTotalWeight(order), 0);
      doc.text(`Orders: ${orders.length}     Total sales: LKR ${total.toFixed(2)}`, margin, 30);
      doc.text(`Total weight: ${totalWeight.toFixed(2)} g`, margin, 35); y = 41;
    }
    doc.setFillColor(220, 38, 38); doc.rect(margin, y, pageWidth - margin * 2, 8, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    columns.forEach(column => doc.text(column.label, column.right ? column.x + column.width - 2 : column.x + 2, y + 5.3, column.right ? { align: "right" } : undefined));
    doc.setTextColor(23, 32, 51); doc.setFont("helvetica", "normal");
    return y + 8;
  };
  let y = drawHeader(true);
  doc.setFontSize(7);
  orders.forEach((order, index) => {
    if (y + 8 > pageHeight - margin) { doc.addPage(); y = drawHeader(false); doc.setFontSize(7); }
    if (index % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, pageWidth - margin * 2, 8, "F"); }
    const values = [format(new Date(order.createdAtClient), "dd/MM/yy"), order.orderCode, order.customer.name, order.customer.mobile1, orderTotalWeight(order).toFixed(2), primaryOrderStatus(order.orderStatus), order.grandTotal.toFixed(2)];
    columns.forEach((column, columnIndex) => doc.text(fit(values[columnIndex], column.width), column.right ? column.x + column.width - 2 : column.x + 2, y + 5.2, column.right ? { align: "right" } : undefined));
    doc.setDrawColor(226, 232, 240); doc.line(margin, y + 8, pageWidth - margin, y + 8); y += 8;
  });
  if (!orders.length) { doc.setFontSize(9); doc.text("No orders for this report period.", margin + 2, y + 8); }
  downloadBlob(filename, doc.output("blob"), "application/pdf");
}
