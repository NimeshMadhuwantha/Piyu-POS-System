"use client";

import { useMemo, useSyncExternalStore } from "react";
import { subscribeCustomers, subscribeLogs, subscribeOrders } from "@/lib/repositories";
import { saveLocalSnapshot } from "@/lib/local-data";
import type { CommercialInvoiceDetails, Customer, DeliveryConfirmation, Order, OrderLog, OrderStatus } from "@/types";

type Listener = () => void;
type Stop = () => void;

function createSharedStore<T>(initialValue: T, start: (update: (value: T) => void, fail: () => void) => Stop) {
  let value = initialValue;
  let loading = true;
  let stop: Stop | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<Listener>();

  const emit = () => listeners.forEach(listener => listener());
  const update = (nextValue: T) => {
    value = nextValue;
    loading = false;
    emit();
  };
  const fail = () => {
    if (!loading) return;
    loading = false;
    emit();
  };
  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    if (!stop) stop = start(update, fail);
    return () => {
      listeners.delete(listener);
      if (listeners.size || !stop) return;
      // Page transitions often unmount and remount a data consumer. Keeping the
      // live listener briefly avoids an unnecessary Firestore reconnect while
      // still releasing it when that section of the app is no longer used.
      stopTimer = setTimeout(() => {
        if (listeners.size || !stop) return;
        stop();
        stop = null;
        stopTimer = null;
      }, 30_000);
    };
  };

  return {
    subscribe,
    getValue: () => value,
    getLoading: () => loading,
    updateValue: (change: (current: T) => T) => update(change(value)),
  };
}

const EMPTY_ORDERS: Order[] = [];
const EMPTY_CUSTOMERS: Customer[] = [];
const EMPTY_LOGS: OrderLog[] = [];

const ordersStore = createSharedStore<Order[]>(EMPTY_ORDERS, (update, fail) => subscribeOrders(update, fail));
const customersStore = createSharedStore<Customer[]>(EMPTY_CUSTOMERS, update => subscribeCustomers(update));
const logsStore = createSharedStore<OrderLog[]>(EMPTY_LOGS, update => subscribeLogs(update));

export function useOrders() {
  const orders = useSyncExternalStore(ordersStore.subscribe, ordersStore.getValue, ordersStore.getValue);
  const loading = useSyncExternalStore(ordersStore.subscribe, ordersStore.getLoading, ordersStore.getLoading);
  return useMemo(() => ({ orders, loading }), [orders, loading]);
}

export function updateCachedOrderStatus(orderId: string, orderStatus: OrderStatus) {
  ordersStore.updateValue(orders => orders.map(order => order.id === orderId ? { ...order, orderStatus } : order));
}

export function updateCachedOrderDelivery(orderId: string, deliveryConfirmation: DeliveryConfirmation) {
  ordersStore.updateValue(orders => orders.map(order => order.id === orderId ? {
    ...order,
    orderStatus: "Delivered",
    shipping: { ...order.shipping, trackingNumber: deliveryConfirmation.trackingNumber, parcelWeight: deliveryConfirmation.parcelWeight },
    deliveryConfirmation,
    updatedAtClient: deliveryConfirmation.confirmedAtClient,
  } : order));
}

export function updateCachedCommercialInvoice(orderId: string, commercialInvoice: CommercialInvoiceDetails, updatedAtClient: string) {
  ordersStore.updateValue(orders => {
    const updated = orders.map(order => order.id === orderId ? { ...order, commercialInvoice, updatedAtClient } : order);
    saveLocalSnapshot("orders", updated);
    return updated;
  });
}

export function useCustomers() {
  return useSyncExternalStore(customersStore.subscribe, customersStore.getValue, customersStore.getValue);
}

export function useLogs() {
  return useSyncExternalStore(logsStore.subscribe, logsStore.getValue, logsStore.getValue);
}
