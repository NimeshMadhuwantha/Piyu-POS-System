"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { BusinessSettings, CatalogItem, ProductCategory, ShippingOption, ShippingRate } from "@/types";

type DeleteTarget = { kind: "category"; id: string; label: string } | { kind: "item"; categoryId: string; id: string; label: string } | { kind: "shipping"; id: string; label: string } | { kind: "rate"; shippingId: string; id: string; label: string };
const id = () => crypto.randomUUID();
const blankItem = (): CatalogItem => ({ id: id(), name: "", unit: "pcs", weight: 0, unitPrice: 0, discount: 0 });
const blankRate = (): ShippingRate => ({ id: id(), minWeight: 0, maxWeight: 0, price: 0 });
const selectInitialZero = (event: React.FocusEvent<HTMLElement>) => { const target = event.target; if (target instanceof HTMLInputElement && target.type === "number" && Number(target.value) === 0) target.select(); };

export function CatalogSettings({ settings, onChange }: { settings: BusinessSettings; onChange: (settings: BusinessSettings) => void }) {
  const categories = settings.productCategories || [];
  const shipping = settings.shippingOptions || [];
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, CatalogItem>>({});
  const [editingItem, setEditingItem] = useState<{ categoryId: string; id: string } | null>(null);
  const [shippingDraft, setShippingDraft] = useState<ShippingOption>({ id: id(), name: "", courier: "", rates: [] });
  const [editingShipping, setEditingShipping] = useState<string | null>(null);
  const [rateDrafts, setRateDrafts] = useState<Record<string, ShippingRate>>({});
  const [editingRate, setEditingRate] = useState<{ shippingId: string; id: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [error, setError] = useState("");

  const updateCategories = (productCategories: ProductCategory[]) => onChange({ ...settings, productCategories });
  const updateShipping = (shippingOptions: ShippingOption[]) => onChange({ ...settings, shippingOptions });

  function saveCategory() {
    const name = categoryName.trim(); if (!name) return;
    updateCategories(editingCategory ? categories.map(category => category.id === editingCategory ? { ...category, name } : category) : [...categories, { id: id(), name, items: [] }]);
    setCategoryName(""); setEditingCategory(null);
  }
  function saveItem(categoryId: string) {
    const draft = itemDrafts[categoryId] || blankItem(); if (!draft.name.trim()) return;
    updateCategories(categories.map(category => category.id !== categoryId ? category : { ...category, items: editingItem?.categoryId === categoryId ? category.items.map(item => item.id === editingItem.id ? { ...draft, name: draft.name.trim() } : item) : [...category.items, { ...draft, name: draft.name.trim() }] }));
    setItemDrafts(current => ({ ...current, [categoryId]: blankItem() })); setEditingItem(null);
  }
  function saveShipping() {
    const name = shippingDraft.name.trim(); if (!name) return;
    const next = { ...shippingDraft, name, courier: shippingDraft.courier.trim() };
    updateShipping(editingShipping ? shipping.map(option => option.id === editingShipping ? next : option) : [...shipping, next]);
    setShippingDraft({ id: id(), name: "", courier: "", rates: [] }); setEditingShipping(null);
  }
  function saveRate(shippingId: string) {
    const draft = rateDrafts[shippingId] || blankRate();
    const option = shipping.find(item => item.id === shippingId);
    if (draft.maxWeight < draft.minWeight) { setError("The ending weight must be greater than or equal to the starting weight."); return; }
    const overlaps = option?.rates.some(rate => rate.id !== editingRate?.id && draft.minWeight <= rate.maxWeight && draft.maxWeight >= rate.minWeight);
    if (overlaps) { setError("Shipping weight ranges cannot overlap."); return; }
    setError("");
    updateShipping(shipping.map(option => option.id !== shippingId ? option : { ...option, rates: editingRate?.shippingId === shippingId ? option.rates.map(rate => rate.id === editingRate.id ? draft : rate) : [...option.rates, draft].sort((a, b) => a.minWeight - b.minWeight) }));
    setRateDrafts(current => ({ ...current, [shippingId]: blankRate() })); setEditingRate(null);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "category") updateCategories(categories.filter(category => category.id !== deleteTarget.id));
    if (deleteTarget.kind === "item") updateCategories(categories.map(category => category.id === deleteTarget.categoryId ? { ...category, items: category.items.filter(item => item.id !== deleteTarget.id) } : category));
    if (deleteTarget.kind === "shipping") updateShipping(shipping.filter(option => option.id !== deleteTarget.id));
    if (deleteTarget.kind === "rate") updateShipping(shipping.map(option => option.id === deleteTarget.shippingId ? { ...option, rates: option.rates.filter(rate => rate.id !== deleteTarget.id) } : option));
    setDeleteTarget(null);
  }

  return <>
    <section className="card catalog-settings" style={{ maxWidth: 1000, marginBottom: 16 }} onFocus={selectInitialZero}>
      <h2 className="section-title">Product categories & items</h2><p className="muted">Create the selectable products used in new orders. Weight is entered in grams.</p>
      <div className="catalog-create"><label className="field">Category name<input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Example: Cakes"/></label><button type="button" className="btn" onClick={saveCategory}>{editingCategory ? "Update category" : <><Plus size={17}/>Add category</>}</button>{editingCategory && <button type="button" className="btn secondary" onClick={() => { setEditingCategory(null); setCategoryName(""); }}>Cancel</button>}</div>
      <div className="catalog-list">{categories.map(category => { const draft = itemDrafts[category.id] || blankItem(); return <article className="catalog-group" key={category.id}><header><h3>{category.name}</h3><div><button type="button" className="icon-btn" aria-label={`Edit ${category.name}`} onClick={() => { setEditingCategory(category.id); setCategoryName(category.name); }}><Pencil size={16}/></button><button type="button" className="icon-btn danger-icon" aria-label={`Delete ${category.name}`} onClick={() => setDeleteTarget({ kind: "category", id: category.id, label: category.name })}><Trash2 size={16}/></button></div></header>
        {category.items.length > 0 && <div className="catalog-rows">{category.items.map(item => <div key={item.id}><b>{item.name}</b><span>{item.unit} · {item.weight}g · LKR {item.unitPrice.toFixed(2)} · {item.discount}% off</span><div><button type="button" className="icon-btn" onClick={() => { setEditingItem({ categoryId: category.id, id: item.id }); setItemDrafts(current => ({ ...current, [category.id]: { ...item } })); }}><Pencil size={15}/></button><button type="button" className="icon-btn danger-icon" onClick={() => setDeleteTarget({ kind: "item", categoryId: category.id, id: item.id, label: item.name })}><Trash2 size={15}/></button></div></div>)}</div>}
        <div className="catalog-item-form"><label className="field">Item name<input value={draft.name} onChange={event => setItemDrafts(current => ({ ...current, [category.id]: { ...draft, name: event.target.value } }))}/></label><label className="field">Unit<select value={draft.unit} onChange={event => setItemDrafts(current => ({ ...current, [category.id]: { ...draft, unit: event.target.value } }))}><option>g</option><option>kg</option><option>pcs</option><option>pack</option><option>box</option></select></label><label className="field">Weight (g)<input type="number" min="0" value={draft.weight} onChange={event => setItemDrafts(current => ({ ...current, [category.id]: { ...draft, weight: Number(event.target.value) } }))}/></label><label className="field">Unit price (LKR)<input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={event => setItemDrafts(current => ({ ...current, [category.id]: { ...draft, unitPrice: Number(event.target.value) } }))}/></label><label className="field">Discount (%)<input type="number" min="0" max="100" value={draft.discount} onChange={event => setItemDrafts(current => ({ ...current, [category.id]: { ...draft, discount: Number(event.target.value) } }))}/></label><button type="button" className="btn secondary" onClick={() => saveItem(category.id)}>{editingItem?.categoryId === category.id ? "Update item" : "Add item"}</button></div>
      </article>; })}{!categories.length && <p className="muted">No product categories yet.</p>}</div>
    </section>

    <section className="card catalog-settings" style={{ maxWidth: 1000, marginBottom: 16 }} onFocus={selectInitialZero}>
      <h2 className="section-title">Shipping methods & weight rates</h2><p className="muted">Create courier options and prices for parcel-weight ranges in grams.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="catalog-create shipping-create"><label className="field">Shipping method<input value={shippingDraft.name} onChange={event => setShippingDraft({ ...shippingDraft, name: event.target.value })} placeholder="Example: Islandwide Delivery"/></label><label className="field">Courier / company<input value={shippingDraft.courier} onChange={event => setShippingDraft({ ...shippingDraft, courier: event.target.value })}/></label><button type="button" className="btn" onClick={saveShipping}>{editingShipping ? "Update method" : <><Plus size={17}/>Add method</>}</button></div>
      <div className="catalog-list">{shipping.map(option => { const draft = rateDrafts[option.id] || blankRate(); return <article className="catalog-group" key={option.id}><header><div><h3>{option.name}</h3><small className="muted">{option.courier || "No courier company"}</small></div><div><button type="button" className="icon-btn" onClick={() => { setEditingShipping(option.id); setShippingDraft({ ...option }); }}><Pencil size={16}/></button><button type="button" className="icon-btn danger-icon" onClick={() => setDeleteTarget({ kind: "shipping", id: option.id, label: option.name })}><Trash2 size={16}/></button></div></header>
        {option.rates.length > 0 && <div className="catalog-rows">{option.rates.map(rate => <div key={rate.id}><b>{rate.minWeight}g - {rate.maxWeight}g</b><span>LKR {rate.price.toFixed(2)}</span><div><button type="button" className="icon-btn" onClick={() => { setEditingRate({ shippingId: option.id, id: rate.id }); setRateDrafts(current => ({ ...current, [option.id]: { ...rate } })); }}><Pencil size={15}/></button><button type="button" className="icon-btn danger-icon" onClick={() => setDeleteTarget({ kind: "rate", shippingId: option.id, id: rate.id, label: `${rate.minWeight}g–${rate.maxWeight}g rate` })}><Trash2 size={15}/></button></div></div>)}</div>}
        <div className="rate-form"><label className="field">From (g)<input type="number" min="0" value={draft.minWeight} onChange={event => setRateDrafts(current => ({ ...current, [option.id]: { ...draft, minWeight: Number(event.target.value) } }))}/></label><label className="field">To (g)<input type="number" min="0" value={draft.maxWeight} onChange={event => setRateDrafts(current => ({ ...current, [option.id]: { ...draft, maxWeight: Number(event.target.value) } }))}/></label><label className="field">Price (LKR)<input type="number" min="0" step="0.01" value={draft.price} onChange={event => setRateDrafts(current => ({ ...current, [option.id]: { ...draft, price: Number(event.target.value) } }))}/></label><button type="button" className="btn secondary" onClick={() => saveRate(option.id)}>{editingRate?.shippingId === option.id ? "Update rate" : "Add rate"}</button></div>
      </article>; })}{!shipping.length && <p className="muted">No shipping methods yet.</p>}</div>
    </section>

    {deleteTarget && <div className="modal-backdrop" onMouseDown={() => setDeleteTarget(null)}><section className="card confirm-modal" onMouseDown={event => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setDeleteTarget(null)}><X size={20}/></button><Trash2 size={36} color="#dc2626"/><h2>Delete {deleteTarget.label}?</h2><p>Existing orders will keep their saved details. This option will no longer be available for new orders.</p><div className="settings-actions"><button type="button" className="btn secondary" onClick={() => setDeleteTarget(null)}>No, keep it</button><button type="button" className="btn danger" onClick={confirmDelete}>Yes, delete</button></div></section></div>}
  </>;
}
