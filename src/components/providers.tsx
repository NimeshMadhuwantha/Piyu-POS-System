"use client";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { getAuthorizedUser } from "@/lib/repositories";
import type { AppUser } from "@/types";

type AppContextValue = { firebaseUser: User | null; user: AppUser | null; loading: boolean; online: boolean; setupError: string | null; signOutUser: () => Promise<void>; };
const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error("useApp must be inside AppProvider"); return value; }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const pathname = usePathname(); const router = useRouter();
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } else {
        // A development service worker can retain bundles containing old .env values.
        void navigator.serviceWorker.getRegistrations().then(items => Promise.all(items.map(item => item.unregister())));
        if ("caches" in window) void caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("piyu-pos-")).map(key => caches.delete(key))));
      }
    }
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser); setSetupError(null); let profile: AppUser | null = null;
      if (fbUser) {
        try {
          profile = await getAuthorizedUser(fbUser.uid);
          if (!profile) setSetupError("Your Firebase login exists, but its matching users/{uid} Firestore document is missing.");
          else if (!profile.active) setSetupError("This POS user account has been disabled.");
        } catch (error) {
          const code = (error as { code?: string }).code || "";
          setSetupError(code.includes("permission-denied")
            ? "Firestore denied access. Deploy the included security rules and verify your users/{uid} document."
            : "Cloud Firestore is unavailable. Create the (default) Firestore database in project piyu-pos-system, then reload the app.");
        }
      }
      setUser(profile?.active ? profile : null); setLoading(false);
    });
  }, []);
  useEffect(() => { if (!loading && !firebaseUser && pathname !== "/login") router.replace("/login"); }, [firebaseUser, loading, pathname, router]);
  const value = useMemo(() => ({ firebaseUser, user, loading, online, setupError, signOutUser: async () => { await signOut(auth); router.replace("/login"); } }), [firebaseUser, user, loading, online, setupError, router]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
