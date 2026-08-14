import { format } from "date-fns";
import { calculateLineWeight, formatLKR, orderTotalWeight } from "@/lib/calculations";
import type { BusinessSettings, Order } from "@/types";
import { primaryOrderStatus } from "@/lib/order-status";

export type ReceiptType = "customer" | "shipping" | "full";

const hasText = (value?: string) => Boolean(value?.trim());
const formatWeight = (weight: number) => `${weight.toLocaleString("en-LK", { maximumFractionDigits: 2 })} g`;

export function Receipt({ order, type, settings }: { order: Order; type: ReceiptType; settings: BusinessSettings }) {
  const address = [order.customer.address1, order.customer.address2, order.customer.city, order.customer.district].filter(hasText).join(", ");
  const totalQuantity = order.items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0);
  const totalWeight = orderTotalWeight(order);
  const paperClass = settings.receiptWidth === "A4/4" ? "A4-quarter" : settings.receiptWidth;
  const isItemList = type === "customer";

  return <article className={`receipt width-${paperClass} card receipt-${type}`} style={{ fontSize: 12, color: "#000" }}>
    {!isItemList && <header className="receipt-header">
      <h2>{settings.businessName}</h2>
      {hasText(settings.address) && <span>{settings.address}</span>}
      {hasText(settings.phone) && <span>{settings.phone}</span>}
    </header>}

    {isItemList ? <ItemList order={order}/> : <>
      <div className="receipt-order-meta"><b>{order.orderCode}</b><span>{format(new Date(order.createdAtClient), "dd/MM/yyyy HH:mm")}</span></div>
      {type === "shipping" ? <ShippingBill order={order} address={address} totalQuantity={totalQuantity} totalWeight={totalWeight}/> : <FullBill order={order} address={address} totalWeight={totalWeight}/>}
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
      <thead><tr><th>Item</th><th>Weight</th><th>Price</th></tr></thead>
      <tbody>{order.items.map(item => {
        const lineWeight = calculateLineWeight(item.weight, item.quantity);
        return <tr key={item.id}>
          <td>{item.name}{hasText(item.variant) && ` (${item.variant})`} x {item.quantity}</td>
          <td>{lineWeight > 0 ? formatWeight(lineWeight) : ""}</td>
          <td>{formatLKR(item.subtotal)}</td>
        </tr>;
      })}</tbody>
    </table>
    {totalWeight > 0 && <div className="receipt-total-weight"><span>Total weight</span><b>{formatWeight(totalWeight)}</b></div>}

    <div className="receipt-totals">
      <span>Items subtotal</span><b>{formatLKR(order.itemsSubtotal)}</b>
      {order.orderDiscount > 0 && <><span>Discount</span><b>-{formatLKR(order.orderDiscount)}</b></>}
      {order.deliveryCharge > 0 && <><span>Delivery</span><b>{formatLKR(order.deliveryCharge)}</b></>}
      <strong>Grand total</strong><strong>{formatLKR(order.grandTotal)}</strong>
      {order.amountPaid > 0 && <><span>Paid</span><b>{formatLKR(order.amountPaid)}</b></>}
    </div>

    <section className="receipt-section receipt-extra">
      {hasText(order.payment.method) && <span><b>Payment:</b> {order.payment.method}{hasText(order.paymentStatus) && ` - ${order.paymentStatus}`}</span>}
      {hasText(order.shipping.method) && <span><b>Shipping:</b> {order.shipping.method}{hasText(order.shipping.courier) && `, ${order.shipping.courier}`}</span>}
      {hasText(order.shipping.trackingNumber) && <span><b>Tracking:</b> {order.shipping.trackingNumber}</span>}
      {hasText(order.requestDate) && <span><b>Request date:</b> {order.requestDate}</span>}
      {hasText(order.deliveryDate) && <span><b>Delivery date:</b> {order.deliveryDate}</span>}
      <span><b>Status:</b> {primaryOrderStatus(order.orderStatus)}</span>
      {hasText(order.shipping.note) && <span><b>Shipping note:</b> {order.shipping.note}</span>}
      {hasText(order.notes) && <span><b>Notes:</b> {order.notes}</span>}
    </section>
  </>;
}

function ItemList({ order }: { order: Order }) {
  return <>
    <div className="item-list-meta"><b>{order.orderCode}</b><span>{order.customer.name}</span></div>
    <table className="receipt-item-list">
      <thead><tr><th>Item</th><th>Weight</th><th>Qty</th></tr></thead>
      <tbody>{order.items.map(item => {
        const unitWeight = Math.max(0, item.weight || 0);
        return <tr key={item.id}><td>{item.name}</td><td>{unitWeight > 0 ? formatWeight(unitWeight) : ""}</td><td>{item.quantity}</td></tr>;
      })}</tbody>
    </table>
    <div className="item-list-total"><span>Total price</span><b>{formatLKR(order.grandTotal)}</b></div>
  </>;
}

function ShippingBill({ order, address, totalQuantity, totalWeight }: { order: Order; address: string; totalQuantity: number; totalWeight: number }) {
  return <>
    <section className="receipt-section shipping-recipient">
      <b>{order.customer.name}</b>
      {address && <span>{address}</span>}
      {hasText(order.customer.mobile1) && <span><b>Contact:</b> {order.customer.mobile1}{hasText(order.customer.mobile2) && ` / ${order.customer.mobile2}`}</span>}
      {hasText(order.customer.email) && <span>{order.customer.email}</span>}
    </section>
    <div className="shipping-bill-summary">
      {hasText(order.shipping.method) && <><span>Shipping option</span><b>{order.shipping.method}</b></>}
      {hasText(order.shipping.courier) && <><span>Courier / company</span><b>{order.shipping.courier}</b></>}
      {hasText(order.shipping.trackingNumber) && <><span>Tracking</span><b>{order.shipping.trackingNumber}</b></>}
      <span>Total items</span><b>{totalQuantity}</b>
      {totalWeight > 0 && <><span>Total weight</span><b>{formatWeight(totalWeight)}</b></>}
      {order.deliveryCharge > 0 && <><span>Shipping charge</span><b>{formatLKR(order.deliveryCharge)}</b></>}
      <strong>Total price</strong><strong>{formatLKR(order.grandTotal)}</strong>
      {hasText(order.requestDate) && <><span>Request date</span><b>{order.requestDate}</b></>}
      {hasText(order.deliveryDate) && <><span>Delivery date</span><b>{order.deliveryDate}</b></>}
    </div>
    {hasText(order.shipping.note) && <section className="receipt-section receipt-note"><b>Shipping note:</b> {order.shipping.note}</section>}
  </>;
}
