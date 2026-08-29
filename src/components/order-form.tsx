"use client";
/* React Hook Form watch() is intentionally reactive; React Compiler skips this form. */
/* eslint-disable react-hooks/incompatible-library */

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { orderFormSchema, type OrderFormValues } from "@/lib/validation";
import { calculateItemsWeight, calculateLineSubtotal, calculateTotals, effectiveShippingCharge, formatItemDiscount, formatLKR } from "@/lib/calculations";
import { formatOrderCode, nextOrderNumber, orderMiddleNumber, ORDER_PREFIXES, ORDER_SUFFIXES, parseOrderCode } from "@/lib/order-code";
import { saveOrder, subscribeBusinessSettings } from "@/lib/repositories";
import { useApp } from "@/components/providers";
import { useCustomers, useOrders } from "@/hooks/use-data";
import type { BusinessSettings, CatalogItem, Order, OrderItem, ProductCategory } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);
const newItem = (): OrderItem => ({ id: crypto.randomUUID(), name: "", variant: "", categoryId: "", catalogItemId: "", quantity: 1, unit: "pcs", weight: 0, unitPrice: 0, discount: 0, discountType: "percent", subtotal: 0 });
const editableItems = (order: Order) => order.schemaVersion >= 2 ? order.items.map(item => ({ ...item, discountType: item.discountType || "percent" as const })) : order.items.map(item => ({ ...item, discountType: "percent" as const, discount: item.quantity * item.unitPrice > 0 ? Math.min(100, item.discount / (item.quantity * item.unitPrice) * 100) : 0 }));
const emptySettings: BusinessSettings = { businessName: "Piyu POS", phone: "", address: "", receiptWidth: "80mm", footer: "Thank you!", productCategories: [], shippingOptions: [] };

