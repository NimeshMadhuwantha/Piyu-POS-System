"use client";

import { useMemo, useState } from "react";
import { isThisMonth, isThisWeek, isToday, isYesterday } from "date-fns";
import { Download, FileText, Printer } from "lucide-react";
import { useOrders } from "@/hooks/use-data";
import { formatLKR } from "@/lib/calculations";
import { downloadBlob, ordersCsv, reportPdf } from "@/lib/export";
import { OrderList } from "@/components/order-list";

export default function Reports() {
  const { orders } = useOrders();
  const [period, setPeriod] = useState("This Month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const data = useMemo(() => orders.filter(order => {
    const date = new Date(order.createdAtClient);
    if (period === "Today") return isToday(date);
    if (period === "Yesterday") return isYesterday(date);
    if (period === "This Week") return isThisWeek(date, { weekStartsOn: 1 });
    if (period === "This Month") return isThisMonth(date);
    if (period === "Custom") return (!start || date >= new Date(start)) && (!end || date <= new Date(`${end}T23:59:59`));
    return true;
  }), [orders, period, start, end]);
  const active = data.filter(order => !["Cancelled", "Returned"].includes(order.orderStatus));
  const stats = [
    { label: "Total orders", value: data.length },
    { label: "Total sales", value: formatLKR(active.reduce((sum, order) => sum + order.grandTotal, 0)) },
    { label: "Delivered", value: data.filter(order => order.orderStatus === "Delivered").length },
    { label: "Pending", value: data.filter(order => ["New", "Pending", "Confirmed", "Processing", "Packed", "Shipped"].includes(order.orderStatus)).length },
    { label: "Cancelled", value: data.filter(order => order.orderStatus === "Cancelled").length },
    { label: "Returned", value: data.filter(order => order.orderStatus === "Returned").length },
    { label: "COD orders", value: data.filter(order => order.payment.method === "Cash on Delivery (COD)").length },
    { label: "Collected", value: formatLKR(data.reduce((sum, order) => sum + order.amountPaid, 0)) },
    { label: "Outstanding", value: formatLKR(data.reduce((sum, order) => sum + order.balance, 0)) },
  ];

  return <>
    <div className="page-head"><div><h1>Reports</h1><span className="muted">Sales and order summary - {period}</span></div></div>
    <div className="card no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 14 }}>
      <label className="field">Date range<select value={period} onChange={event => setPeriod(event.target.value)}>{["Today", "Yesterday", "This Week", "This Month", "Custom", "All time"].map(value => <option key={value}>{value}</option>)}</select></label>
      {period === "Custom" && <><label className="field">From<input type="date" value={start} onChange={event => setStart(event.target.value)}/></label><label className="field">To<input type="date" value={end} onChange={event => setEnd(event.target.value)}/></label></>}
      <button className="btn secondary" onClick={() => reportPdf(data, `Piyu POS - ${period}`)}><FileText size={17}/>PDF</button>
      <button className="btn secondary" onClick={() => downloadBlob("orders.csv", ordersCsv(data), "text/csv")}><Download size={17}/>CSV</button>
      <button className="btn" onClick={() => window.print()}><Printer size={17}/>Print report</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>{stats.map(stat => <div className="card" key={stat.label}><small className="muted">{stat.label}</small><div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{stat.value}</div></div>)}</div>
    <OrderList orders={data}/>
  </>;
}
