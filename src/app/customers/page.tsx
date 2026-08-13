"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCustomers } from "@/hooks/use-data";
import { CapacityWarning } from "@/components/capacity-warning";
import { MAX_COLLECTION_RECORDS } from "@/lib/repositories";
import { RECORD_PAGE_SIZE, ViewMore } from "@/components/view-more";

export default function Customers() {
  const customers = useCustomers();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(RECORD_PAGE_SIZE);
  const filtered = useMemo(() => customers.filter(customer => [customer.name, customer.mobile1, customer.mobile2 || ""].some(value => value.toLowerCase().includes(query.toLowerCase()))), [customers, query]);
  const visibleCustomers = filtered.slice(0, visibleCount);
  return <>
    <div className="page-head"><div><h1>Customers</h1><span className="muted">Customer records created from orders</span></div></div>
    <CapacityWarning label="Customers" count={customers.length} limit={MAX_COLLECTION_RECORDS}/>
    <label className="field card" style={{ marginBottom: 14 }}>Search by name or mobile<input value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(RECORD_PAGE_SIZE); }} placeholder="Start typing…"/></label>
    <div className="card table-wrap"><table className="table"><thead><tr><th>Customer</th><th>Mobile numbers</th><th>Address</th><th>Last order</th></tr></thead><tbody>{visibleCustomers.map(customer => <tr key={customer.id}><td><Link href={`/customers/${customer.id}`}><b>{customer.name}</b></Link></td><td>{customer.mobile1}<br/>{customer.mobile2}</td><td>{[customer.address1, customer.address2, customer.city, customer.district].filter(Boolean).join(", ")}</td><td>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : "-"}</td></tr>)}</tbody></table>{!filtered.length && <p className="muted">No customers found.</p>}</div>
    <ViewMore shown={visibleCustomers.length} total={filtered.length} onMore={() => setVisibleCount(count => count + RECORD_PAGE_SIZE)}/>
  </>;
}
