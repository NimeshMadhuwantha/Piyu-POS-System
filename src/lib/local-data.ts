import { auth } from "@/lib/firebase";

export type LocalSnapshotName = "orders" | "customers" | "logs" | "settings";

const DATABASE_NAME = "piyu-pos-app-data";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";

type SnapshotRecord<T> = {
  key: string;
  value: T;
  updatedAt: string;
};

let databasePromise: Promise<IDBDatabase | null> | null = null;
const pendingWrites = new Map<string, unknown>();
const scheduledWrites = new Set<string>();

function snapshotKey(name: LocalSnapshotName) {
  return `${auth.currentUser?.uid || "device"}:${name}`;
}

function openLocalDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise(resolve => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) request.result.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

export async function readLocalSnapshot<T>(name: LocalSnapshotName): Promise<T | null> {
  const database = await openLocalDatabase();
  if (!database) return null;
  return new Promise(resolve => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
    const request = transaction.objectStore(SNAPSHOT_STORE).get(snapshotKey(name));
    request.onsuccess = () => resolve((request.result as SnapshotRecord<T> | undefined)?.value ?? null);
    request.onerror = () => resolve(null);
    transaction.onabort = () => resolve(null);
  });
}

export function saveLocalSnapshot<T>(name: LocalSnapshotName, value: T) {
  if (typeof window === "undefined") return;
  const key = snapshotKey(name);
  pendingWrites.set(key, value);
  if (scheduledWrites.has(key)) return;
  scheduledWrites.add(key);
  const save = async () => {
    scheduledWrites.delete(key);
    const latestValue = pendingWrites.get(key);
    pendingWrites.delete(key);
    const database = await openLocalDatabase();
    if (!database || latestValue === undefined) return;
    try {
      const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
      transaction.objectStore(SNAPSHOT_STORE).put({ key, value: latestValue, updatedAt: new Date().toISOString() } satisfies SnapshotRecord<unknown>);
    } catch {
      // Firestore remains authoritative if this browser cannot use the extra mirror.
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(() => void save(), { timeout: 1000 });
  else globalThis.setTimeout(() => void save(), 0);
}

export async function requestPersistentAppStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
