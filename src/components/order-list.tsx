"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { format } from "date-fns";
import { Eye, MessageCircle, Printer, Truck, X } from "lucide-react";
import { formatLKR, orderTotalWeight } from "@/lib/calculations";
import { openWhatsAppDeliveredInvoice } from "@/lib/whatsapp";
import { StatusBadge } from "./status-badge";
import { ReceiptPrintHost } from "./receipt-print-host";
import { confirmOrderDelivery, getBusinessSettings } from "@/lib/repositories";
import { clearPrintTarget, openPrintDialog, setPrintTarget, waitForPrintAssets } from "@/lib/printing";
import type { BusinessSettings, Order } from "@/types";
import { RECORD_PAGE_SIZE, ViewMore } from "./view-more";
import { useApp } from "./providers";
import { updateCachedOrderDelivery } from "@/hooks/use-data";

function OrderActions({ order, printing, printOrder, openDelivery, viewOnly = false }: { order: Order; printing: boolean; printOrder: (order: Order) => void; openDelivery: (order: Order) => void; viewOnly?: boolean }) {
  return <div className="order-actions no-print">
    <Link className="btn secondary" href={`/orders/${order.id}`}><Eye size={16}/>View bill</Link>
    {!viewOnly && <><button className="btn secondary" type="button" disabled={printing} aria-busy={printing} onClick={() => printOrder(order)}>{printing ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={16}/>Print bill</>}</button>
    <button className="btn whatsapp" type="button" onClick={() => openDelivery(order)}><MessageCircle size={16}/>Send Invoice Delivered</button></>}
  </div>;
}

