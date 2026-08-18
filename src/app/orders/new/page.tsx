"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { OrderForm } from "@/components/order-form";
import { useOrders } from "@/hooks/use-data";
import { MAX_COLLECTION_RECORDS } from "@/lib/repositories";

export default function NewOrder() {
  const { orders, loading } = useOrders();
  return <>
    <div className="page-head"><div><h1>New Order</h1><span className="muted">Client, items, shipping and payment in one order</span></div></div>
    {!loading && orders.length >= MAX_COLLECTION_RECORDS ? <section className="card"><div className="capacity-warning"><AlertTriangle size={20}/><div><b>The {MAX_COLLECTION_RECORDS.toLocaleString()} order limit has been reached.</b><br/><span>Clear old monthly data before creating another order.</span></div></div><Link className="btn" href="/settings">Open Settings</Link></section> : <OrderForm/>}
  </>;
}
