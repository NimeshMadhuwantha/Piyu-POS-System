"use client";

import { useEffect, useMemo, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { AlertTriangle, CheckCircle2, Database, Download, Save, Trash2, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { APP_STORAGE_QUOTA_BYTES, clearBusinessData, saveBusinessSettings, subscribeBusinessSettings } from "@/lib/repositories";
import { useCustomers, useLogs, useOrders } from "@/hooks/use-data";
import { useApp } from "@/components/providers";
import { CatalogSettings } from "@/components/catalog-settings";
import { downloadBlob, ordersCsv } from "@/lib/export";
import type { BusinessSettings } from "@/types";
import { requestPersistentAppStorage } from "@/lib/local-data";

const defaults: BusinessSettings = { businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you for your order!", productCategories: [], shippingOptions: [] };
type ClearChoice = "logs" | "year" | "all";

export default function Settings() {
  const { user } = useApp();
  const { orders } = useOrders();
  const logs = useLogs();
  const customers = useCustomers();
  const [settings, setSettings] = useState<BusinessSettings>(defaults);
  const [saved, setSaved] = useState(false);
  const [clearChoice, setClearChoice] = useState<ClearChoice>("year");
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [clearResult, setClearResult] = useState("");
  const [persistentStorage, setPersistentStorage] = useState<boolean | null>();

  useEffect(() => {
    const unsubscribe = subscribeBusinessSettings(setSettings);
    void requestPersistentAppStorage().then(setPersistentStorage);
    return unsubscribe;
  }, []);
  const years = useMemo(() => Array.from(new Set([...orders.map(order => new Date(order.createdAtClient).getFullYear()), ...logs.map(log => new Date(log.clientTimestamp).getFullYear())])).filter(Number.isFinite).sort((a, b) => b - a), [orders, logs]);
  const estimatedBytes = useMemo(() => new TextEncoder().encode(JSON.stringify({ orders, logs, customers, settings })).length, [orders, logs, customers, settings]);
  const storagePercent = Math.min(100, estimatedBytes / APP_STORAGE_QUOTA_BYTES * 100);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    saveBusinessSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function openConfirmation(choice: ClearChoice) {
    setClearChoice(choice);
    setPassword("");
    setClearError("");
    setClearResult("");
    setConfirmOpen(true);
  }

  async function confirmClear(event: React.FormEvent) {
    event.preventDefault();
    if (!auth.currentUser?.email || user?.role !== "admin") { setClearError("Only a signed-in administrator can clear data."); return; }
    setClearing(true);
    setClearError("");
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      const result = await clearBusinessData(clearChoice === "year" ? { type: "year", year } : { type: clearChoice });
      setConfirmOpen(false);
      setPassword("");
      setClearResult(`Deleted ${result.orders} orders, ${result.logs} logs, and ${result.customers} unused customers from Firebase and the offline cache.`);
    } catch (error) {
      const code = (error as { code?: string }).code || "";
      setClearError(code.includes("invalid-credential") || code.includes("wrong-password") ? "Incorrect login password." : error instanceof Error ? error.message : "Data could not be cleared.");
    } finally { setClearing(false); }
  }

  const confirmationText = clearChoice === "logs" ? "all order logs" : clearChoice === "year" ? `orders and logs from ${year}` : "all orders, logs, and customers";

  return <>
    <div className="page-head"><div><h1>Settings</h1><span className="muted">Business, receipt, export, and data retention</span></div></div>
    <form className="card" onSubmit={submit} style={{ maxWidth: 760, marginBottom: 16 }}>
      <h2 className="section-title">Business & receipt</h2>
      <div className="grid-fields">
        <label className="field">Business name<input required value={settings.businessName} onChange={event => setSettings({ ...settings, businessName: event.target.value })}/></label>
        <label className="field">Phone<input inputMode="tel" value={settings.phone} onChange={event => setSettings({ ...settings, phone: event.target.value })}/></label>
        <label className="field">Address<textarea value={settings.address} onChange={event => setSettings({ ...settings, address: event.target.value })}/></label>
        <label className="field">Default paper size<select value={settings.receiptWidth} onChange={event => setSettings({ ...settings, receiptWidth: event.target.value as BusinessSettings["receiptWidth"] })}><option>58mm</option><option>80mm</option><option value="A4/4">A4/4 (105 × 148.5 mm)</option><option>A4</option></select></label>
        <label className="field">Receipt footer<input value={settings.footer} onChange={event => setSettings({ ...settings, footer: event.target.value })}/></label>
      </div>
      <button className="btn" type="submit" style={{ marginTop: 14 }}><Save size={17}/>{saved ? "Saved locally" : "Save settings"}</button>
      {saved && <p className="settings-success"><CheckCircle2 size={17}/>Settings are saved locally and will synchronize with Firebase.</p>}
    </form>
    <CatalogSettings settings={settings} onChange={next => { setSettings(next); saveBusinessSettings(next); }}/>

    <section className="card" style={{ maxWidth: 760, marginBottom: 16 }}><h2 className="section-title">Data export</h2><p>Download business data for a separate backup. Durable device storage improves offline use but does not replace an exported backup.</p><div className="settings-actions"><button type="button" className="btn secondary" onClick={() => downloadBlob(`piyu-orders-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(orders, null, 2), "application/json")}><Download size={17}/>Export JSON</button><button type="button" className="btn secondary" onClick={() => downloadBlob("piyu-orders.csv", ordersCsv(orders), "text/csv")}><Download size={17}/>Export CSV</button></div></section>

    <section className="card" style={{ maxWidth: 760, marginBottom: 16 }}><h2 className="section-title section-title-icon"><Database size={19}/>Storage capacity</h2><div className="storage-summary"><div><b>{(estimatedBytes / 1024 / 1024).toFixed(2)} MB estimated</b><span className="muted"> of the 150 MB application target</span></div><div className="storage-track"><span style={{ width: `${storagePercent}%` }}/></div><small className="muted">Device storage: {persistentStorage === true ? "protected from automatic cleanup" : persistentStorage === false ? "best effort (the browser did not grant persistent protection)" : persistentStorage === null ? "best effort (persistent protection is unavailable)" : "checking support"}.</small><small className="muted">{orders.length.toLocaleString()} orders · {logs.length.toLocaleString()} logs · {customers.length.toLocaleString()} customers. This is an application estimate; Firebase indexes and metadata are visible only in the Firebase usage console.</small>{storagePercent >= 100 && <div className="capacity-warning"><AlertTriangle size={20}/><div><b>The 150 MB application target has been reached.</b><br/><span>Export a backup and clear old data below.</span></div></div>}</div></section>

    <section className="card danger-zone" style={{ maxWidth: 760 }}><h2 className="section-title"><Trash2 size={19}/>Clear data</h2>{user?.role !== "admin" ? <p className="muted">Only administrators can clear Firebase data.</p> : <><p>Deletion removes records from Cloud Firestore and every device’s synchronized offline cache. Export a backup first.</p>{clearResult && <p className="settings-success"><CheckCircle2 size={17}/>{clearResult}</p>}<div className="clear-options"><div><b>Clear all logs</b><span>Keep orders and customers.</span><button type="button" className="btn danger" onClick={() => openConfirmation("logs")}>Clear logs</button></div><div><b>Clear data by year</b><span>Delete that year’s orders/logs and customers with no remaining orders.</span><label className="field">Year<select value={year} onChange={event => setYear(Number(event.target.value))}>{(years.length ? years : [new Date().getFullYear()]).map(value => <option key={value}>{value}</option>)}</select></label><button type="button" className="btn danger" onClick={() => openConfirmation("year")}>Clear {year}</button></div><div><b>Clear all business data</b><span>Delete all orders, logs, and customers. Users and settings remain.</span><button type="button" className="btn danger" onClick={() => openConfirmation("all")}>Clear everything</button></div></div></>}</section>

    {confirmOpen && <div className="modal-backdrop" onMouseDown={() => !clearing && setConfirmOpen(false)}><form className="card confirm-modal" onSubmit={confirmClear} onMouseDown={event => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close" disabled={clearing} onClick={() => setConfirmOpen(false)}><X size={20}/></button><AlertTriangle size={38} color="#dc2626"/><h2>Confirm permanent deletion</h2><p>You are about to delete <b>{confirmationText}</b>. This cannot be undone.</p><label className="field">Enter your current login password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} autoFocus/></label>{clearError && <p className="form-error" role="alert">{clearError}</p>}<div className="settings-actions"><button className="btn secondary" type="button" disabled={clearing} onClick={() => setConfirmOpen(false)}>Cancel</button><button className="btn danger" disabled={clearing || !password}>{clearing ? "Deleting…" : "Confirm deletion"}</button></div></form></div>}
  </>;
}
