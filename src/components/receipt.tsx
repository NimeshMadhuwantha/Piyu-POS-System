/* The print-only logo must load eagerly while its host is hidden. */
/* eslint-disable @next/next/no-img-element */
import { format } from "date-fns";
import { calculateLineWeight, formatLKR, orderTotalWeight } from "@/lib/calculations";
import type { BusinessSettings, Order } from "@/types";

export type ReceiptType = "customer" | "shipping" | "full";

const hasText = (value?: string) => Boolean(value?.trim());
const formatWeight = (weight: number) => `${weight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g`;
const formatAmount = (value: number) => value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Receipt({ order, type, settings, printedAt }: { order: Order; type: ReceiptType; settings: BusinessSettings; printedAt?: string }) {
  const address = [order.customer.address1, order.customer.address2, order.customer.city, order.customer.district].filter(hasText).join(", ");
  const shippingAddress = [order.customer.address1, order.customer.address2, order.customer.city].filter(hasText).join(", ");
  const totalWeight = orderTotalWeight(order);
  const paperClass = settings.receiptWidth === "A4/4" ? "A4-quarter" : settings.receiptWidth;
  const isItemList = type === "customer";

  if (type === "shipping") return <article className="receipt width-A4-quarter card receipt-shipping" style={{ fontSize: 12, color: "#000" }}>
    <ShippingBill order={order} address={shippingAddress} settings={settings}/>
  </article>;

  return <article className={`receipt width-${paperClass} card receipt-${type}`} style={{ fontSize: 12, color: "#000" }}>
    {!isItemList && <header className="receipt-header">
      <h2>{settings.businessName}</h2>
      {hasText(settings.address) && <span>{settings.address}</span>}
      {hasText(settings.phone) && <span>{settings.phone}</span>}
    </header>}

    {isItemList ? <ItemList order={order} printedAt={printedAt}/> : <>
      <div className="receipt-order-meta"><b>{order.orderCode}</b><span>{format(new Date(order.createdAtClient), "dd/MM/yyyy HH:mm")}</span></div>
      <FullBill order={order} address={address} totalWeight={totalWeight}/>
    </>}

    {!isItemList && hasText(settings.footer) && <footer className="receipt-footer">{settings.footer}</footer>}
  </article>;
}

function FullBill({ order, address, totalWeight }: { order: Order; address: string; totalWeight: number }) {
  return <>
    <section className="receipt-section receipt-customer">
      <b>{order.customer.name}</b>
      {hasText(order.customer.email) && <span>{order.customer.email}</span>}
      {hasText(order.customer.mobile1) && <span>{order.customer.mobile1}{hasText(order.customer.mobile2) && ` / ${order.customer.mobile2}`}</span>}
      {address && <span>{address}</span>}
      {hasText(order.customer.note) && <span><b>Customer note:</b> {order.customer.note}</span>}
    </section>

    <table className="receipt-items">
      <thead><tr><th>No.</th><th>Item</th><th>Weight</th><th>Price (LKR)</th></tr></thead>
      <tbody>{order.items.map((item, index) => {
        const lineWeight = calculateLineWeight(item.weight, item.quantity);
        return <tr key={item.id}>
          <td>{index + 1}</td>
          <td>{item.name}{hasText(item.variant) && ` (${item.variant})`} x {item.quantity}</td>
          <td>{lineWeight > 0 ? formatWeight(lineWeight) : ""}</td>
          <td>{formatAmount(item.subtotal)}</td>
        </tr>;
      })}</tbody>
    </table>
    {totalWeight > 0 && <div className="receipt-total-weight"><span>Net weight</span><b>{formatWeight(totalWeight)}</b></div>}

    <div className="receipt-totals">
      <span>Items subtotal</span><b>{formatAmount(order.itemsSubtotal)}</b>
      {order.orderDiscount > 0 && <><span>Discount</span><b>-{formatAmount(order.orderDiscount)}</b></>}
      {order.deliveryCharge > 0 && <><span>Delivery</span><b>{formatAmount(order.deliveryCharge)}</b></>}
      <strong>Grand total</strong><strong>{formatAmount(order.grandTotal)}</strong>
      {order.amountPaid > 0 && <><span>Paid</span><b>{formatAmount(order.amountPaid)}</b></>}
    </div>

    <section className="receipt-section receipt-extra">
      {hasText(order.payment.method) && <span><b>Payment:</b> {order.payment.method}</span>}
      {hasText(order.shipping.method) && <span><b>Shipping:</b> {order.shipping.method}{hasText(order.shipping.courier) && `, ${order.shipping.courier}`}</span>}
      {hasText(order.shipping.trackingNumber) && <span><b>Tracking:</b> {order.shipping.trackingNumber}</span>}
      {hasText(order.requestDate) && <span><b>Request date:</b> {order.requestDate}</span>}
      {hasText(order.deliveryDate) && <span><b>Delivery date:</b> {order.deliveryDate}</span>}
      {hasText(order.shipping.note) && <span><b>Shipping note:</b> {order.shipping.note}</span>}
      {hasText(order.notes) && <span><b>Notes:</b> {order.notes}</span>}
    </section>
  </>;
}

