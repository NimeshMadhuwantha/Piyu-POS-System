import { format } from "date-fns";
import { downloadBlob } from "@/lib/export";
import type { BusinessSettings, CommercialInvoiceDetails, Order } from "@/types";
import type { jsPDF as JsPdf } from "jspdf";

const MAROON: [number, number, number] = [101, 21, 43];
const MAROON_LIGHT: [number, number, number] = [255, 242, 245];
const INK: [number, number, number] = [32, 24, 29];
const MUTED: [number, number, number] = [105, 91, 97];
const LINE: [number, number, number] = [222, 195, 202];

interface DescriptionRun { text: string; bold: boolean; italic: boolean }

function descriptionRuns(details: CommercialInvoiceDetails): DescriptionRun[] {
  if (!details.descriptionHtml || typeof DOMParser === "undefined") {
    return [{ text: details.description, bold: details.descriptionBold, italic: details.descriptionItalic }];
  }
  const parsed = new DOMParser().parseFromString(details.descriptionHtml, "text/html");
  const runs: DescriptionRun[] = [];
  const add = (text: string, bold: boolean, italic: boolean) => {
    if (!text) return;
    const previous = runs.at(-1);
    if (previous && previous.bold === bold && previous.italic === italic) previous.text += text;
    else runs.push({ text, bold, italic });
  };
  const walk = (node: Node, bold = false, italic = false) => {
    if (node.nodeType === 3) { add(node.textContent || "", bold, italic); return; }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (tag === "br") { add("\n", bold, italic); return; }
    const block = tag === "div" || tag === "p";
    if (block && runs.length && !runs.at(-1)?.text.endsWith("\n")) add("\n", bold, italic);
    const weight = element.style.fontWeight;
    const nextBold = bold || tag === "b" || tag === "strong" || weight === "bold" || Number(weight) >= 600;
    const nextItalic = italic || tag === "i" || tag === "em" || element.style.fontStyle === "italic";
    element.childNodes.forEach(child => walk(child, nextBold, nextItalic));
    if (block && !runs.at(-1)?.text.endsWith("\n")) add("\n", nextBold, nextItalic);
  };
  parsed.body.childNodes.forEach(node => walk(node));
  return runs.length ? runs : [{ text: details.description, bold: false, italic: false }];
}

function drawRichDescription(doc: JsPdf, runs: DescriptionRun[], x: number, y: number, maxWidth: number, maxLines = 4) {
  const fontSize = 8;
  const lineHeight = 3.5;
  let cursorX = x;
  let cursorY = y;
  let line = 1;
  let stopped = false;
  const nextLine = () => {
    line += 1;
    if (line > maxLines) { stopped = true; return; }
    cursorX = x;
    cursorY += lineHeight;
  };
  for (const run of runs) {
    const fontStyle = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    for (const token of run.text.replace(/\r/g, "").split(/(\n|\s+)/)) {
      if (stopped || !token) continue;
      if (token === "\n") { nextLine(); continue; }
      const isSpace = /^\s+$/.test(token);
      if (isSpace && cursorX === x) continue;
      const width = doc.getTextWidth(token);
      if (!isSpace && cursorX > x && cursorX + width > x + maxWidth) nextLine();
      if (stopped) break;
      if (!isSpace) doc.text(token, cursorX, cursorY);
      cursorX += width;
    }
    if (stopped) break;
  }
}

