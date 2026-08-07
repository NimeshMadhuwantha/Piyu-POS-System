"use client";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { getAuthorizedUser } from "@/lib/repositories";
import type { AppUser } from "@/types";

type AppContextValue = { firebaseUser: User | null; user: AppUser | null; loading: boolean; online: boolean; signOutUser: () => Promise<void>; };
const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error("useApp must be inside AppProvider"); return value; }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const pathname = usePathname(); const router = useRouter();
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine); window.addEventListener("online", sync); window.addEventListener("offline", sync);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser); let profile: AppUser | null = null;
      if (fbUser) { try { profile = await getAuthorizedUser(fbUser.uid); } catch { profile = null; } }
      setUser(profile?.active ? profile : null); setLoading(false);
    });
  }, []);
  useEffect(() => { if (!loading && !firebaseUser && pathname !== "/login") router.replace("/login"); }, [firebaseUser, loading, pathname, router]);
  const value = useMemo(() => ({ firebaseUser, user, loading, online, signOutUser: async () => { await signOut(auth); router.replace("/login"); } }), [firebaseUser, user, loading, online, router]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
