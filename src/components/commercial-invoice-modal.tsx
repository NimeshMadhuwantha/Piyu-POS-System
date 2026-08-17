"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, FileDown, Italic, X } from "lucide-react";
import { createCommercialInvoicePdf } from "@/lib/commercial-invoice";
import { saveCommercialInvoiceDetails } from "@/lib/repositories";
import { updateCachedCommercialInvoice } from "@/hooks/use-data";
import { useApp } from "@/components/providers";
import type { BusinessSettings, CommercialInvoiceDetails, Order } from "@/types";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function sanitizeDescriptionHtml(root: HTMLElement) {
  const sanitize = (node: Node): string => {
    if (node.nodeType === 3) return escapeHtml(node.textContent || "");
    if (node.nodeType !== 1) return "";
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return "";
    if (tag === "br") return "<br>";
    const content = Array.from(element.childNodes, sanitize).join("");
    const weight = element.style.fontWeight;
    const bold = tag === "b" || tag === "strong" || weight === "bold" || Number(weight) >= 600;
    const italic = tag === "i" || tag === "em" || element.style.fontStyle === "italic";
    const formatted = `${bold ? "<b>" : ""}${italic ? "<i>" : ""}${content}${italic ? "</i>" : ""}${bold ? "</b>" : ""}`;
    return tag === "div" || tag === "p" ? `<div>${formatted}</div>` : formatted;
  };
  return Array.from(root.childNodes, sanitize).join("");
}

export function CommercialInvoiceModal({ order, settings, onClose }: { order: Order; settings: BusinessSettings; onClose: () => void }) {
  const { user } = useApp();
  const saved = order.commercialInvoice;
  const [countryAndZip, setCountryAndZip] = useState(saved?.countryAndZip || "");
  const [description, setDescription] = useState(saved?.description || "");
  const [descriptionHtml, setDescriptionHtml] = useState(saved?.descriptionHtml || "");
  const [descriptionBold, setDescriptionBold] = useState(false);
  const [descriptionItalic, setDescriptionItalic] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(String(saved?.totalQuantity || order.items.reduce((sum, item) => sum + item.quantity, 0)));
  const [totalNetWeight, setTotalNetWeight] = useState(saved?.totalNetWeight || "");
  const [totalGrossWeight, setTotalGrossWeight] = useState(saved?.totalGrossWeight || "");
  const [boxDimensions, setBoxDimensions] = useState(saved?.boxDimensions || "");
  const [shippingCharges, setShippingCharges] = useState(saved ? String(saved.shippingCharges) : order.deliveryCharge > 0 ? String(order.deliveryCharge) : "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const descriptionEditor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = descriptionEditor.current;
    if (!editor) return;
    if (saved?.descriptionHtml) {
      const temporary = document.createElement("div");
      temporary.innerHTML = saved.descriptionHtml;
      editor.innerHTML = sanitizeDescriptionHtml(temporary);
      setDescriptionHtml(editor.innerHTML);
    } else editor.textContent = saved?.description || "";
  }, [saved?.description, saved?.descriptionHtml]);

  function updateFormatState() {
    setDescriptionBold(document.queryCommandState("bold"));
    setDescriptionItalic(document.queryCommandState("italic"));
  }

  function toggleDescriptionFormat(command: "bold" | "italic") {
    descriptionEditor.current?.focus();
    document.execCommand(command);
    updateFormatState();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const quantity = Number(totalQuantity);
    const shipping = shippingCharges.trim() === "" ? 0 : Number(shippingCharges);
    if (!description.trim()) { setError("Enter a description of goods."); return; }
    if (!Number.isInteger(quantity) || quantity <= 0) { setError("Total quantity must be a whole number greater than zero."); return; }
    if (!Number.isFinite(shipping) || shipping < 0) { setError("Enter a valid shipping charge."); return; }
    if (!user) { setError("You must be signed in to save invoice details."); return; }
    setCreating(true);
    setError("");
    try {
      const commercialInvoice: CommercialInvoiceDetails = {
        countryAndZip: countryAndZip.trim(),
        description: description.trim(),
        descriptionHtml,
        descriptionBold: false,
        descriptionItalic: false,
        totalQuantity: quantity,
        totalNetWeight: totalNetWeight.trim(),
        totalGrossWeight: totalGrossWeight.trim(),
        boxDimensions: boxDimensions.trim(),
        shippingCharges: shipping,
      };
      const { updatedAtClient } = saveCommercialInvoiceDetails(order, commercialInvoice, user);
      updateCachedCommercialInvoice(order.id, commercialInvoice, updatedAtClient);
      await createCommercialInvoicePdf(order, settings, commercialInvoice);
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
        <label className="field commercial-full">Client ZIP/postal code and country *<input required value={countryAndZip} placeholder="e.g. 194-556, Japan" onChange={event => setCountryAndZip(event.target.value)}/></label>
        <div className="field commercial-full">
          <span>Description of goods *</span>
          <div className="description-toolbar" aria-label="Description formatting">
            <button type="button" className={descriptionBold ? "active" : ""} aria-pressed={descriptionBold} onMouseDown={event => { event.preventDefault(); toggleDescriptionFormat("bold"); }}><Bold size={16}/>Bold</button>
            <button type="button" className={descriptionItalic ? "active" : ""} aria-pressed={descriptionItalic} onMouseDown={event => { event.preventDefault(); toggleDescriptionFormat("italic"); }}><Italic size={16}/>Italic</button>
          </div>
          <div ref={descriptionEditor} className="description-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="Describe the goods included in this shipment" suppressContentEditableWarning onInput={event => { setDescription(event.currentTarget.innerText); setDescriptionHtml(sanitizeDescriptionHtml(event.currentTarget)); updateFormatState(); }} onKeyUp={updateFormatState} onMouseUp={updateFormatState}/>
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