export async function createCommercialInvoicePdf(order: Order, settings: BusinessSettings, details: CommercialInvoiceDetails) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const phone = settings.phone?.trim() || "-";
  const email = "piyuproduct@gmail.com";
  const money = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const goodsTotal = order.items.reduce((sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice), 0);
  const totalAmount = goodsTotal + details.shippingCharges;
  const customerAddress = [order.customer.address1, order.customer.address2, order.customer.city, order.customer.district].filter(value => value?.trim()).join(", ");
  const customerMobiles = [order.customer.mobile1, order.customer.mobile2].filter(value => value?.trim()).join(" / ");

  doc.setProperties({
    title: `Commercial Invoice ${order.orderCode}`,
    subject: `Commercial invoice for ${order.customer.name}`,
    author: "Piyu Products",
  });

  doc.setFillColor(...MAROON);
  doc.rect(0, 0, pageWidth, 5, "F");
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.45);
  doc.roundedRect(8, 8, pageWidth - 16, 281, 2, 2, "S");

  try {
    const response = await fetch("/icons/piyu%20logo.png");
    if (response.ok) doc.addImage(new Uint8Array(await response.arrayBuffer()), "PNG", margin, 13, 28, 22, undefined, "FAST");
  } catch {
    // The invoice remains usable if the local logo asset cannot be loaded.
  }

  doc.setTextColor(...MAROON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Piyu Products", 43, 18);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Sri Lanka Village Taste", 43, 23);
  doc.text(`Tel/WhatsApp: ${phone}`, 43, 28);
  doc.text(`Email: ${email}`, 43, 33);

  doc.setTextColor(...MAROON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PIYU PRODUCTS", pageWidth - margin, 17, { align: "right" });
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(["103/B,", "Middeniya,", "Sri Lanka."], pageWidth - margin, 22, { align: "right", lineHeightFactor: 1.35 });

  doc.setFillColor(...MAROON);
  doc.roundedRect(margin, 41, contentWidth, 13, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("COMMERCIAL INVOICE", pageWidth / 2, 49.5, { align: "center" });

  doc.setTextColor(...INK);
  doc.setFontSize(8.5);
  doc.text(`Invoice No: ${order.orderCode}`, margin, 61);
  doc.text(`Date: ${format(new Date(), "dd MMMM yyyy")}`, pageWidth - margin, 61, { align: "right" });

  const partyY = 67;
  const partyGap = 5;
  const partyWidth = (contentWidth - partyGap) / 2;
  const partyHeight = 46;
  const drawPartyBox = (x: number, title: string) => {
    doc.setFillColor(...MAROON_LIGHT);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, partyY, partyWidth, partyHeight, 1.5, 1.5, "FD");
    doc.setFillColor(...MAROON);
    doc.roundedRect(x, partyY, partyWidth, 8, 1.5, 1.5, "F");
    doc.rect(x, partyY + 5, partyWidth, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title, x + 4, partyY + 5.4);
  };
  drawPartyBox(margin, "EXPORTER / SELLER");
  drawPartyBox(margin + partyWidth + partyGap, "SHIP TO");

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PIYU PRODUCTS", margin + 4, partyY + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(["103/B, Middeniya, Sri Lanka.", `Tel/WhatsApp: ${phone}`, `Email: ${email}`], margin + 4, partyY + 19, { lineHeightFactor: 1.45 });

  const shipX = margin + partyWidth + partyGap + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(order.customer.name, shipX, partyY + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  const shipLines = doc.splitTextToSize(customerAddress || "Address not provided", partyWidth - 8).slice(0, 2);
  doc.text(shipLines, shipX, partyY + 19, { lineHeightFactor: 1.3 });
  let shipInfoY = partyY + 19 + shipLines.length * 3.8;
  doc.text(details.countryAndZip, shipX, shipInfoY);
  shipInfoY += 4;
  if (customerMobiles) { doc.text(`Mobile: ${customerMobiles}`, shipX, shipInfoY); shipInfoY += 4; }
  if (order.customer.email) doc.text(`Email: ${order.customer.email}`, shipX, shipInfoY);

  const metaY = 118;
  const metaItems = [
    ["COUNTRY OF ORIGIN", "Sri Lanka"],
    ["SHIPPING METHOD", order.shipping.method || "-"],
    ["CURRENCY", "LKR"],
  ];
  const metaWidth = contentWidth / 3;
  metaItems.forEach(([label, value], index) => {
    const x = margin + index * metaWidth;
    doc.setFillColor(index % 2 ? 250 : 255, 247, 248);
    doc.setDrawColor(...LINE);
    doc.rect(x, metaY, metaWidth, 15, "FD");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(label, x + 3, metaY + 5);
    doc.setTextColor(...INK);
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(value, metaWidth - 6)[0] || "-", x + 3, metaY + 11);
  });

  const descriptionY = 138;
  doc.setTextColor(...MAROON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESCRIPTION OF GOODS", margin, descriptionY);
  doc.setFillColor(255, 250, 251);
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, descriptionY + 3, contentWidth, 18, 1.5, 1.5, "FD");
  doc.setTextColor(...INK);
  drawRichDescription(doc, descriptionRuns(details), margin + 4, descriptionY + 8, contentWidth - 8);

  const summaryY = 164;
  const summaryItems = [
    ["TOTAL QUANTITY", String(details.totalQuantity)],
    ["TOTAL NET WEIGHT", details.totalNetWeight],
    ["TOTAL GROSS WEIGHT", details.totalGrossWeight],
    ["BOX DIMENSIONS (L x W x H)", details.boxDimensions],
  ];
  const summaryWidth = contentWidth / 4;
  summaryItems.forEach(([label, value], index) => {
    const x = margin + index * summaryWidth;
    doc.setDrawColor(...LINE);
    doc.setFillColor(...MAROON_LIGHT);
    doc.rect(x, summaryY, summaryWidth, 16, "FD");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.text(label, x + 2.5, summaryY + 5);
    doc.setTextColor(...MAROON);
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(value, summaryWidth - 5)[0] || "-", x + 2.5, summaryY + 11.5);
  });

  doc.setTextColor(...MAROON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ITEM LIST", margin, 186);
  autoTable(doc, {
    startY: 189,
    margin: { top: 22, left: margin, right: margin, bottom: 37 },
    head: [["No", "Item Name", "Unit Weight", "Qty", "Unit Price (LKR)"]],
    body: order.items.map((item, index) => [
      index + 1,
      `${item.name}${item.variant ? ` (${item.variant})` : ""}`,
      item.weight && item.weight > 0 ? `${money(item.weight)} g` : "-",
      item.quantity,
      money(item.unitPrice),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.15, valign: "middle" },
    headStyles: { fillColor: MAROON, textColor: [255, 255, 255], fontStyle: "bold", minCellHeight: 8 },
    alternateRowStyles: { fillColor: [255, 248, 250] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 28, halign: "right" },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 34, halign: "right" },
    },
    didDrawPage: data => {
      if (data.pageNumber > 1) {
        doc.setFillColor(...MAROON);
        doc.rect(0, 0, pageWidth, 5, "F");
        doc.setTextColor(...MAROON);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`COMMERCIAL INVOICE - ${order.orderCode}`, margin, 14);
      }
    },
  });

  const tableEndY = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let totalsY = tableEndY + 5;
  if (totalsY > 249) {
    doc.addPage();
    doc.setFillColor(...MAROON);
    doc.rect(0, 0, pageWidth, 5, "F");
    totalsY = 17;
  }
  const totalsX = pageWidth - margin - 74;
  doc.setFillColor(255, 248, 250);
  doc.setDrawColor(...LINE);
  doc.roundedRect(totalsX, totalsY, 74, 25, 1.5, 1.5, "FD");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Items total", totalsX + 4, totalsY + 7);
  doc.text(`LKR ${money(goodsTotal)}`, totalsX + 70, totalsY + 7, { align: "right" });
  doc.text("Shipping charges", totalsX + 4, totalsY + 14);
  doc.text(`LKR ${money(details.shippingCharges)}`, totalsX + 70, totalsY + 14, { align: "right" });
  doc.setDrawColor(...MAROON);
  doc.line(totalsX + 4, totalsY + 17, totalsX + 70, totalsY + 17);
  doc.setTextColor(...MAROON);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT", totalsX + 4, totalsY + 22);
  doc.text(`LKR ${money(totalAmount)}`, totalsX + 70, totalsY + 22, { align: "right" });

  let certificationY = totalsY + 32;
  if (certificationY > 274) {
    doc.addPage();
    doc.setFillColor(...MAROON);
    doc.rect(0, 0, pageWidth, 5, "F");
    certificationY = 20;
  }
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.text("I hereby certify that the above information is true and correct.", margin, certificationY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MAROON);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(11);
  doc.text("PIYU PRODUCTS", pageWidth - margin - 27.5, certificationY + 5, { align: "center" });
  doc.setDrawColor(...MAROON);
  doc.line(pageWidth - margin - 55, certificationY + 7, pageWidth - margin, certificationY + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Authorized Signature", pageWidth - margin - 27.5, certificationY + 12, { align: "center" });

  downloadBlob(`commercial-invoice-${order.orderCode}.pdf`, doc.output("blob"), "application/pdf");
}
