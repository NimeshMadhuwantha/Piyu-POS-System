import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseApiKey = firebaseConfig.apiKey;
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
// Firebase validates config during module evaluation. Build-only placeholders let
// Next.js prerender the login/404 pages before the owner adds real environment values.
const safeConfig = firebaseConfigured ? firebaseConfig : {
  apiKey: "AIzaSyDUMMY_PiyuPOS_BuildPlaceholder000000",
  authDomain: "piyu-pos-placeholder.firebaseapp.com",
  projectId: "piyu-pos-placeholder",
  storageBucket: "piyu-pos-placeholder.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};
const app = getApps().length ? getApp() : initializeApp(safeConfig);
export const auth = getAuth(app);
if (typeof window !== "undefined") void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
let firestore: Firestore;
try {
  firestore = initializeFirestore(app, {
    // Let the SDK select streaming or long polling for the current browser and
    // network. Forced long polling can fail on production networks that do not
    // need it; automatic detection falls back only when required.
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  firestore = getFirestore(app);
}
export const db = firestore;
// Connectivity is represented in the app UI and pending-write badges. Avoid
// Firebase's expected offline retry message becoming a Next.js error overlay.
if (typeof window !== "undefined") setLogLevel("silent");
