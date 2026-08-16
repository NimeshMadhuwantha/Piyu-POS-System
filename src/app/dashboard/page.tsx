"use client";

import Link from "next/link";
import { format, isToday } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useOrders } from "@/hooks/use-data";
import { formatLKR } from "@/lib/calculations";
import { StatusBadge } from "@/components/status-badge";
import { primaryOrderStatus } from "@/lib/order-status";
import { Printer } from "lucide-react";
import { ReceiptPrintHost } from "@/components/receipt-print-host";
import { getBusinessSettings } from "@/lib/repositories";
import { clearPrintTarget, openPrintDialog, setPrintTarget } from "@/lib/printing";
import type { BusinessSettings, Order } from "@/types";

export default function Dashboard() {
  const { orders, loading } = useOrders();
  const [settings, setSettings] = useState<BusinessSettings>({ businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!" });
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);
  const [printedAt, setPrintedAt] = useState("");
  useEffect(() => { getBusinessSettings().then(setSettings).catch(() => undefined); }, []);
  useEffect(() => () => clearPrintTarget("receipt"), []);
  const printItemList = useCallback((order: Order) => {
    setPrintTarget("receipt");
    flushSync(() => {
      setPrintError("");
      setSelectedPrintOrder(order);
      setPrintingOrderId(order.id);
      setPrintedAt(new Date().toISOString());
    });
    const error = openPrintDialog();
    setPrintingOrderId(null);
    if (error) {
      clearPrintTarget("receipt");
      setPrintError(error);
    }
  }, []);
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
    <div className="card"><div className="page-head"><h2 className="section-title">Recent Orders</h2><Link href="/orders">View all</Link></div>{printError && <p className="form-error no-print" role="alert">{printError}</p>}{orders.length === 0 ? <div className="muted">No orders yet. Create the first order to get started.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Sync</th><th>Print</th></tr></thead><tbody>{orders.slice(0, 8).map(order => <tr key={order.id}><td><Link href={`/orders/${order.id}`}>{order.orderCode}</Link></td><td>{format(new Date(order.createdAtClient), "dd MMM, h:mm a")}</td><td>{order.customer.name}</td><td>{formatLKR(order.grandTotal)}</td><td><StatusBadge value={order.orderStatus}/></td><td>{order.pending ? <span style={{ color: "#b45309" }}>Waiting</span> : "Synced"}</td><td>{primaryOrderStatus(order.orderStatus) === "Pending" && <button className="btn secondary dashboard-print" type="button" disabled={printingOrderId !== null} aria-busy={printingOrderId === order.id} onClick={() => printItemList(order)}>{printingOrderId === order.id ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={15}/>Item list</>}</button>}</td></tr>)}</tbody></table></div>}</div>
    </div>
    <ReceiptPrintHost order={selectedPrintOrder} type="customer" settings={settings} printedAt={printedAt}/>
  </>;
}
