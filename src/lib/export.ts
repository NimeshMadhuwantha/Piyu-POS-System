import { format } from "date-fns";
import { primaryOrderStatus } from "@/lib/order-status";
import type { Order } from "@/types";

const esc = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function ordersCsv(orders: Order[]) {
  const rows = [["Date", "Order code", "Customer", "Email", "Mobile", "Shipping method", "Payment method", "Order status", "Grand total", "Paid", "Balance"], ...orders.map(order => [order.createdAtClient, order.orderCode, order.customer.name, order.customer.email || "", order.customer.mobile1, order.shipping.method, order.payment.method, primaryOrderStatus(order.orderStatus), order.grandTotal, order.amountPaid, order.balance])];
  return rows.map(row => row.map(esc).join(",")).join("\n");
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

export async function reportPdf(orders: Order[], title = "Piyu POS Report") {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const columns = [
    { label: "Date", x: 14, width: 22 }, { label: "Order", x: 36, width: 28 },
    { label: "Customer", x: 64, width: 43 }, { label: "Mobile", x: 107, width: 31 },
    { label: "Status", x: 138, width: 27 }, { label: "Total", x: 165, width: 31, right: true },
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
      doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(clean(title), margin, 17);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, h:mm a")}`, margin, 24);
      const total = orders.reduce((sum, order) => sum + order.grandTotal, 0);
      doc.text(`Orders: ${orders.length}     Total sales: LKR ${total.toFixed(2)}`, margin, 30); y = 36;
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
    const values = [format(new Date(order.createdAtClient), "dd/MM/yy"), order.orderCode, order.customer.name, order.customer.mobile1, primaryOrderStatus(order.orderStatus), order.grandTotal.toFixed(2)];
    columns.forEach((column, columnIndex) => doc.text(fit(values[columnIndex], column.width), column.right ? column.x + column.width - 2 : column.x + 2, y + 5.2, column.right ? { align: "right" } : undefined));
    doc.setDrawColor(226, 232, 240); doc.line(margin, y + 8, pageWidth - margin, y + 8); y += 8;
  });
  if (!orders.length) { doc.setFontSize(9); doc.text("No orders for this report period.", margin + 2, y + 8); }
  downloadBlob(`piyu-pos-${format(new Date(), "yyyy-MM-dd")}.pdf`, doc.output("blob"), "application/pdf");
}