function ItemList({ order, printedAt }: { order: Order; printedAt?: string }) {
  const shortName = order.customer.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  const shortAddress = [order.customer.address1, order.customer.address2, order.customer.city]
    .filter(hasText)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const addressLine = [shortAddress, order.customer.district].filter(hasText).join(", ");
  const printTime = printedAt ? new Date(printedAt) : new Date(order.createdAtClient);
  return <>
    <div className="item-list-meta"><div className="item-list-client"><b>{order.orderCode}</b><strong>{shortName}</strong>{addressLine && <span>{addressLine}</span>}<time>Printed: {format(printTime, "dd/MM/yyyy HH:mm")}</time></div><div className="item-list-boxes"><span><b>Delivery Date :</b><i/></span><span><b>Weight :</b><i/></span></div></div>
    <table className="receipt-item-list">
      <thead><tr><th>No.</th><th>Item</th><th>Unit weight</th><th>Qty</th></tr></thead>
      <tbody>{order.items.map((item, index) => {
        const unitWeight = Math.max(0, item.weight || 0);
        return <tr key={item.id}><td>{index + 1}</td><td>{item.name}</td><td>{unitWeight > 0 ? formatWeight(unitWeight) : ""}</td><td>{item.quantity}</td></tr>;
      })}</tbody>
    </table>
    <div className="item-list-total"><span>Total price</span><b>{formatLKR(order.grandTotal)}</b></div>
  </>;
}

function ShippingBill({ order, address, settings }: { order: Order; address: string; settings: BusinessSettings }) {
  const delivery = order.deliveryConfirmation;
  const deliveryDate = order.deliveryDate || ".......................";
  const mobileNumbers = [order.customer.mobile1, order.customer.mobile2].filter(hasText).join(" / ");
  return <div className="dispatch-label">
    <section className="dispatch-notice"><h1>පිසූ ආහාර පාර්සලයකි</h1><p>විදෙස්ගතවන අයෙකුට ලැබිය යුතු පාර්සලයක් බැවින් <b>{deliveryDate}</b> දින හෝ ඉන් පෙර අනිවාර්යයෙන් බාර දෙන්න.</p></section>
    <div className="dispatch-columns">
      <section className="dispatch-sender">
        <div className="dispatch-brand"><img src="/icons/piyu%20logo.png" alt="Piyu Product logo" width="150" height="124" loading="eager" decoding="sync"/><div><h2>{settings.businessName || "Piyu Product"}</h2>{hasText(settings.address) && <p>{settings.address}</p>}{hasText(settings.phone) && <p>{settings.phone}</p>}</div></div>
        <div className="dispatch-order-id"><span>Order ID</span><strong>{order.orderCode}</strong></div>
        {delivery?.deliveryPaid && <div className="dispatch-paid-left"><b>Payment</b><strong>Deliver Paid</strong></div>}
      </section>
      <div className="dispatch-right"><div className="dispatch-values"><span><b>Weight</b>{delivery ? `${delivery.parcelWeight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g` : "-"}</span><span><b>Value</b>{delivery ? formatLKR(delivery.value) : "-"}</span></div><section className="dispatch-recipient"><small>DELIVER TO</small><h2>{order.customer.name}</h2>{address && <p className="dispatch-address">{address}</p>}{hasText(order.customer.district) && <p><b>District:</b> {order.customer.district}</p>}{mobileNumbers && <p><b>Mobile:</b> {mobileNumbers}</p>}{hasText(order.customer.email) && <p><b>Email:</b> {order.customer.email}</p>}{hasText(order.shipping.trackingNumber) && <p><b>Tracking:</b> {order.shipping.trackingNumber}</p>}{hasText(order.customer.note) && <p className="dispatch-note"><b>Client note:</b> {order.customer.note}</p>}{hasText(order.shipping.note) && <p className="dispatch-note"><b>Shipping note:</b> {order.shipping.note}</p>}</section></div>
    </div>
    {hasText(settings.footer) && <footer className="dispatch-footer">{settings.footer}</footer>}
  </div>;
}
