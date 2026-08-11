"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Edit3, Printer, Trash2 } from "lucide-react";
import { useOrders } from "@/hooks/use-data";
import { useApp } from "@/components/providers";
import { deleteOrder, getBusinessSettings, updateOrderStatus } from "@/lib/repositories";
import { formatLKR } from "@/lib/calculations";
import { StatusBadge } from "@/components/status-badge";
import { Receipt, type ReceiptType } from "@/components/receipt";
import { primaryOrderStatus, type PrimaryOrderStatus } from "@/lib/order-status";
import type { BusinessSettings } from "@/types";

const statuses: PrimaryOrderStatus[] = ["Pending", "Delivered", "Canceled", "Returned"];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orders, loading } = useOrders();
  const { user } = useApp();
  const order = orders.find(item => item.id === id);
  const [type, setType] = useState<ReceiptType | "all">("full");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const autoPrinted = useRef(false);
  const [settings, setSettings] = useState<BusinessSettings>({ businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!" });

  useEffect(() => { getBusinessSettings().then(setSettings).catch(() => undefined); }, []);
  useEffect(() => {
    if (!order || searchParams.get("print") !== "full" || autoPrinted.current) return;
    autoPrinted.current = true;
    setType("full");
    setTimeout(() => window.print(), 150);
  }, [order, searchParams]);

  if (loading) return <div>Loading order...</div>;
  if (!order) return <div className="card">Order not found in the local database.</div>;

  function changeStatus(status: PrimaryOrderStatus) {
    if (!order || !user) return;
    if (["Canceled", "Returned"].includes(status) && !confirm(`Mark this order as ${status}?`)) return;
    updateOrderStatus(order, status, user);
  }

  function print(receiptType: ReceiptType | "all") { setType(receiptType); setTimeout(() => window.print(), 50); }

  function confirmDelete() {
    if (!order || !user || user.role !== "admin") return;
    deleteOrder(order, user);
    setDeleteOpen(false);
    router.replace("/orders");
  }

  return <>
    <div className="no-print">
      <div className="page-head"><div><h1>{order.orderCode}</h1><span className="muted">{order.pending ? "Saved locally - waiting to sync" : "Synced"}</span></div><div className="order-top-print"><button className="btn secondary" onClick={() => print("full")}><Printer size={17}/>Full bill</button><button className="btn secondary" onClick={() => print("shipping")}><Printer size={17}/>Shipping details</button><button className="btn secondary" onClick={() => print("customer")}><Printer size={17}/>Client details</button></div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
        <section className="card"><h2 className="section-title">Customer details</h2><b>{order.customer.name}</b>{order.customer.email && <p>{order.customer.email}</p>}<p>{order.customer.mobile1}{order.customer.mobile2 && ` / ${order.customer.mobile2}`}</p><p>{[order.customer.address1,order.customer.address2,order.customer.city,order.customer.district].filter(Boolean).join(", ")}</p>{order.customer.note && <p className="muted">{order.customer.note}</p>}</section>
        <section className="card"><h2 className="section-title">Delivery details</h2><p><b>{order.shipping.method}</b></p><p>Courier: {order.shipping.courier || "-"}<br/>Tracking: {order.shipping.trackingNumber || "-"}<br/>Weight: {order.shipping.parcelWeight || "-"}</p><p>Requested: {order.requestDate}<br/>Delivery: {order.deliveryDate || "Not set"}</p></section>
        <section className="card"><h2 className="section-title">Payment & status</h2><p><StatusBadge value={order.orderStatus}/></p><p>{order.payment.method}<br/>Payment: {order.paymentStatus}</p><p>Grand total: <b>{formatLKR(order.grandTotal)}</b><br/>Paid: {formatLKR(order.amountPaid)}<br/>Balance / COD: <b>{formatLKR(order.balance)}</b></p></section>
      </div>
      <section className="card" style={{marginTop:14}}><h2 className="section-title">Order items</h2><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Variant</th><th>Qty</th><th>Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>{order.items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.variant || "-"}</td><td>{item.quantity} {item.unit}</td><td>{formatLKR(item.unitPrice)}</td><td>{order.schemaVersion >= 2 ? `${item.discount}%` : formatLKR(item.discount)}</td><td><b>{formatLKR(item.subtotal)}</b></td></tr>)}</tbody></table></div></section>
      <section className="card status-panel" style={{marginTop:14}}><div><h2 className="section-title">Update order status</h2><p className="muted">Current status: <b>{primaryOrderStatus(order.orderStatus)}</b></p></div><div className="status-actions">{statuses.map(status => <button disabled={primaryOrderStatus(order.orderStatus) === status} className={`btn status-${status} ${primaryOrderStatus(order.orderStatus) === status ? "status-current" : ""}`} key={status} onClick={() => changeStatus(status)}>Mark {status}</button>)}</div></section>
      <div className="order-bottom-actions"><Link className="btn secondary" href={`/orders/${id}/edit`}><Edit3 size={17}/>Edit order</Link>{user?.role === "admin" && <button className="btn danger" onClick={() => setDeleteOpen(true)}><Trash2 size={17}/>Delete order</button>}</div>
    </div>
    {deleteOpen && <div className="modal-backdrop no-print" role="presentation" onMouseDown={() => setDeleteOpen(false)}><section className="card confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={event => event.stopPropagation()}><AlertTriangle size={38} color="#dc2626"/><h2 id="delete-title">Delete {order.orderCode}?</h2><p>This permanently removes the order from the order list and Firebase after synchronization. An audit log of the deletion will remain.</p><div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button className="btn secondary" onClick={() => setDeleteOpen(false)}>Keep order</button><button className="btn danger" onClick={confirmDelete}>Yes, delete order</button></div></section></div>}
    <div className="print-only">{type === "all" ? <><Receipt order={order} type="shipping" settings={settings}/><div style={{breakAfter:"page"}}/><Receipt order={order} type="customer" settings={settings}/><div style={{breakAfter:"page"}}/><Receipt order={order} type="full" settings={settings}/></> : <Receipt order={order} type={type} settings={settings}/>}</div>
  </>;
}
