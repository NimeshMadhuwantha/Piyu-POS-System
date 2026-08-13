"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isThisMonth, isThisWeek, isToday, isYesterday } from "date-fns";
import { useOrders } from "@/hooks/use-data";
import { OrderList } from "@/components/order-list";
import { CapacityWarning } from "@/components/capacity-warning";
import { MAX_COLLECTION_RECORDS } from "@/lib/repositories";
import { primaryOrderStatus, type PrimaryOrderStatus } from "@/lib/order-status";

const statuses: Array<"All" | PrimaryOrderStatus> = ["All", "Pending", "Delivered", "Canceled", "Returned"];

export default function Orders() {
  const { orders } = useOrders();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("All");
  const [period, setPeriod] = useState("All time");
  const filtered = useMemo(() => orders.filter(order => {
    const needle = search.toLowerCase();
    const matchesSearch = !needle || [order.orderCode, order.customer.name, order.customer.mobile1, order.shipping.trackingNumber || ""].some(value => value.toLowerCase().includes(needle));
    const date = new Date(order.createdAtClient);
    const matchesDate = period === "All time" || period === "Today" && isToday(date) || period === "Yesterday" && isYesterday(date) || period === "This Week" && isThisWeek(date, { weekStartsOn: 1 }) || period === "This Month" && isThisMonth(date);
    return matchesSearch && (status === "All" || primaryOrderStatus(order.orderStatus) === status) && matchesDate;
  }), [orders, search, status, period]);

  return <>
    <div className="page-head"><div><h1>Orders</h1><span className="muted">Find, print, send, and update every order</span></div><Link className="btn" href="/orders/new">+ New Order</Link></div>
    <CapacityWarning label="Orders" count={orders.length} limit={MAX_COLLECTION_RECORDS}/>
    <div className="card no-print order-filters">
      <label className="field">Search<input placeholder="Code, customer, mobile, tracking..." value={search} onChange={event => setSearch(event.target.value)}/></label>
      <label className="field">Status<select value={status} onChange={event => setStatus(event.target.value as typeof status)}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Date<select value={period} onChange={event => setPeriod(event.target.value)}>{["All time", "Today", "Yesterday", "This Week", "This Month"].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <OrderList key={`${search}-${status}-${period}`} orders={filtered}/>
  </>;
}
