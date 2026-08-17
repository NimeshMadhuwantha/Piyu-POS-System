"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { endOfWeek, format, isThisMonth, isThisWeek, isToday, isYesterday, startOfWeek, subDays } from "date-fns";
import { Download, FileText, Printer } from "lucide-react";
import { useOrders } from "@/hooks/use-data";
import { downloadBlob, ordersCsv, reportPdf } from "@/lib/export";
import { OrderList } from "@/components/order-list";
import { primaryOrderStatus } from "@/lib/order-status";
import { ORDER_PREFIXES, ORDER_SUFFIXES, parseOrderCode } from "@/lib/order-code";
import { clearPrintTarget, openPrintDialog, setPrintTarget } from "@/lib/printing";

const REPORT_STATUSES = ["Pending", "Delivered", "Canceled", "Returned"] as const;

function orderCodeParts(order: { orderCode: string; orderPrefix?: string; orderSuffix?: string }) {
  const parsed = parseOrderCode(order.orderCode);
  return {
    prefix: (order.orderPrefix || parsed?.prefix || order.orderCode.match(/^[A-Za-z]+/)?.[0] || "").toUpperCase(),
    suffix: (order.orderSuffix || parsed?.suffix || order.orderCode.match(/[A-Za-z]$/)?.[0] || "").toUpperCase(),
  };
}

