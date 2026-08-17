"use client";

import { useState } from "react";
import { Bold, FileDown, Italic, X } from "lucide-react";
import { createCommercialInvoicePdf } from "@/lib/commercial-invoice";
import type { BusinessSettings, Order } from "@/types";

export function CommercialInvoiceModal({ order, settings, onClose }: { order: Order; settings: BusinessSettings; onClose: () => void }) {
  const [countryAndZip, setCountryAndZip] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionBold, setDescriptionBold] = useState(false);
  const [descriptionItalic, setDescriptionItalic] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(String(order.items.reduce((sum, item) => sum + item.quantity, 0)));
  const [totalNetWeight, setTotalNetWeight] = useState("");
  const [totalGrossWeight, setTotalGrossWeight] = useState("");
  const [boxDimensions, setBoxDimensions] = useState("");
  const [shippingCharges, setShippingCharges] = useState(order.deliveryCharge > 0 ? String(order.deliveryCharge) : "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(totalQuantity);
    const shipping = shippingCharges.trim() === "" ? 0 : Number(shippingCharges);
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("Total quantity must be a whole number greater than zero."); return; }
    if (!Number.isFinite(shipping) || shipping < 0) { setError("Enter a valid shipping charge."); return; }
    setCreating(true);
    setError("");
    try {
      await createCommercialInvoicePdf(order, settings, {
        countryAndZip: countryAndZip.trim(),
        description: description.trim(),
        descriptionBold,
        descriptionItalic,
        totalQuantity: quantity,
        totalNetWeight: totalNetWeight.trim(),
        totalGrossWeight: totalGrossWeight.trim(),
        boxDimensions: boxDimensions.trim(),
        shippingCharges: shipping,
      });
      onClose();
    } catch (caught) {
      console.error("Unable to create commercial invoice", caught);
      setError("The invoice could not be created. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return <div className="modal-backdrop no-print commercial-invoice-backdrop" role="presentation" onMouseDown={() => !creating && onClose()}>
    <form className="card confirm-modal commercial-invoice-modal" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
      <button className="modal-close" type="button" aria-label="Close" disabled={creating} onClick={onClose}><X size={20}/></button>
      <div className="commercial-invoice-heading"><FileDown size={30}/><div><h2>Create Commercial Invoice</h2><p>{order.orderCode} · {order.customer.name}</p></div></div>
      <div className="commercial-invoice-fields">
        <label className="field commercial-full">Client country with ZIP/postal code *<input required value={countryAndZip} placeholder="e.g. Australia 2000" onChange={event => setCountryAndZip(event.target.value)}/></label>
        <div className="field commercial-full">
          <span>Description of goods *</span>
          <div className="description-toolbar" aria-label="Description formatting">
            <button type="button" className={descriptionBold ? "active" : ""} aria-pressed={descriptionBold} onClick={() => setDescriptionBold(value => !value)}><Bold size={16}/>Bold</button>
            <button type="button" className={descriptionItalic ? "active" : ""} aria-pressed={descriptionItalic} onClick={() => setDescriptionItalic(value => !value)}><Italic size={16}/>Italic</button>
          </div>
          <textarea required rows={4} value={description} style={{ fontWeight: descriptionBold ? 700 : 400, fontStyle: descriptionItalic ? "italic" : "normal" }} placeholder="Describe the goods included in this shipment" onChange={event => setDescription(event.target.value)}/>
        </div>
        <label className="field">Total quantity *<input required type="number" min="1" step="1" inputMode="numeric" value={totalQuantity} onChange={event => setTotalQuantity(event.target.value)}/></label>
        <label className="field">Total net weight *<input required value={totalNetWeight} placeholder="e.g. 8.50 kg" onChange={event => setTotalNetWeight(event.target.value)}/></label>
        <label className="field">Total gross weight *<input required value={totalGrossWeight} placeholder="e.g. 9.20 kg" onChange={event => setTotalGrossWeight(event.target.value)}/></label>
        <label className="field">Box dimensions (L × W × H) *<input required value={boxDimensions} placeholder="e.g. 40 × 30 × 25 cm" onChange={event => setBoxDimensions(event.target.value)}/></label>
        <label className="field commercial-full">Shipping charges (LKR)<input type="number" min="0" step="0.01" inputMode="decimal" value={shippingCharges} placeholder="0.00" onChange={event => setShippingCharges(event.target.value)}/></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="settings-actions commercial-invoice-actions"><button className="btn secondary" type="button" disabled={creating} onClick={onClose}>Cancel</button><button className="btn commercial-create-button" disabled={creating}><FileDown size={17}/>{creating ? "Creating…" : "Download A4 Invoice"}</button></div>
    </form>
  </div>;
}
