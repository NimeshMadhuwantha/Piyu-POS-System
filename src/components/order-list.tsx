"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import { formatLKR } from "@/lib/calculations";
import { StatusBadge } from "./status-badge";
import type { Order } from "@/types";

export function OrderList({ orders }: { orders: Order[] }) {
  if (!orders.length) return <div className="card muted">No orders match your search or filters.</div>;
  return <>
    <div className="card desktop-table table-wrap"><table className="table"><thead><tr><th>Order / Date</th><th>Customer</th><th>Total</th><th>Shipping</th><th>Payment</th><th>Status</th><th>Sync</th><th className="no-print">Open</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}>
      <td><Link href={`/orders/${order.id}`}><b>{order.orderCode}</b></Link><div className="muted">{format(new Date(order.createdAtClient), "dd MMM yyyy, h:mm a")}</div></td>
      <td>{order.customer.name}<div className="muted">{order.customer.mobile1}</div></td>
      <td>{formatLKR(order.grandTotal)}</td><td>{order.shipping.method}</td>
      <td>{order.payment.method}<br/><StatusBadge value={order.paymentStatus}/></td>
      <td><StatusBadge value={order.orderStatus}/></td><td>{order.pending ? "Waiting to sync" : "Synced"}</td>
      <td className="no-print"><Link className="btn secondary" href={`/orders/${order.id}`}><Eye size={16}/>View bill</Link></td>
    </tr>)}</tbody></table></div>
    <div className="mobile-cards">{orders.map(order => <Link href={`/orders/${order.id}`} key={order.id} className="card" style={{ textDecoration: "none", color: "inherit" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{order.orderCode}</b><StatusBadge value={order.orderStatus}/></div><h3 style={{ margin: "12px 0 3px" }}>{order.customer.name}</h3><div className="muted">{order.customer.mobile1}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}><span>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</span><b>{formatLKR(order.grandTotal)}</b></div>{order.pending && <div style={{ color: "#b45309", fontSize: 12, marginTop: 8 }}>Waiting to sync</div>}</Link>)}</div>
  </>;
}
