"use client";

import Link from "next/link";
import { format, isToday } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOrders } from "@/hooks/use-data";
import { formatLKR } from "@/lib/calculations";
import { StatusBadge } from "@/components/status-badge";
import { primaryOrderStatus } from "@/lib/order-status";
import { Printer } from "lucide-react";
import { Receipt } from "@/components/receipt";
import { getBusinessSettings } from "@/lib/repositories";
import type { BusinessSettings, Order } from "@/types";

export default function Dashboard() {
  const { orders, loading } = useOrders();
  const printArea = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<BusinessSettings>({ businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!" });
  useEffect(() => { getBusinessSettings().then(setSettings).catch(() => undefined); }, []);
  const printItemList = useCallback((order: Order) => {
    const options = Array.from(printArea.current?.querySelectorAll<HTMLElement>(".receipt-print-option") || []);
    const selected = options.find(option => option.dataset.orderId === order.id);
    if (!selected) return;
    options.forEach(option => option.classList.toggle("active-print-receipt", option === selected));
    document.body.classList.add("preparing-receipt-print");
    const margin = settings.receiptWidth === "A4" ? 10 : 5;
    let pageSize = settings.receiptWidth === "A4" ? "A4 portrait" : settings.receiptWidth === "A4/4" ? "105mm 148.5mm" : "80mm 200mm";
    if (settings.receiptWidth === "58mm" || settings.receiptWidth === "80mm") {
      const contentHeight = selected.querySelector<HTMLElement>(".receipt")?.getBoundingClientRect().height || 0;
      const pageHeight = Math.max(80, Math.ceil(contentHeight * 25.4 / 96 + margin * 2 + 1));
      pageSize = `${settings.receiptWidth} ${pageHeight}mm`;
    }
    document.body.classList.remove("preparing-receipt-print");
    document.getElementById("receipt-print-page-size")?.remove();
    const pageStyle = document.createElement("style");
    pageStyle.id = "receipt-print-page-size";
    pageStyle.media = "print";
    pageStyle.textContent = `@page { size: ${pageSize}; margin: ${margin}mm; }`;
    document.head.appendChild(pageStyle);
    window.addEventListener("afterprint", () => {
      pageStyle.remove();
      selected.classList.remove("active-print-receipt");
    }, { once: true });
    window.print();
  }, [settings.receiptWidth]);
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
    <div className="no-print">
    <div className="page-head"><div><h1>Dashboard</h1><span className="muted">Your order overview</span></div><Link className="btn" href="/orders/new">+ New Order</Link></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12, marginBottom: 20 }}>{stats.map(stat => <div className="card dashboard-stat" key={stat.label}><div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{stat.label}</div><div className={stat.money ? "dashboard-money" : "dashboard-number"}>{loading ? "-" : stat.value}</div></div>)}</div>
    <div className="card"><div className="page-head"><h2 className="section-title">Recent Orders</h2><Link href="/orders">View all</Link></div>{orders.length === 0 ? <div className="muted">No orders yet. Create the first order to get started.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Sync</th><th>Print</th></tr></thead><tbody>{orders.slice(0, 8).map(order => <tr key={order.id}><td><Link href={`/orders/${order.id}`}>{order.orderCode}</Link></td><td>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</td><td>{order.customer.name}</td><td>{formatLKR(order.grandTotal)}</td><td><StatusBadge value={order.orderStatus}/></td><td>{order.pending ? <span style={{ color: "#b45309" }}>Waiting</span> : "Synced"}</td><td>{primaryOrderStatus(order.orderStatus) === "Pending" && <button className="btn secondary dashboard-print" type="button" onClick={() => printItemList(order)}><Printer size={15}/>Item list</button>}</td></tr>)}</tbody></table></div>}</div>
    </div>
    <div className="print-only" ref={printArea}>{orders.slice(0, 8).filter(order => primaryOrderStatus(order.orderStatus) === "Pending").map(order => <div className="receipt-print-option" data-order-id={order.id} key={order.id}><Receipt order={order} type="customer" settings={settings}/></div>)}</div>
  </>;
}
