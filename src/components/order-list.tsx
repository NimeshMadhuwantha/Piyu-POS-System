"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { Eye, MessageCircle, Printer } from "lucide-react";
import { formatLKR } from "@/lib/calculations";
import { openWhatsAppInvoice } from "@/lib/whatsapp";
import { StatusBadge } from "./status-badge";
import type { Order } from "@/types";
import { RECORD_PAGE_SIZE, ViewMore } from "./view-more";

function OrderActions({ order }: { order: Order }) {
  return <div className="order-actions no-print">
    <Link className="btn secondary" href={`/orders/${order.id}`}><Eye size={16}/>View bill</Link>
    <Link className="btn secondary" href={`/orders/${order.id}?print=full`} target="_blank"><Printer size={16}/>Print bill</Link>
    <button className="btn whatsapp" type="button" onClick={() => openWhatsAppInvoice(order)}><MessageCircle size={16}/>Send invoice</button>
  </div>;
}

export function OrderList({ orders }: { orders: Order[] }) {
  const [visibleCount, setVisibleCount] = useState(RECORD_PAGE_SIZE);
  if (!orders.length) return <div className="card muted">No orders match your search or filters.</div>;
  const visibleOrders = orders.slice(0, visibleCount);
  return <>
    <div className="card desktop-table table-wrap"><table className="table order-table"><thead><tr><th>Order / Date</th><th>Customer</th><th>Total</th><th>Shipping</th><th>Payment</th><th>Status</th><th>Sync</th><th className="no-print">Actions</th></tr></thead><tbody>{visibleOrders.map(order => <tr key={order.id}>
      <td><Link href={`/orders/${order.id}`}><b>{order.orderCode}</b></Link><div className="muted">{format(new Date(order.createdAtClient), "dd MMM yyyy, h:mm a")}</div></td>
      <td>{order.customer.name}<div className="muted">{order.customer.mobile1}</div></td>
      <td>{formatLKR(order.grandTotal)}</td><td>{order.shipping.method}</td>
      <td>{order.payment.method}</td><td><StatusBadge value={order.orderStatus}/></td>
      <td>{order.pending ? <span className="sync-waiting">Saved locally</span> : "Synced"}</td><td className="no-print"><OrderActions order={order}/></td>
    </tr>)}</tbody></table></div>
    <div className="mobile-cards">{visibleOrders.map(order => <article key={order.id} className="card"><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{order.orderCode}</b><StatusBadge value={order.orderStatus}/></div><h3 style={{ margin: "12px 0 3px" }}>{order.customer.name}</h3><div className="muted">{order.customer.mobile1}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}><span>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</span><b>{formatLKR(order.grandTotal)}</b></div>{order.pending && <div className="sync-waiting" style={{ fontSize: 12, marginTop: 8 }}>Saved locally - waiting to sync</div>}<OrderActions order={order}/></article>)}</div>
    <ViewMore shown={visibleOrders.length} total={orders.length} onMore={() => setVisibleCount(count => count + RECORD_PAGE_SIZE)}/>
  </>;
}