export default function Reports() {
  const { orders } = useOrders();
  const [period, setPeriod] = useState("This Month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [orderPrefix, setOrderPrefix] = useState("All");
  const [orderSuffix, setOrderSuffix] = useState("All");
  const [status, setStatus] = useState("All");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [printBusy, setPrintBusy] = useState(false);
  const [printError, setPrintError] = useState("");
  useEffect(() => () => clearPrintTarget("document"), []);
  const data = useMemo(() => orders.filter(order => {
    const date = new Date(order.createdAtClient);
    const matchesDate = period === "Today" ? isToday(date)
      : period === "Yesterday" ? isYesterday(date)
      : period === "This Week" ? isThisWeek(date, { weekStartsOn: 1 })
      : period === "This Month" ? isThisMonth(date)
      : period === "Custom" ? (!start || date >= new Date(start)) && (!end || date <= new Date(`${end}T23:59:59`))
      : true;
    const code = orderCodeParts(order);
    return matchesDate
      && (orderPrefix === "All" || code.prefix === orderPrefix)
      && (orderSuffix === "All" || code.suffix === orderSuffix)
      && (status === "All" || primaryOrderStatus(order.orderStatus) === status);
  }), [orders, period, start, end, orderPrefix, orderSuffix, status]);
  const active = data.filter(order => !["Canceled", "Returned"].includes(primaryOrderStatus(order.orderStatus)));
  const reportPeriod = useMemo(() => {
    const now = new Date();
    const rangeLabel = (from: Date, to: Date) => from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth() ? `${format(from, "dd")} - ${format(to, "dd MMMM yyyy")}` : `${format(from, "dd MMMM yyyy")} - ${format(to, "dd MMMM yyyy")}`;
    if (period === "Today") return { label: format(now, "dd MMMM yyyy"), filename: `piyu-pos-report-${format(now, "yyyy-MM-dd")}` };
    if (period === "Yesterday") { const date = subDays(now, 1); return { label: format(date, "dd MMMM yyyy"), filename: `piyu-pos-report-${format(date, "yyyy-MM-dd")}` }; }
    if (period === "This Week") { const from = startOfWeek(now, { weekStartsOn: 1 }); const to = endOfWeek(now, { weekStartsOn: 1 }); return { label: rangeLabel(from, to), filename: `piyu-pos-report-week-${format(from, "yyyy-MM-dd")}-to-${format(to, "yyyy-MM-dd")}` }; }
    if (period === "This Month") return { label: format(now, "MMMM yyyy"), filename: `piyu-pos-report-${format(now, "MMMM-yyyy").toLowerCase()}` };
    if (period === "Custom") {
      const from = start ? new Date(`${start}T00:00:00`) : null; const to = end ? new Date(`${end}T00:00:00`) : null;
      const label = from && to ? rangeLabel(from, to) : from ? `From ${format(from, "dd MMMM yyyy")}` : to ? `Up to ${format(to, "dd MMMM yyyy")}` : "Custom period";
      const filename = from && to ? `piyu-pos-report-${start}-to-${end}` : from ? `piyu-pos-report-from-${start}` : to ? `piyu-pos-report-to-${end}` : "piyu-pos-report-custom";
      return { label, filename };
    }
    return { label: "All time", filename: "piyu-pos-report-all-time" };
  }, [period, start, end]);
  const stats = [
    { label: "Total orders", value: data.length, money: false },
    { label: "Total sales", value: active.reduce((sum, order) => sum + order.grandTotal, 0), money: true },
    { label: "Delivered", value: data.filter(order => primaryOrderStatus(order.orderStatus) === "Delivered").length },
    { label: "Pending", value: data.filter(order => primaryOrderStatus(order.orderStatus) === "Pending").length },
    { label: "Canceled", value: data.filter(order => primaryOrderStatus(order.orderStatus) === "Canceled").length },
    { label: "Returned", value: data.filter(order => primaryOrderStatus(order.orderStatus) === "Returned").length },
    { label: "COD orders", value: data.filter(order => order.payment.method === "Cash on Delivery (COD)").length },
    { label: "Collected", value: data.reduce((sum, order) => sum + order.amountPaid, 0), money: true },
    { label: "Outstanding", value: data.reduce((sum, order) => sum + order.balance, 0), money: true },
  ];

  async function createPdf() {
    setPdfBusy(true);
    setPdfError("");
    try {
      await reportPdf(data, `Piyu POS - ${reportPeriod.label}`, `${reportPeriod.filename}.pdf`, status);
    } catch (error) {
      console.error("Unable to create report PDF", error);
      setPdfError("PDF could not be created. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  }

  function printReport() {
    setPrintTarget("document");
    flushSync(() => {
      setPrintError("");
      setPrintBusy(true);
    });
    const error = openPrintDialog();
    setPrintBusy(false);
    if (error) setPrintError(error);
  }

  return <>
    <div className="page-head"><div><h1>Reports</h1><span className="muted">Sales and order summary - {reportPeriod.label}</span></div></div>
    <div className="card no-print report-filters">
      <label className="field">Date range<select value={period} onChange={event => setPeriod(event.target.value)}>{["Today", "Yesterday", "This Week", "This Month", "Custom", "All time"].map(value => <option key={value}>{value}</option>)}</select></label>
      {period === "Custom" && <><label className="field">From<input type="date" value={start} onChange={event => setStart(event.target.value)}/></label><label className="field">To<input type="date" value={end} onChange={event => setEnd(event.target.value)}/></label></>}
      <label className="field">Order ID type<select value={orderPrefix} onChange={event => setOrderPrefix(event.target.value)}><option>All</option>{ORDER_PREFIXES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Order ID series<select value={orderSuffix} onChange={event => setOrderSuffix(event.target.value)}><option>All</option>{ORDER_SUFFIXES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Status<select value={status} onChange={event => setStatus(event.target.value)}><option>All</option>{REPORT_STATUSES.map(value => <option key={value}>{value}</option>)}</select></label>
      <button className="btn secondary" type="button" disabled={pdfBusy} onClick={createPdf}><FileText size={17}/>{pdfBusy ? "Creating…" : "PDF"}</button>
      <button className="btn secondary" onClick={() => downloadBlob(`${reportPeriod.filename}.csv`, ordersCsv(data), "text/csv")}><Download size={17}/>CSV</button>
      <button className="btn" type="button" disabled={printBusy} aria-busy={printBusy} onClick={printReport}>{printBusy ? <>Creating<span className="print-loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></> : <><Printer size={17}/>Print report</>}</button>
    </div>
    {pdfError && <p className="report-error no-print" role="alert">{pdfError}</p>}
    {printError && <p className="report-error no-print" role="alert">{printError}</p>}
    <div className="report-stats">{stats.map(stat => <div className={`card report-stat ${stat.money ? "report-stat-money" : ""}`} key={stat.label}><small className="muted">{stat.label}</small>{stat.money ? <div className="report-money"><span>LKR</span><strong>{Number(stat.value).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div> : <div className="report-stat-value">{stat.value}</div>}</div>)}</div>
    <OrderList key={`${period}-${start}-${end}-${orderPrefix}-${orderSuffix}-${status}`} orders={data} showWeight/>
  </>;
}
