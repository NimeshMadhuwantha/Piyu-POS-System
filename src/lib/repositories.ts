import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db, firebaseApiKey, firebaseProjectId } from "@/lib/firebase";
import type { AppUser, BusinessSettings, Customer, Order, OrderLog, OrderStatus } from "@/types";

export const FIRESTORE_SYNC_ERROR_EVENT = "piyu:firestore-sync-error";
export const FIRESTORE_CONNECTION_EVENT = "piyu:firestore-connection";
const BUSINESS_SETTINGS_KEY = "piyu-pos-business-settings";
const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = { businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you for your order!" };
export const MAX_COLLECTION_RECORDS = 3000;
export const APP_STORAGE_QUOTA_BYTES = 150 * 1024 * 1024;

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
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AppUser) : null;
  } catch (sdkError) {
    // Some browser/network combinations can authenticate successfully but fail
    // Firestore's realtime WebChannel. The authenticated REST endpoint uses the
    // same Firebase ID token and security rules, and gives us a reliable profile
    // bootstrap plus a precise HTTP error when project settings are blocking it.
    const currentUser = auth.currentUser;
    if (!currentUser || !firebaseProjectId || !firebaseApiKey) throw sdkError;
    const token = await currentUser.getIdToken();
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}?key=${encodeURIComponent(firebaseApiKey)}`;
    let response: Response;
    try {
      response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new Error("Firestore REST connection was blocked by this browser or network.");
    }
    if (response.status === 404) return null;
    const body = await response.json().catch(() => ({})) as { error?: { message?: string; status?: string }; fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> };
    if (!response.ok) {
      throw new Error(`Firestore REST ${response.status} ${body.error?.status || "ERROR"}: ${body.error?.message || "Request failed"}`);
    }
    const fields = body.fields || {};
    return {
      uid,
      name: fields.name?.stringValue || currentUser.email || "User",
      email: fields.email?.stringValue || currentUser.email || "",
      role: fields.role?.stringValue === "staff" ? "staff" : "admin",
      active: fields.active?.booleanValue === true,
    };
  }
}

export function subscribeOrders(callback: (orders: Order[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "orders"), orderBy("createdAtClient", "desc"), limit(MAX_COLLECTION_RECORDS)),
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
    query(collection(db, "customers"), orderBy("updatedAtClient", "desc"), limit(MAX_COLLECTION_RECORDS)),
    { includeMetadataChanges: true },
    snap => { reportConnection(!snap.metadata.fromCache); callback(snap.docs.map(item => ({ id: item.id, ...item.data() } as Customer))); },
    () => reportConnection(false),
  );
}

export function subscribeLogs(callback: (logs: OrderLog[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "orderLogs"), orderBy("clientTimestamp", "desc"), limit(MAX_COLLECTION_RECORDS)),
    { includeMetadataChanges: true },
    snap => { reportConnection(!snap.metadata.fromCache); callback(snap.docs.map(item => ({ id: item.id, ...item.data(), pending: item.metadata.hasPendingWrites } as OrderLog))); },
    () => reportConnection(false),
  );
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(BUSINESS_SETTINGS_KEY);
    if (stored) {
      try { return JSON.parse(stored) as BusinessSettings; } catch { localStorage.removeItem(BUSINESS_SETTINGS_KEY); }
    }
  }
  try {
    const cached = await getDocFromCache(doc(db, "settings", "business"));
    if (cached.exists()) return cached.data() as BusinessSettings;
  } catch {
    // Continue to the server when the setting has not been cached before.
  }
  const snap = await getDoc(doc(db, "settings", "business"));
  return snap.exists() ? snap.data() as BusinessSettings : DEFAULT_BUSINESS_SETTINGS;
}

export function subscribeBusinessSettings(callback: (settings: BusinessSettings) => void): Unsubscribe {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(BUSINESS_SETTINGS_KEY);
    if (stored) {
      try { callback(JSON.parse(stored) as BusinessSettings); } catch { localStorage.removeItem(BUSINESS_SETTINGS_KEY); }
    }
  }
  return onSnapshot(doc(db, "settings", "business"), { includeMetadataChanges: true }, snap => {
    reportConnection(!snap.metadata.fromCache);
    const settings = snap.exists() ? snap.data() as BusinessSettings : DEFAULT_BUSINESS_SETTINGS;
    if (typeof window !== "undefined") localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(settings));
    callback(settings);
  }, () => reportConnection(false));
}

export function saveBusinessSettings(settings: BusinessSettings) {
  if (typeof window !== "undefined") localStorage.setItem(BUSINESS_SETTINGS_KEY, JSON.stringify(settings));
  queueCommit(setDoc(doc(db, "settings", "business"), settings));
}

type ClearDataMode = { type: "logs" } | { type: "year"; year: number } | { type: "all" };

async function deleteDocuments(refs: Array<ReturnType<typeof doc>>) {
  for (let start = 0; start < refs.length; start += 400) {
    const batch = writeBatch(db);
    refs.slice(start, start + 400).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function removeOrphanCustomers() {
  const [ordersSnapshot, customersSnapshot] = await Promise.all([getDocs(collection(db, "orders")), getDocs(collection(db, "customers"))]);
  const customerIds = new Set<string>();
  const customerMobiles = new Set<string>();
  ordersSnapshot.docs.forEach(item => {
    const order = item.data() as Order;
    if (order.customerId) customerIds.add(order.customerId);
    if (order.customer?.mobile1) customerMobiles.add(order.customer.mobile1);
  });
  const orphanRefs = customersSnapshot.docs.filter(item => {
    const customer = item.data() as Customer;
    return !customerIds.has(item.id) && !customerMobiles.has(customer.mobile1);
  }).map(item => item.ref);
  await deleteDocuments(orphanRefs);
  return orphanRefs.length;
}

export async function clearBusinessData(mode: ClearDataMode) {
  let orderSnapshot;
  let logSnapshot;
  if (mode.type === "year") {
    const start = `${mode.year}-01-01T00:00:00.000Z`;
    const end = `${mode.year + 1}-01-01T00:00:00.000Z`;
    [orderSnapshot, logSnapshot] = await Promise.all([
      getDocs(query(collection(db, "orders"), where("createdAtClient", ">=", start), where("createdAtClient", "<", end))),
      getDocs(query(collection(db, "orderLogs"), where("clientTimestamp", ">=", start), where("clientTimestamp", "<", end))),
    ]);
  } else {
    [orderSnapshot, logSnapshot] = await Promise.all([
      mode.type === "all" ? getDocs(collection(db, "orders")) : Promise.resolve(null),
      getDocs(collection(db, "orderLogs")),
    ]);
  }
  const orderRefs = orderSnapshot?.docs.map(item => item.ref) || [];
  const logRefs = logSnapshot.docs.map(item => item.ref);
  await deleteDocuments([...orderRefs, ...logRefs]);
  let customers = 0;
  if (mode.type === "all") {
    const customersSnapshot = await getDocs(collection(db, "customers"));
    customers = customersSnapshot.size;
    await deleteDocuments(customersSnapshot.docs.map(item => item.ref));
  } else if (mode.type === "year") customers = await removeOrphanCustomers();
  return { orders: orderRefs.length, logs: logRefs.length, customers };
}
