"use client";
import { useEffect, useState } from "react";
import { subscribeCustomers, subscribeLogs, subscribeOrders } from "@/lib/repositories";
import type { Customer, Order, OrderLog } from "@/types";

export function useOrders() { const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); useEffect(() => subscribeOrders(x => { setOrders(x); setLoading(false); }, () => setLoading(false)), []); return { orders, loading }; }
export function useCustomers() { const [customers, setCustomers] = useState<Customer[]>([]); useEffect(() => subscribeCustomers(setCustomers), []); return customers; }
export function useLogs() { const [logs, setLogs] = useState<OrderLog[]>([]); useEffect(() => subscribeLogs(setLogs), []); return logs; }
