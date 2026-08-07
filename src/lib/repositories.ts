import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser, BusinessSettings, Customer, Order, OrderLog, OrderStatus } from "@/types";

const stripUndefined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export async function getAuthorizedUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AppUser) : null;
}

export function subscribeOrders(callback: (orders: Order[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "orders"), orderBy("createdAtClient", "desc")), { includeMetadataChanges: true }, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites } as Order)));
  }, onError);
}

export async function saveOrder(order: Order, actor: AppUser, existing?: Order) {
  const now = new Date().toISOString();
  const ref = doc(db, "orders", order.id);
  const customerId = order.customerId || crypto.randomUUID();
  const payload = stripUndefined({ ...order, customerId, updatedBy: actor.uid, updatedAtClient: now, updatedAtServer: serverTimestamp(), ...(existing ? {} : { createdAtServer: serverTimestamp() }) });
  await setDoc(ref, payload, { merge: Boolean(existing) });
  const action = existing ? "Order updated" : "Order created";
  await addDoc(collection(db, "orderLogs"), stripUndefined({ orderId: order.id, orderCode: order.orderCode, action, description: `${action} by ${actor.name}`, previousValue: existing || null, newValue: order, actorUid: actor.uid, actorName: actor.name, clientTimestamp: now, serverTimestamp: serverTimestamp() }));
  const terms = [order.customer.name, order.customer.mobile1, order.customer.mobile2 || ""].map(x => x.toLowerCase()).filter(Boolean);
  await setDoc(doc(db, "customers", customerId), stripUndefined({ ...order.customer, id: customerId, searchTerms: terms, lastOrderAt: now, updatedAtClient: now, updatedAtServer: serverTimestamp() }), { merge: true });
  return customerId;
}

export async function updateOrderStatus(order: Order, status: OrderStatus, actor: AppUser) {
  const now = new Date().toISOString();
  await updateDoc(doc(db, "orders", order.id), { orderStatus: status, updatedBy: actor.uid, updatedAtClient: now, updatedAtServer: serverTimestamp() });
  await addDoc(collection(db, "orderLogs"), { orderId: order.id, orderCode: order.orderCode, action: "Status changed", description: `${order.orderStatus} → ${status}`, previousValue: order.orderStatus, newValue: status, actorUid: actor.uid, actorName: actor.name, clientTimestamp: now, serverTimestamp: serverTimestamp() });
}

export function subscribeCustomers(callback: (customers: Customer[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "customers"), orderBy("updatedAtClient", "desc")), { includeMetadataChanges: true }, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))));
}
export function subscribeLogs(callback: (logs: OrderLog[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, "orderLogs"), orderBy("clientTimestamp", "desc")), { includeMetadataChanges: true }, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites } as OrderLog))));
}
export async function getBusinessSettings(): Promise<BusinessSettings> {
  const snap = await getDoc(doc(db, "settings", "business"));
  return snap.exists() ? snap.data() as BusinessSettings : { businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you for your order!" };
}
export async function saveBusinessSettings(settings: BusinessSettings) { await setDoc(doc(db, "settings", "business"), settings); }
