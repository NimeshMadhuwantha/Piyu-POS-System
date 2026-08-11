"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Save } from "lucide-react";
import { saveBusinessSettings, subscribeBusinessSettings } from "@/lib/repositories";
import { useOrders } from "@/hooks/use-data";
import { downloadBlob, ordersCsv } from "@/lib/export";
import type { BusinessSettings } from "@/types";

const defaults: BusinessSettings = { businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you for your order!" };

export default function Settings() {
  const { orders } = useOrders();
  const [settings, setSettings] = useState<BusinessSettings>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => subscribeBusinessSettings(setSettings), []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    saveBusinessSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return <>
    <div className="page-head"><div><h1>Settings</h1><span className="muted">Business, receipt, and data export</span></div></div>
    <form className="card" onSubmit={submit} style={{ maxWidth: 760, marginBottom: 16 }}>
      <h2 className="section-title">Business & receipt</h2>
      <div className="grid-fields">
        <label className="field">Business name<input required value={settings.businessName} onChange={event => setSettings({ ...settings, businessName: event.target.value })}/></label>
        <label className="field">Phone<input inputMode="tel" value={settings.phone} onChange={event => setSettings({ ...settings, phone: event.target.value })}/></label>
        <label className="field">Address<textarea value={settings.address} onChange={event => setSettings({ ...settings, address: event.target.value })}/></label>
        <label className="field">Default paper size<select value={settings.receiptWidth} onChange={event => setSettings({ ...settings, receiptWidth: event.target.value as BusinessSettings["receiptWidth"] })}><option>58mm</option><option>80mm</option><option>A4</option></select></label>
        <label className="field">Receipt footer<input value={settings.footer} onChange={event => setSettings({ ...settings, footer: event.target.value })}/></label>
      </div>
      <button className="btn" type="submit" style={{ marginTop: 14 }}><Save size={17}/>{saved ? "Saved locally" : "Save settings"}</button>
      {saved && <p className="settings-success"><CheckCircle2 size={17}/>Settings are saved locally and will synchronize with Firebase.</p>}
    </form>
    <section className="card" style={{ maxWidth: 760 }}><h2 className="section-title">Data export</h2><p>Download business data for a backup. Browser offline storage is only a cache and is not a backup.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="btn secondary" onClick={() => downloadBlob(`piyu-orders-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(orders, null, 2), "application/json")}><Download size={17}/>Export JSON</button><button type="button" className="btn secondary" onClick={() => downloadBlob("piyu-orders.csv", ordersCsv(orders), "text/csv")}><Download size={17}/>Export CSV</button></div></section>
  </>;
}