export function OrderForm({ existing }: { existing?: Order }) {
  const { user } = useApp();
  const customers = useCustomers();
  const { orders, loading: ordersLoading } = useOrders();
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [numberEdited, setNumberEdited] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>(emptySettings);
  useEffect(() => subscribeBusinessSettings(setSettings), []);

  const savedOrderId = existing ? parseOrderCode(existing.orderCode) : null;
  const defaultOrderId = savedOrderId || { prefix: "FC" as const, number: existing?.orderNumber || "3884", suffix: "A" as const };
  const defaults: OrderFormValues = existing ? { orderId: defaultOrderId, customer: { ...existing.customer, whatsappNumber: existing.customer.whatsappNumber || "" }, items: editableItems(existing), shipping: existing.shipping, payment: existing.payment, orderDiscount: existing.orderDiscount, deliveryCharge: existing.deliveryCharge, amountPaid: existing.amountPaid, notes: existing.notes || "", requestDate: existing.requestDate, deliveryDate: existing.deliveryDate || "" } : { orderId: defaultOrderId, customer: { name: "", email: "", mobile1: "", mobile2: "", whatsappNumber: "", address1: "", address2: "", city: "", district: "", note: "" }, items: [newItem()], shipping: { method: "", methodId: "", courier: "", trackingNumber: "", parcelWeight: 0, note: "" }, payment: { method: "Cash on Delivery (COD)", status: "Pending" }, orderDiscount: 0, deliveryCharge: 0, amountPaid: 0, notes: "", requestDate: today(), deliveryDate: "" };
  const { register, control, handleSubmit, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<OrderFormValues>({ resolver: zodResolver(orderFormSchema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const values = watch();
  const categories = settings.productCategories || [];
  const shippingOptions = settings.shippingOptions || [];
  const totalWeight = calculateItemsWeight(values.items || []);
  const selectedShipping = shippingOptions.find(option => option.id === values.shipping?.methodId);
  const isCashOnDelivery = values.payment?.method === "Cash on Delivery (COD)";
  const deliveryCharge = effectiveShippingCharge(values.payment?.method, Number(values.deliveryCharge) || 0);
  const totals = calculateTotals(values.items || [], 0, deliveryCharge, values.amountPaid, values.payment?.method);
  const enteredOrderNumber = values.orderId?.number?.trim() || "";
  const duplicateOrderNumber = !existing && /^[1-9]\d{3,}$/.test(enteredOrderNumber) && orders.some(order => orderMiddleNumber(order) === enteredOrderNumber);

  useEffect(() => {
    if (existing || ordersLoading || numberEdited) return;
    setValue("orderId.number", nextOrderNumber(orders), { shouldValidate: true });
  }, [existing, numberEdited, orders, ordersLoading, setValue]);

  useEffect(() => {
    if (duplicateOrderNumber) setError("orderId.number", { type: "validate", message: "This middle number is already used by another order" });
    else if (errors.orderId?.number?.type === "validate") clearErrors("orderId.number");
  }, [clearErrors, duplicateOrderNumber, errors.orderId?.number?.type, setError]);

  function matchCustomer(mobile: string) {
    const customer = customers.find(item => item.mobile1 === mobile || item.mobile2 === mobile);
    if (customer) (["name", "email", "mobile1", "mobile2", "whatsappNumber", "address1", "address2", "city", "district", "note"] as const).forEach(key => setValue(`customer.${key}`, customer[key] || ""));
  }
  function chooseCategory(index: number, categoryId: string) {
    const item = newItem();
    setValue(`items.${index}`, { ...item, id: values.items[index]?.id || item.id, categoryId });
  }
  function chooseItem(index: number, category: ProductCategory | undefined, itemId: string) {
    const item = category?.items.find(product => product.id === itemId);
    if (!item) return;
    const quantity = values.items[index]?.quantity || 1;
    setValue(`items.${index}`, { id: values.items[index]?.id || crypto.randomUUID(), categoryId: category?.id, catalogItemId: item.id, name: item.name, variant: category?.name || "", quantity, unit: item.unit, weight: item.weight, unitPrice: item.unitPrice, discount: item.discount, discountType: "percent", subtotal: calculateLineSubtotal(quantity, item.unitPrice, item.discount) });
  }
  function chooseShipping(methodId: string) {
    const option = shippingOptions.find(item => item.id === methodId);
    setValue("shipping.methodId", methodId);
    setValue("shipping.method", option?.name || "");
    setValue("shipping.courier", option?.courier || "");
  }
  function itemOptions(index: number): CatalogItem[] { return categories.find(category => category.id === values.items?.[index]?.categoryId)?.items || []; }

  function submit(data: OrderFormValues) {
    if (!user) return;
    setSubmitError("");
    if (!existing && orders.some(order => orderMiddleNumber(order) === data.orderId.number)) {
      setError("orderId.number", { type: "validate", message: "This middle number is already used by another order" });
      return;
    }
    try {
      const now = new Date().toISOString();
      const calculated = calculateTotals(data.items, 0, deliveryCharge, data.amountPaid, data.payment.method);
      const id = existing?.id || crypto.randomUUID();
      const orderCode = formatOrderCode(data.orderId.prefix, data.orderId.number, data.orderId.suffix);
      const order: Order = { id, orderCode, orderPrefix: data.orderId.prefix, orderNumber: existing?.orderNumber || data.orderId.number, orderSuffix: data.orderId.suffix, customerId: existing?.customerId, customer: data.customer, items: data.items.map(item => ({ ...item, discountType: item.discountType || "percent", subtotal: calculateLineSubtotal(item.quantity, item.unitPrice, item.discount, item.discountType) })), shipping: { ...data.shipping, method: selectedShipping?.name || data.shipping.method, methodId: selectedShipping?.id || data.shipping.methodId, courier: selectedShipping?.courier || data.shipping.courier, parcelWeight: totalWeight }, payment: { ...data.payment, status: calculated.balance === 0 ? "Paid" : calculated.amountPaid > 0 ? "Partially Paid" : "Pending" }, itemsSubtotal: calculated.itemsSubtotal, orderDiscount: 0, deliveryCharge, grandTotal: calculated.grandTotal, amountPaid: calculated.amountPaid, balance: calculated.balance, orderStatus: existing?.orderStatus || "Pending", paymentStatus: calculated.balance === 0 ? "Paid" : calculated.amountPaid > 0 ? "Partially Paid" : "Pending", notes: data.notes, requestDate: data.requestDate, deliveryDate: data.deliveryDate, createdBy: existing?.createdBy || user.uid, createdByName: existing?.createdByName || user.name, updatedBy: user.uid, createdAtClient: existing?.createdAtClient || now, updatedAtClient: now, schemaVersion: 5 };
      const customerId = saveOrder(order, user, existing); if (!existing) order.customerId = customerId; router.push(`/orders/${id}`);
    } catch (caught) { setSubmitError(caught instanceof Error ? caught.message : "Unable to save order"); }
  }

  return <form onSubmit={handleSubmit(submit)} className="order-form">
    <section className="card order-id-card"><h2 className="section-title">A. Order ID</h2><div className="order-id-row"><label className="field">Type<select {...register("orderId.prefix")}>{ORDER_PREFIXES.map(prefix => <option key={prefix}>{prefix}</option>)}</select></label><label className="field order-number-field">Number<input type="text" inputMode="numeric" autoComplete="off" readOnly={Boolean(existing)} {...register("orderId.number", { onChange: () => setNumberEdited(true) })}/></label><label className="field">Series<select {...register("orderId.suffix")}>{ORDER_SUFFIXES.map(suffix => <option key={suffix}>{suffix}</option>)}</select></label></div><small className={errors.orderId?.number ? "field-error" : "muted"}>{errors.orderId?.number?.message || `Order ID: ${values.orderId?.prefix || "FC"}${enteredOrderNumber}${values.orderId?.suffix || "A"}`}</small></section>

    <section className="card"><h2 className="section-title">B. Client details</h2><div className="grid-fields"><label className="field">Customer name *<input {...register("customer.name")}/><small className="field-error">{errors.customer?.name?.message}</small></label><label className="field">Email (optional)<input type="email" autoComplete="email" {...register("customer.email")}/><small className="field-error">{errors.customer?.email?.message}</small></label><label className="field">Primary mobile number *<input list="customer-mobiles" inputMode="tel" {...register("customer.mobile1")} onBlur={event => matchCustomer(event.target.value)}/><datalist id="customer-mobiles">{customers.map(customer => <option key={customer.id} value={customer.mobile1}>{customer.name}</option>)}</datalist><small className="field-error">{errors.customer?.mobile1?.message}</small></label><label className="field">Secondary mobile number (optional)<input inputMode="tel" {...register("customer.mobile2")}/></label><label className="field">WhatsApp number (optional)<input inputMode="tel" {...register("customer.whatsappNumber")}/></label><label className="field">Address line 1 *<input {...register("customer.address1")}/><small className="field-error">{errors.customer?.address1?.message}</small></label><label className="field">Address line 2<input {...register("customer.address2")}/></label><label className="field">City<input {...register("customer.city")}/></label><label className="field">District<input {...register("customer.district")}/></label><label className="field">Customer note<textarea {...register("customer.note")}/></label></div></section>

    <section className="card"><h2 className="section-title">C. Order items</h2>{!categories.length && <p className="catalog-notice">No products are configured. Add categories and items in Settings first.</p>}{errors.items?.message && <p className="field-error">{errors.items.message}</p>}<div className="order-item-list">{fields.map((field, index) => { const current = values.items?.[index]; const category = categories.find(item => item.id === current?.categoryId); const options = itemOptions(index); return <article className="order-item" key={field.id}><header><b>Item {index + 1}</b>{fields.length > 1 && <button type="button" className="btn danger compact-btn" onClick={() => remove(index)}><Trash2 size={15}/></button>}</header><div className="order-item-fields"><label className="field">Category *<select value={current?.categoryId || ""} onChange={event => chooseCategory(index, event.target.value)}><option value="">Select category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Item *<select value={current?.catalogItemId || ""} disabled={!category} onChange={event => chooseItem(index, category, event.target.value)}><option value="">Select item</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{existing && current?.name && !current.catalogItemId && <option value="" disabled>Saved: {current.name}</option>}</select></label><label className="field quantity-field">Quantity<div className="quantity-control"><button type="button" aria-label={`Decrease item ${index + 1} quantity`} onClick={() => setValue(`items.${index}.quantity`, Math.max(1, (current?.quantity || 1) - 1), { shouldDirty: true, shouldValidate: true })}>−</button><input type="number" min="1" step="1" inputMode="numeric" {...register(`items.${index}.quantity`, { valueAsNumber: true })}/><button type="button" aria-label={`Increase item ${index + 1} quantity`} onClick={() => setValue(`items.${index}.quantity`, (current?.quantity || 0) + 1, { shouldDirty: true, shouldValidate: true })}>+</button></div></label><label className="field item-discount-field">Discount<div className="discount-control"><input className="number-clean" type="number" min="0" max={(current?.discountType || "percent") === "percent" ? 100 : undefined} step="any" inputMode="decimal" {...register(`items.${index}.discount`, { setValueAs: value => value === "" ? 0 : Number(value) })}/><select aria-label={`Item ${index + 1} discount type`} {...register(`items.${index}.discountType`)}><option value="percent">%</option><option value="amount">LKR</option></select></div><small className="field-error">{errors.items?.[index]?.discount?.message}</small></label><div className="item-summary"><span>Unit <b>{current?.unit || "-"}</b></span><span>Weight <b>{current?.weight || 0}g each</b></span><span>Price <b>{formatLKR(current?.unitPrice || 0)}</b></span><span>Discount <b>{formatItemDiscount({ discount: current?.discount || 0, discountType: current?.discountType })}</b></span><span>Line total <b>{formatLKR(calculateLineSubtotal(current?.quantity || 0, current?.unitPrice || 0, current?.discount || 0, current?.discountType))}</b></span></div></div></article>; })}</div><button type="button" className="btn secondary add-item-bottom" onClick={() => append(newItem())}><Plus size={17}/>Add item</button><div className="total-weight">Total item weight <b>{totalWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</b></div></section>

    <section className="card">
      <h2 className="section-title">D. Shipping & payment</h2>
      {!shippingOptions.length && <p className="catalog-notice">No shipping methods are configured. Add shipping methods and courier companies in Settings first.</p>}
      <div className="grid-fields">
        <label className="field payment-method-field">Payment method<select {...register("payment.method")}><option>Cash on Delivery (COD)</option><option>Cash</option><option>Bank Transfer</option><option>Online Payment</option><option>Other</option></select></label>
        <label className="field">Shipping method (optional)<select value={values.shipping?.methodId || ""} onChange={event => chooseShipping(event.target.value)}><option value="">No shipping method</option>{shippingOptions.map(option => <option key={option.id} value={option.id}>{option.name}{option.courier ? ` - ${option.courier}` : ""}</option>)}{existing && values.shipping?.method && !values.shipping.methodId && <option value="" disabled>Saved: {values.shipping.method}</option>}</select></label>
        {!isCashOnDelivery && <label className="field">Shipping cost (LKR)<input className="number-clean" type="number" inputMode="decimal" min="0" step="0.01" {...register("deliveryCharge", { setValueAs: value => value === "" ? 0 : Number(value) })}/></label>}
        <label className="field">Request date<input type="date" {...register("requestDate")}/></label>
        <label className="field">Delivery date<input type="date" {...register("deliveryDate")}/></label>
        <label className="field">Tracking number<input {...register("shipping.trackingNumber")}/></label>
        <label className="field">Amount paid<input className="number-clean" type="number" inputMode="decimal" min="0" step="any" {...register("amountPaid", { valueAsNumber: true })}/></label>
        <label className="field">Shipping note<textarea {...register("shipping.note")}/></label>
        <label className="field">Order notes<textarea {...register("notes")}/></label>
      </div>
    </section>

    <section className="card order-totals"><div className="order-totals-content"><span>Subtotal <b>{formatLKR(totals.itemsSubtotal)}</b></span><span>Shipping <b>{formatLKR(deliveryCharge)}</b></span><span>Grand total <b className="order-grand-total">{formatLKR(totals.grandTotal)}</b></span><span>Net weight <b>{totalWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g</b></span><button className="btn" disabled={isSubmitting || duplicateOrderNumber}><Save size={18}/>{isSubmitting ? "Saving…" : existing ? "Update order" : "Save order"}</button></div>{submitError && <p className="form-error order-error">{submitError}</p>}</section>
  </form>;
}