export function OrderList({ orders, showWeight = false, viewOnlyActions = false }: { orders: Order[]; showWeight?: boolean; viewOnlyActions?: boolean }) {
  const { user } = useApp();
  const [visibleCount, setVisibleCount] = useState(RECORD_PAGE_SIZE);
  const [settings, setSettings] = useState<BusinessSettings>({ businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!" });
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [printedAt, setPrintedAt] = useState("");
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({ trackingNumber: "", parcelWeight: "", value: "", deliveryPaid: false });
  const [deliveryError, setDeliveryError] = useState("");
  useEffect(() => { getBusinessSettings().then(setSettings).catch(() => undefined); }, []);
  useEffect(() => () => clearPrintTarget("receipt"), []);
  const printOrder = useCallback(async (order: Order) => {
    setPrintTarget("receipt");
    flushSync(() => {
      setPrintError("");
      setSelectedPrintOrder(order);
      setPrintingOrderId(order.id);
      setPrintedAt(new Date().toISOString());
    });
    await waitForPrintAssets();
    const error = openPrintDialog();
    setPrintingOrderId(null);
    if (error) {
      clearPrintTarget("receipt");
      setPrintError(error);
    }
  }, []);
  function openDelivery(order: Order) {
    setDeliveryError("");
    setDeliveryOrder(order);
    setDeliveryForm({
      trackingNumber: order.deliveryConfirmation?.trackingNumber || order.shipping.trackingNumber || "",
      parcelWeight: "",
      value: order.deliveryCharge > 0 ? String(order.deliveryCharge) : "",
      deliveryPaid: order.deliveryConfirmation?.deliveryPaid || false,
    });
  }
  function confirmDelivery(event: React.FormEvent) {
    event.preventDefault();
    if (!deliveryOrder || !user) return;
    const trackingNumber = deliveryForm.trackingNumber.trim();
    const parcelWeight = Number(deliveryForm.parcelWeight);
    const value = Number(deliveryForm.value);
    if (!Number.isFinite(parcelWeight) || parcelWeight <= 0) { setDeliveryError("Enter a parcel weight greater than zero."); return; }
    if (!Number.isFinite(value) || value < 0) { setDeliveryError("Enter a valid value."); return; }
    setDeliveryError("");
    const { deliveryConfirmation, commit } = confirmOrderDelivery(deliveryOrder, { trackingNumber, parcelWeight, value, deliveryPaid: deliveryForm.deliveryPaid }, user);
    updateCachedOrderDelivery(deliveryOrder.id, deliveryConfirmation);
    setDeliveryOrder(null);
    openWhatsAppDeliveredInvoice(deliveryOrder, deliveryConfirmation);
    void commit.catch(error => setDeliveryError(error instanceof Error ? `Delivery details could not sync to Firebase: ${error.message}` : "Delivery details could not sync to Firebase."));
  }
  if (!orders.length) return <div className="card muted">No orders match your search or filters.</div>;
  const visibleOrders = orders.slice(0, visibleCount);
  return <>
    <div className="card desktop-table table-wrap"><table className="table order-table"><thead><tr><th>Order / Date</th><th>Customer</th><th>Total</th>{showWeight && <th>Total weight</th>}<th>Shipping</th><th>Payment</th><th>Status</th><th>Sync</th><th className="no-print">Actions</th></tr></thead><tbody>{visibleOrders.map(order => <tr key={order.id}>
      <td><Link href={`/orders/${order.id}`}><b>{order.orderCode}</b></Link><div className="muted">{format(new Date(order.createdAtClient), "dd MMM yyyy, h:mm a")}</div></td>
      <td>{order.customer.name}<div className="muted">{order.customer.mobile1}</div></td>
      <td>{formatLKR(order.grandTotal)}</td>{showWeight && <td>{orderTotalWeight(order).toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</td>}<td>{order.shipping.method}</td>
      <td>{order.payment.method}</td><td><StatusBadge value={order.orderStatus}/></td>
      <td>{order.pending ? <span className="sync-waiting">Saved locally</span> : "Synced"}</td><td className="no-print"><OrderActions order={order} printing={printingOrderId === order.id} printOrder={printOrder} openDelivery={openDelivery} viewOnly={viewOnlyActions}/></td>
    </tr>)}</tbody></table></div>
    <div className="mobile-cards">{visibleOrders.map(order => <article key={order.id} className="card"><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{order.orderCode}</b><StatusBadge value={order.orderStatus}/></div><h3 style={{ margin: "12px 0 3px" }}>{order.customer.name}</h3><div className="muted">{order.customer.mobile1}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}><span>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</span><b>{formatLKR(order.grandTotal)}</b></div>{showWeight && <div className="muted" style={{ marginTop: 7 }}>Total weight: <b>{orderTotalWeight(order).toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</b></div>}{order.pending && <div className="sync-waiting" style={{ fontSize: 12, marginTop: 8 }}>Saved locally - waiting to sync</div>}<OrderActions order={order} printing={printingOrderId === order.id} printOrder={printOrder} openDelivery={openDelivery} viewOnly={viewOnlyActions}/></article>)}</div>
    <ViewMore shown={visibleOrders.length} total={orders.length} onMore={() => setVisibleCount(count => count + RECORD_PAGE_SIZE)}/>
    {printError && <p className="form-error no-print" role="alert">{printError}</p>}
    {deliveryError && !deliveryOrder && <p className="form-error no-print" role="alert">{deliveryError}</p>}
    {deliveryOrder && <div className="modal-backdrop no-print" role="presentation" onMouseDown={() => setDeliveryOrder(null)}><form className="card confirm-modal delivery-modal" onSubmit={confirmDelivery} onMouseDown={event => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close" onClick={() => setDeliveryOrder(null)}><X size={20}/></button><Truck size={36} color="#16a34a"/><h2>Send Invoice Delivered</h2><p className="muted">{deliveryOrder.orderCode} · {deliveryOrder.customer.name}</p><div className="delivery-form-fields"><label className="field">Tracking number<input value={deliveryForm.trackingNumber} onChange={event => setDeliveryForm(current => ({ ...current, trackingNumber: event.target.value }))}/></label><label className="field">Parcel weight (g) *<input required type="number" inputMode="decimal" min="0.01" step="0.01" value={deliveryForm.parcelWeight} onChange={event => setDeliveryForm(current => ({ ...current, parcelWeight: event.target.value }))}/></label><label className="field">Value (LKR) *<input required type="number" inputMode="decimal" min="0" step="0.01" value={deliveryForm.value} onChange={event => setDeliveryForm(current => ({ ...current, value: event.target.value }))}/></label><label className="delivery-paid-check"><input type="checkbox" checked={deliveryForm.deliveryPaid} onChange={event => setDeliveryForm(current => ({ ...current, deliveryPaid: event.target.checked }))}/><span>Deliver Paid</span></label></div>{deliveryError && <p className="form-error" role="alert">{deliveryError}</p>}<div className="settings-actions"><button className="btn secondary" type="button" onClick={() => setDeliveryOrder(null)}>Cancel</button><button className="btn whatsapp" type="submit">Confirm</button></div></form></div>}
    <ReceiptPrintHost order={selectedPrintOrder} type="full" settings={settings} printedAt={printedAt}/>
  </>;
}
