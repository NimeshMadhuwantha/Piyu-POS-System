import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser, BusinessSettings, Customer, Order, OrderLog, OrderStatus } from "@/types";

export const FIRESTORE_SYNC_ERROR_EVENT = "piyu:firestore-sync-error";
export const FIRESTORE_CONNECTION_EVENT = "piyu:firestore-connection";

function reportConnection(connected: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FIRESTORE_CONNECTION_EVENT, { detail: { connected } }));
}

function reportBackgroundSyncError(error: unknown) {
  if (typeof window === "undefined") return;
  const detail = error instanceof Error ? error.message : "A local change could not be synchronized.";
  window.dispatchEvent(new CustomEvent(FIRESTORE_SYNC_ERROR_EVENT, { detail }));
}

/**
 * Firestore applies a commit to its IndexedDB-backed local view immediately, but
 * its Promise only resolves after the server acknowledges it. Do not await that
 * acknowledgement: offline users must be able to continue while Firestore retries.
 */
function queueCommit(commit: Promise<void>) {
  void commit.catch(reportBackgroundSyncError);
}

export async function getAuthorizedUser(uid: string): Promise<AppUser | null> {
  try {
    const cached = await getDocFromCache(doc(db, "users", uid));
    if (cached.exists()) return { uid: cached.id, ...cached.data() } as AppUser;
  } catch {
    // A first login has no cached profile and must continue to the server.
  }
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AppUser) : null;
}

export function subscribeOrders(callback: (orders: Order[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "orders"), orderBy("createdAtClient", "desc")),
    { includeMetadataChanges: true },
    snap => {
      reportConnection(!snap.metadata.fromCache);
      callback(snap.docs.map(item => ({ id: item.id, ...item.data(), pending: item.metadata.hasPendingWrites } as Order)));
    },
    error => { reportConnection(false); onError?.(error); },
  );
}

export function saveOrder(order: Order, actor: AppUser, existing?: Order): string {
  const now = new Date().toISOString();
  const customerId = order.customerId || crypto.randomUUID();
  const batch = writeBatch(db);

  batch.set(doc(db, "orders", order.id), {
    ...order,
    customerId,
    updatedBy: actor.uid,
    updatedAtClient: now,
    updatedAtServer: serverTimestamp(),
    ...(existing ? {} : { createdAtServer: serverTimestamp() }),
  }, { merge: Boolean(existing) });

  const action = existing ? "Order updated" : "Order created";
  batch.set(doc(collection(db, "orderLogs")), {
    orderId: order.id,
    orderCode: order.orderCode,
    action,
    description: `${action} by ${actor.name}`,
    previousValue: existing || null,
    newValue: order,
    actorUid: actor.uid,
    actorName: actor.name,
    clientTimestamp: now,
    serverTimestamp: serverTimestamp(),
  });

  const searchTerms = [order.customer.name, order.customer.mobile1, order.customer.mobile2 || ""]
    .map(value => value.toLowerCase())
    .filter(Boolean);
  batch.set(doc(db, "customers", customerId), {
    ...order.customer,
    id: customerId,
    searchTerms,
    lastOrderAt: now,
    updatedAtClient: now,
    updatedAtServer: serverTimestamp(),
  }, { merge: true });

  queueCommit(batch.commit());
  return customerId;
}

export function updateOrderStatus(order: Order, status: OrderStatus, actor: AppUser) {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, "orders", order.id), {
    orderStatus: status,
    updatedBy: actor.uid,
    updatedAtClient: now,
    updatedAtServer: serverTimestamp(),
  });
  batch.set(doc(collection(db, "orderLogs")), {
    orderId: order.id,
    orderCode: order.orderCode,
    action: "Status changed",
    description: `${order.orderStatus} -> ${status}`,
    previousValue: order.orderStatus,
    newValue: status,
    actorUid: actor.uid,
    actorName: actor.name,
    clientTimestamp: now,
    serverTimestamp: serverTimestamp(),
  });
  queueCommit(batch.commit());
}

export function deleteOrder(order: Order, actor: AppUser) {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.delete(doc(db, "orders", order.id));
  batch.set(doc(collection(db, "orderLogs")), {
    orderId: order.id,
    orderCode: order.orderCode,
    action: "Order deleted",
    description: `Order deleted by ${actor.name}`,
    previousValue: order,
    newValue: null,
    actorUid: actor.uid,
    actorName: actor.name,
    clientTimestamp: now,
    serverTimestamp: serverTimestamp(),
  });
  queueCommit(batch.commit());
}

export function subscribeCustomers(callback: (customers: Customer[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "customers"), orderBy("updatedAtClient", "desc")),
    { includeMetadataChanges: true },
    snap => { reportConnection(!snap.metadata.fromCache); callback(snap.docs.map(item => ({ id: item.id, ...item.data() } as Customer))); },
    () => reportConnection(false),
  );
}

export function subscribeLogs(callback: (logs: OrderLog[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "orderLogs"), orderBy("clientTimestamp", "desc")),
    { includeMetadataChanges: true },
    snap => { reportConnection(!snap.metadata.fromCache); callback(snap.docs.map(item => ({ id: item.id, ...item.data(), pending: item.metadata.hasPendingWrites } as OrderLog))); },
    () => reportConnection(false),
  );
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, "settings", "business"));
  return snap.exists()
    ? snap.data() as BusinessSettings
    : { businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you for your order!" };
}

export function saveBusinessSettings(settings: BusinessSettings) {
  queueCommit(setDoc(doc(db, "settings", "business"), settings));
}
