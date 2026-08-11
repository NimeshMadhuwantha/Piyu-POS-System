import { format } from "date-fns";
import { formatLKR } from "@/lib/calculations";
import type { BusinessSettings, Order } from "@/types";

export type ReceiptType = "customer" | "shipping" | "full";

export function Receipt({ order, type, settings }: { order: Order; type: ReceiptType; settings: BusinessSettings }) {
  const address = [order.customer.address1, order.customer.address2, order.customer.city, order.customer.district].filter(Boolean).join(", ");
  const title = type === "shipping" ? "DELIVERY DETAILS" : type === "customer" ? "CUSTOMER DETAILS & ITEMS" : "FULL BILL";

  return <article className={`receipt width-${settings.receiptWidth} card`} style={{ fontSize: 12, color: "#000" }}>
    <header style={{ textAlign: "center", borderBottom: "1px dashed #777", paddingBottom: 10, marginBottom: 10 }}>
      <h2 style={{ margin: 0 }}>{settings.businessName}</h2>
      {settings.address && <div>{settings.address}</div>}
      {settings.phone && <div>{settings.phone}</div>}
      <b>{title}</b>
    </header>
    <div><b>{order.orderCode}</b><span style={{ float: "right" }}>{format(new Date(order.createdAtClient), "dd/MM/yyyy HH:mm")}</span></div>
    <hr/>
    <h3>Customer details</h3>
    <b>{order.customer.name}</b>
    <div>{order.customer.mobile1}{order.customer.mobile2 && ` / ${order.customer.mobile2}`}</div>
    <div>{address}</div>

    {type === "shipping" ? <>
      <hr/>
      <p><b>Method:</b> {order.shipping.method}</p>
      <p><b>Courier:</b> {order.shipping.courier || "-"}</p>
      <p><b>Tracking:</b> {order.shipping.trackingNumber || "-"}</p>
      <p><b>Parcel weight:</b> {order.shipping.parcelWeight || "-"}</p>
      <p><b>Delivery date:</b> {order.deliveryDate || "Not set"}</p>
      <p style={{ fontSize: 18 }}><b>COD: {formatLKR(order.payment.method === "Cash on Delivery (COD)" ? order.balance : 0)}</b></p>
    </> : <>
      <h3>Items</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>{order.items.map(item => <tr key={item.id}><td style={{ padding: "4px 0" }}>{item.name}{item.variant && ` (${item.variant})`} x {item.quantity}</td><td style={{ textAlign: "right" }}>{formatLKR(item.subtotal)}</td></tr>)}</tbody></table>
      <hr/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4 }}>
        <span>Items subtotal</span><b>{formatLKR(order.itemsSubtotal)}</b>
        <span>Discount</span><b>-{formatLKR(order.orderDiscount)}</b>
        <span>Delivery</span><b>{formatLKR(order.deliveryCharge)}</b>
        <strong>Grand total</strong><strong>{formatLKR(order.grandTotal)}</strong>
        <span>Paid</span><b>{formatLKR(order.amountPaid)}</b>
        <span>{order.payment.method === "Cash on Delivery (COD)" ? "COD amount" : "Balance"}</span><b>{formatLKR(order.balance)}</b>
      </div>
      <hr/>
      <p><b>Payment:</b> {order.payment.method} - {order.paymentStatus}</p>
      {type === "full" && <>
        <p><b>Shipping:</b> {order.shipping.method}, {order.shipping.courier || "No courier"}</p>
        <p><b>Tracking:</b> {order.shipping.trackingNumber || "-"}</p>
        <p><b>Request date:</b> {order.requestDate} <b>Delivery date:</b> {order.deliveryDate || "-"}</p>
        <p><b>Status:</b> {order.orderStatus}</p>
        {order.notes && <p><b>Notes:</b> {order.notes}</p>}
      </>}
    </>}
    <footer style={{ textAlign: "center", borderTop: "1px dashed #777", marginTop: 12, paddingTop: 9 }}>{settings.footer}</footer>
  </article>;
}
