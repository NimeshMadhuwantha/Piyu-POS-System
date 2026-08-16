"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { format } from "date-fns";
import { Eye, MessageCircle, Printer } from "lucide-react";
import { formatLKR, orderTotalWeight } from "@/lib/calculations";
import { openWhatsAppInvoice } from "@/lib/whatsapp";
import { StatusBadge } from "./status-badge";
import { ReceiptPrintHost } from "./receipt-print-host";
import { getBusinessSettings } from "@/lib/repositories";
import { clearPrintTarget, openPrintDialog, setPrintTarget } from "@/lib/printing";
import type { BusinessSettings, Order } from "@/types";
import { RECORD_PAGE_SIZE, ViewMore } from "./view-more";

function OrderActions({ order, printing, printOrder }: { order: Order; printing: boolean; printOrder: (order: Order) => void }) {
  return <div className="order-actions no-print">
    <Link className="btn secondary" href={`/orders/${order.id}`}><Eye size={16}/>View bill</Link>
    <button className="btn secondary" type="button" disabled={printing} aria-busy={printing} onClick={() => printOrder(order)}>{printing ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={16}/>Print bill</>}</button>
    <button className="btn whatsapp" type="button" onClick={() => openWhatsAppInvoice(order)}><MessageCircle size={16}/>Send invoice</button>
  </div>;
}

export function OrderList({ orders, showWeight = false }: { orders: Order[]; showWeight?: boolean }) {
  const [visibleCount, setVisibleCount] = useState(RECORD_PAGE_SIZE);
  const [settings, setSettings] = useState<BusinessSettings>({ businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!" });
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  useEffect(() => { getBusinessSettings().then(setSettings).catch(() => undefined); }, []);
  useEffect(() => () => clearPrintTarget("receipt"), []);
  const printOrder = useCallback((order: Order) => {
    setPrintTarget("receipt");
    flushSync(() => {
      setPrintError("");
      setSelectedPrintOrder(order);
      setPrintingOrderId(order.id);
    });
    const error = openPrintDialog();
    setPrintingOrderId(null);
    if (error) {
      clearPrintTarget("receipt");
      setPrintError(error);
    }
  }, []);
  if (!orders.length) return <div className="card muted">No orders match your search or filters.</div>;
  const visibleOrders = orders.slice(0, visibleCount);
  return <>
    <div className="card desktop-table table-wrap"><table className="table order-table"><thead><tr><th>Order / Date</th><th>Customer</th><th>Total</th>{showWeight && <th>Total weight</th>}<th>Shipping</th><th>Payment</th><th>Status</th><th>Sync</th><th className="no-print">Actions</th></tr></thead><tbody>{visibleOrders.map(order => <tr key={order.id}>
      <td><Link href={`/orders/${order.id}`}><b>{order.orderCode}</b></Link><div className="muted">{format(new Date(order.createdAtClient), "dd MMM yyyy, h:mm a")}</div></td>
      <td>{order.customer.name}<div className="muted">{order.customer.mobile1}</div></td>
      <td>{formatLKR(order.grandTotal)}</td>{showWeight && <td>{orderTotalWeight(order).toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</td>}<td>{order.shipping.method}</td>
      <td>{order.payment.method}</td><td><StatusBadge value={order.orderStatus}/></td>
      <td>{order.pending ? <span className="sync-waiting">Saved locally</span> : "Synced"}</td><td className="no-print"><OrderActions order={order} printing={printingOrderId === order.id} printOrder={printOrder}/></td>
    </tr>)}</tbody></table></div>
    <div className="mobile-cards">{visibleOrders.map(order => <article key={order.id} className="card"><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{order.orderCode}</b><StatusBadge value={order.orderStatus}/></div><h3 style={{ margin: "12px 0 3px" }}>{order.customer.name}</h3><div className="muted">{order.customer.mobile1}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}><span>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</span><b>{formatLKR(order.grandTotal)}</b></div>{showWeight && <div className="muted" style={{ marginTop: 7 }}>Total weight: <b>{orderTotalWeight(order).toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</b></div>}{order.pending && <div className="sync-waiting" style={{ fontSize: 12, marginTop: 8 }}>Saved locally - waiting to sync</div>}<OrderActions order={order} printing={printingOrderId === order.id} printOrder={printOrder}/></article>)}</div>
    <ViewMore shown={visibleOrders.length} total={orders.length} onMore={() => setVisibleCount(count => count + RECORD_PAGE_SIZE)}/>
    {printError && <p className="form-error no-print" role="alert">{printError}</p>}
    <ReceiptPrintHost order={selectedPrintOrder} type="full" settings={settings}/>
  </>;
}
