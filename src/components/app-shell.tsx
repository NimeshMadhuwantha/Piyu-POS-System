"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, ClipboardList, FileClock, LayoutDashboard, LogOut, Menu, PlusCircle, Settings, Users, Wifi, WifiOff, X } from "lucide-react";
import { useApp } from "@/components/providers";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders/new", label: "New Order", icon: PlusCircle },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/logs", label: "Order Logs", icon: FileClock },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const isActive = (path: string, href: string) => {
  if (href === "/orders" && path.startsWith("/orders/new")) return false;
  return path === href || (href !== "/dashboard" && path.startsWith(`${href}/`));
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { firebaseUser, user, loading, online, setupError, signOutUser } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", close);
    document.body.classList.add("menu-open");
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("menu-open"); };
  }, [menuOpen]);

  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading Piyu POS…</div>;
  if (path === "/login") return <>{children}</>;
  if (!user) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}><div className="card" style={{ maxWidth: 560 }}><h2 style={{ marginTop: 0 }}>Firebase setup required</h2><p>{setupError || "Checking authorization…"}</p>{firebaseUser && <p className="muted" style={{ fontSize: 13 }}>Signed in as {firebaseUser.email}. After correcting Firebase, reload this page.</p>}<div style={{ display: "flex", gap: 8 }}><button className="btn" onClick={() => window.location.reload()}>Retry</button>{firebaseUser && <button className="btn secondary" onClick={signOutUser}>Sign out</button>}</div></div></div>;

  const navigation = (mobile = false) => <>
    <nav aria-label={mobile ? "Mobile navigation" : "Main navigation"}>{links.map(link => <Link key={link.href} href={link.href} className={isActive(path, link.href) ? "active" : ""} onClick={mobile ? () => setMenuOpen(false) : undefined}><link.icon size={19}/>{link.label}</Link>)}</nav>
    <button className="logout" onClick={signOutUser}><LogOut size={18}/>Sign out</button>
  </>;

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  };

  return <div>
    <aside className="app-sidebar"><div className="brand"><Image className="brand-logo" src="/icons/piyu%20logo.png" alt="Piyu logo" width={48} height={40} priority/><div>Piyu POS<small>Order Management</small></div></div>{navigation()}</aside>
    <header className="app-header">
      <button className="mobile-menu" type="button" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="mobile-drawer" onClick={() => setMenuOpen(true)}><Menu size={25}/></button>
      <div className={`connect ${online ? "online" : "offline"}`}>{online ? <Wifi size={16}/> : <WifiOff size={16}/>} {online ? "Online" : "Offline"}</div>
      <div className="user"><b>{user.name}</b><small>{user.role}</small></div>
    </header>
    <div className={`mobile-menu-layer ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
      <button className="menu-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>
      <aside id="mobile-drawer" className="mobile-drawer" aria-label="Mobile menu">
        <div className="drawer-head"><div className="brand"><Image className="brand-logo" src="/icons/piyu%20logo.png" alt="Piyu logo" width={48} height={40}/><div>Piyu POS<small>Order Management</small></div></div><button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={24}/></button></div>
        {navigation(true)}
      </aside>
    </div>
    <main className="app-main">{path !== "/dashboard" && path !== "/" && <button className="page-back no-print" type="button" aria-label="Go back" title="Go back" onClick={goBack}><ArrowLeft size={20}/></button>}{children}</main>
    <nav className="mobile-nav" aria-label="Quick navigation">{[links[0], links[2], links[1], links[5], links[6]].map(link => <Link key={link.href} href={link.href} className={isActive(path, link.href) ? "active" : ""}><link.icon size={21}/><small>{link.label.replace("New Order", "New")}</small></Link>)}</nav>
    <style jsx global>{`
      .app-sidebar{position:fixed;inset:0 auto 0 0;width:235px;background:#101827;color:#fff;padding:22px 14px;display:flex;flex-direction:column;z-index:30}.brand{display:flex;gap:11px;align-items:center;font-weight:800;font-size:17px;padding:0 8px 25px}.brand small,.user small{display:block;color:#94a3b8;font-weight:400;font-size:11px}.brand-logo{width:43px;height:38px;object-fit:contain;background:#fff;border-radius:10px}.app-sidebar nav,.mobile-drawer nav{display:grid;gap:4px}.app-sidebar a,.mobile-drawer a,.logout{display:flex;align-items:center;gap:11px;color:#cbd5e1;text-decoration:none;padding:11px;border-radius:8px;font-weight:600;font-size:14px}.app-sidebar a.active,.mobile-drawer a.active{color:#fff;background:#26344d}.logout{margin-top:auto;background:none;border:0}.app-header{position:fixed;left:235px;right:0;top:0;height:64px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:flex-end;gap:18px;padding:0 24px;z-index:20}.connect{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;padding:6px 9px;border-radius:999px;white-space:nowrap}.connect.online{background:#dcfce7;color:#166534}.connect.offline{background:#fef3c7;color:#92400e}.user{font-size:13px;min-width:0}.user b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.app-main{margin-left:235px;padding:88px 26px 90px;max-width:1500px;min-width:0}.page-back{display:grid;place-items:center;width:42px;height:42px;margin:-6px 0 14px;padding:0;border:1px solid #dbe2ea;border-radius:50%;background:#fff;color:#172033;box-shadow:0 2px 7px #0f172a12;transition:background .15s,transform .15s}.page-back:hover{background:#f8fafc;transform:translateX(-2px)}.page-back:focus-visible{outline:3px solid #2563eb44;outline-offset:2px}.mobile-nav,.mobile-menu,.mobile-menu-layer{display:none}
      @media(max-width:800px){body.menu-open{overflow:hidden}.app-sidebar{display:none}.app-header{left:0;height:58px;padding:0 13px;justify-content:flex-start;gap:10px}.mobile-menu{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;padding:0;border:0;background:transparent;color:#172033;border-radius:8px}.mobile-menu:focus-visible{outline:2px solid #2563eb}.user{margin-left:auto;max-width:32vw}.app-main{margin-left:0;padding:74px 12px calc(92px + env(safe-area-inset-bottom));width:100%;min-height:100dvh;overflow-x:hidden}.page-back{width:40px;height:40px;margin-bottom:12px}.mobile-nav{display:flex;position:fixed;z-index:40;inset:auto 0 0 0;width:100%;height:calc(66px + env(safe-area-inset-bottom));padding:0 0 env(safe-area-inset-bottom);background:#fff;border-top:1px solid #e2e8f0;box-shadow:0 -6px 18px #0f172a12;justify-content:space-around;isolation:isolate;transform:translateZ(0);backface-visibility:hidden}.mobile-nav:before{content:"";position:absolute;inset:0;background:#fff;z-index:-1}.mobile-nav a{display:flex;min-width:0;height:66px;flex:1;flex-direction:column;justify-content:center;align-items:center;gap:3px;text-decoration:none;color:#64748b;background:#fff}.mobile-nav a.active{color:#2563eb}.mobile-nav small{font-size:10px}.mobile-menu-layer{display:block;position:fixed;inset:0;z-index:50;visibility:hidden;pointer-events:none}.mobile-menu-layer.open{visibility:visible;pointer-events:auto}.menu-backdrop{position:absolute;inset:0;width:100%;height:100%;border:0;background:#0f172a99;opacity:0;transition:opacity .2s}.mobile-menu-layer.open .menu-backdrop{opacity:1}.mobile-drawer{position:absolute;inset:0 auto 0 0;width:min(82vw,310px);padding:18px 14px max(18px,env(safe-area-inset-bottom));background:#101827;color:#fff;display:flex;flex-direction:column;transform:translateX(-100%);transition:transform .22s ease;box-shadow:8px 0 30px #0f172a33;overflow-y:auto}.mobile-menu-layer.open .mobile-drawer{transform:translateX(0)}.drawer-head{display:flex;align-items:flex-start;justify-content:space-between}.drawer-head .brand{padding-bottom:22px}.drawer-head>button{display:grid;place-items:center;width:40px;height:40px;color:#fff;background:transparent;border:0;border-radius:8px}.mobile-drawer .logout{margin-top:auto}}
    `}</style>
  </div>;
}
