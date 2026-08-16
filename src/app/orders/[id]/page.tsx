"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { AlertTriangle, Edit3, Printer, Trash2 } from "lucide-react";
import { updateCachedOrderStatus, useOrders } from "@/hooks/use-data";
import { useApp } from "@/components/providers";
import { deleteOrder, getBusinessSettings, updateOrderStatus } from "@/lib/repositories";
import { calculateLineWeight, formatLKR, orderTotalWeight } from "@/lib/calculations";
import { StatusBadge } from "@/components/status-badge";
import type { ReceiptType } from "@/components/receipt";
import { ReceiptPrintHost } from "@/components/receipt-print-host";
import { primaryOrderStatus, type PrimaryOrderStatus } from "@/lib/order-status";
import { clearPrintTarget, openPrintDialog, setPrintTarget, waitForPrintAssets } from "@/lib/printing";
import type { BusinessSettings } from "@/types";

const statuses: PrimaryOrderStatus[] = ["Pending", "Delivered", "Canceled", "Returned"];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { orders, loading } = useOrders();
  const { user } = useApp();
  const order = orders.find(item => item.id === id);
  const totalWeight = order ? orderTotalWeight(order) : 0;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusChange, setStatusChange] = useState<{ orderId: string; previous: PrimaryOrderStatus; next: PrimaryOrderStatus } | null>(null);
  const [statusError, setStatusError] = useState("");
  const [settings, setSettings] = useState<BusinessSettings>({ businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!" });
  const [selectedReceiptType, setSelectedReceiptType] = useState<ReceiptType>("full");
  const [printingMode, setPrintingMode] = useState<ReceiptType | null>(null);
  const [printError, setPrintError] = useState("");

  const printReceipt = useCallback(async (receiptType: ReceiptType) => {
    setPrintTarget("receipt");
    flushSync(() => {
      setPrintError("");
      setSelectedReceiptType(receiptType);
      setPrintingMode(receiptType);
    });
    await waitForPrintAssets();
    const error = openPrintDialog();
    setPrintingMode(null);
    if (error) {
      clearPrintTarget("receipt");
      setPrintError(error);
    }
  }, []);

  useEffect(() => { getBusinessSettings().then(setSettings).catch(() => undefined); }, []);
  useEffect(() => () => clearPrintTarget("receipt"), []);

  if (loading) return <div>Loading order...</div>;
  if (!order) return <div className="card">Order not found in the local database.</div>;
  const persistedStatus = primaryOrderStatus(order.orderStatus);
  const currentStatus = statusChange?.orderId === order.id && statusChange.previous === persistedStatus ? statusChange.next : persistedStatus;
  const displayedOrder = currentStatus === persistedStatus ? order : { ...order, orderStatus: currentStatus };

  function changeStatus(status: PrimaryOrderStatus) {
    if (!order || !user) return;
    if (["Canceled", "Returned"].includes(status) && !confirm(`Mark this order as ${status}?`)) return;
    const previousStatus = order.orderStatus;
    setStatusError("");
    setStatusChange({ orderId: order.id, previous: primaryOrderStatus(order.orderStatus), next: status });
    updateCachedOrderStatus(order.id, status);
    void updateOrderStatus(order, status, user).catch(error => {
      setStatusChange(null);
      updateCachedOrderStatus(order.id, previousStatus);
      setStatusError(error instanceof Error ? `Status could not be saved to Firebase: ${error.message}` : "Status could not be saved to Firebase.");
    });
  }

  function confirmDelete() {
    if (!order || !user || user.role !== "admin") return;
    deleteOrder(order, user);
    setDeleteOpen(false);
    router.replace("/orders");
  }

  return <>
    <div className="no-print">
      <div className="page-head"><div><h1>{order.orderCode}</h1><span className="muted">{order.pending ? "Saved locally - waiting to sync" : "Synced"}</span></div><div className="order-top-print"><button className="btn secondary" type="button" disabled={printingMode !== null} aria-busy={printingMode === "full"} onClick={() => printReceipt("full")}>{printingMode === "full" ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={17}/>Full bill</>}</button><button className="btn secondary" type="button" disabled={printingMode !== null} aria-busy={printingMode === "shipping"} onClick={() => printReceipt("shipping")}>{printingMode === "shipping" ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={17}/>Shipping details</>}</button><button className="btn secondary" type="button" disabled={printingMode !== null} aria-busy={printingMode === "customer"} onClick={() => printReceipt("customer")}>{printingMode === "customer" ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={17}/>Item list</>}</button></div></div>
      {printError && <p className="form-error" role="alert">{printError}</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
        <section className="card"><h2 className="section-title">Customer details</h2><b>{order.customer.name}</b>{order.customer.email && <p>{order.customer.email}</p>}<p>{order.customer.mobile1}{order.customer.mobile2 && ` / ${order.customer.mobile2}`}</p><p>{[order.customer.address1,order.customer.address2,order.customer.city,order.customer.district].filter(Boolean).join(", ")}</p>{order.customer.note && <p className="muted">{order.customer.note}</p>}</section>
        <section className="card"><h2 className="section-title">Delivery details</h2><p><b>{order.shipping.method}</b></p><p>Courier: {order.shipping.courier || "-"}<br/>Tracking: {order.shipping.trackingNumber || "-"}<br/>Total weight: {totalWeight > 0 ? `${totalWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g` : "-"}</p><p>Requested: {order.requestDate}<br/>Delivery: {order.deliveryDate || "Not set"}</p></section>
        <section className="card"><h2 className="section-title">Payment & status</h2><p><StatusBadge value={currentStatus}/></p><p>{order.payment.method}<br/>Payment: {order.paymentStatus}</p><p>Grand total: <b>{formatLKR(order.grandTotal)}</b><br/>Paid: {formatLKR(order.amountPaid)}<br/>Balance / COD: <b>{formatLKR(order.balance)}</b></p></section>
      </div>
      <section className="card" style={{marginTop:14}}><h2 className="section-title">Order items</h2><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Variant</th><th>Qty</th><th>Unit</th><th>Unit weight</th><th>Total weight</th><th>Unit price</th><th>Discount</th><th>Total</th></tr></thead><tbody>{order.items.map(item => { const unitWeight = Math.max(0, item.weight || 0); const lineWeight = calculateLineWeight(unitWeight, item.quantity); return <tr key={item.id}><td>{item.name}</td><td>{item.variant || "-"}</td><td>{item.quantity}</td><td>{item.unit || "-"}</td><td>{unitWeight > 0 ? `${unitWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g` : "-"}</td><td>{lineWeight > 0 ? `${lineWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g` : "-"}</td><td>{formatLKR(item.unitPrice)}</td><td>{order.schemaVersion >= 2 ? `${item.discount}%` : formatLKR(item.discount)}</td><td><b>{formatLKR(item.subtotal)}</b></td></tr>; })}</tbody></table></div><div className="total-weight">Total order weight <b>{totalWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</b></div></section>
      <section className="card status-panel" style={{marginTop:14}}><div><h2 className="section-title">Update order status</h2><p className="muted">Current status: <b>{currentStatus}</b></p>{statusError && <p className="form-error" role="alert">{statusError}</p>}</div><div className="status-actions">{statuses.map(status => { const current = currentStatus === status; return <button disabled={current} aria-pressed={current} className={`btn status-${status} ${current ? "status-current" : ""}`} key={status} onClick={() => changeStatus(status)}>Mark {status}</button>; })}</div></section>
      {order.deliveryConfirmation && <section className="card delivery-confirmation-card"><h3>Delivery confirmation</h3><div><span><b>Tracking number:</b> {order.deliveryConfirmation.trackingNumber}</span><span><b>Parcel weight:</b> {order.deliveryConfirmation.parcelWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</span><span><b>Value:</b> {formatLKR(order.deliveryConfirmation.value)}</span>{order.deliveryConfirmation.deliveryPaid && <span className="delivery-paid-label">✓ Deliver Paid</span>}</div></section>}
      <div className="order-bottom-actions"><Link className="btn secondary" href={`/orders/${id}/edit`}><Edit3 size={17}/>Edit order</Link>{user?.role === "admin" && <button className="btn danger" onClick={() => setDeleteOpen(true)}><Trash2 size={17}/>Delete order</button>}</div>
    </div>
    {deleteOpen && <div className="modal-backdrop no-print" role="presentation" onMouseDown={() => setDeleteOpen(false)}><section className="card confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={event => event.stopPropagation()}><AlertTriangle size={38} color="#dc2626"/><h2 id="delete-title">Delete {order.orderCode}?</h2><p>This permanently removes the order from the order list and Firebase after synchronization. An audit log of the deletion will remain.</p><div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button className="btn secondary" onClick={() => setDeleteOpen(false)}>Keep order</button><button className="btn danger" onClick={confirmDelete}>Yes, delete order</button></div></section></div>}
    <ReceiptPrintHost order={displayedOrder} type={selectedReceiptType} settings={settings}/>
  </>;
}
