"use client";

import Link from "next/link";
import { format, isToday } from "date-fns";
import { useOrders } from "@/hooks/use-data";
import { formatLKR } from "@/lib/calculations";
import { StatusBadge } from "@/components/status-badge";
import { primaryOrderStatus } from "@/lib/order-status";

export default function Dashboard() {
  const { orders, loading } = useOrders();
  const today = orders.filter(order => isToday(new Date(order.createdAtClient)));
  const stats = [
    { label: "Today's Orders", value: today.length },
    { label: "Today's Sales", value: formatLKR(today.filter(order => !["Canceled", "Returned"].includes(primaryOrderStatus(order.orderStatus))).reduce((sum, order) => sum + order.grandTotal, 0)), money: true },
    { label: "Pending", value: orders.filter(order => primaryOrderStatus(order.orderStatus) === "Pending").length },
    { label: "Delivered", value: orders.filter(order => primaryOrderStatus(order.orderStatus) === "Delivered").length },
    { label: "Canceled", value: orders.filter(order => primaryOrderStatus(order.orderStatus) === "Canceled").length },
    { label: "Returned", value: orders.filter(order => primaryOrderStatus(order.orderStatus) === "Returned").length },
  ];
  return <>
    <div className="page-head"><div><h1>Dashboard</h1><span className="muted">Your order overview</span></div><Link className="btn" href="/orders/new">+ New Order</Link></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12, marginBottom: 20 }}>{stats.map(stat => <div className="card dashboard-stat" key={stat.label}><div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{stat.label}</div><div className={stat.money ? "dashboard-money" : "dashboard-number"}>{loading ? "-" : stat.value}</div></div>)}</div>
    <div className="card"><div className="page-head"><h2 className="section-title">Recent Orders</h2><Link href="/orders">View all</Link></div>{orders.length === 0 ? <div className="muted">No orders yet. Create the first order to get started.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Sync</th></tr></thead><tbody>{orders.slice(0, 8).map(order => <tr key={order.id}><td><Link href={`/orders/${order.id}`}>{order.orderCode}</Link></td><td>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</td><td>{order.customer.name}</td><td>{formatLKR(order.grandTotal)}</td><td><StatusBadge value={order.orderStatus}/></td><td>{order.pending ? <span style={{ color: "#b45309" }}>Waiting</span> : "Synced"}</td></tr>)}</tbody></table></div>}</div>
  </>;
}
