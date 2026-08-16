"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useLogs } from "@/hooks/use-data";
import { CapacityWarning } from "@/components/capacity-warning";
import { MAX_LOG_RECORDS } from "@/lib/repositories";
import { RECORD_PAGE_SIZE, ViewMore } from "@/components/view-more";

export default function Logs() {
  const logs = useLogs();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("All");
  const [visibleCount, setVisibleCount] = useState(RECORD_PAGE_SIZE);
  const actions = Array.from(new Set(logs.map(log => log.action)));
  const filtered = useMemo(() => logs.filter(log => (action === "All" || log.action === action) && [log.orderCode, log.description, log.actorName].some(value => value.toLowerCase().includes(query.toLowerCase()))), [logs, query, action]);
  const visibleLogs = filtered.slice(0, visibleCount);
  return <>
    <div className="page-head"><div><h1>Order Logs</h1><span className="muted">Append-only activity history</span></div></div>
    <CapacityWarning label="Logs" count={logs.length} limit={MAX_LOG_RECORDS}/>
    <div className="card grid-fields" style={{ marginBottom: 14 }}><label className="field">Search<input value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(RECORD_PAGE_SIZE); }} placeholder="Order, action, user…"/></label><label className="field">Action<select value={action} onChange={event => { setAction(event.target.value); setVisibleCount(RECORD_PAGE_SIZE); }}><option>All</option>{actions.map(value => <option key={value}>{value}</option>)}</select></label></div>
    <div className="card table-wrap"><table className="table"><thead><tr><th>Date</th><th>Order</th><th>Action</th><th>Description</th><th>User</th><th>Sync</th></tr></thead><tbody>{visibleLogs.map(log => <tr key={log.id}><td>{format(new Date(log.clientTimestamp), "dd MMM yy, h:mm a")}</td><td>{log.orderCode}</td><td><b>{log.action}</b></td><td>{log.description}</td><td>{log.actorName}</td><td>{log.pending ? "Waiting" : "Synced"}</td></tr>)}</tbody></table>{!filtered.length && <p className="muted">No activity logs found.</p>}</div>
    <ViewMore shown={visibleLogs.length} total={filtered.length} onMore={() => setVisibleCount(count => count + RECORD_PAGE_SIZE)}/>
  </>;
}
