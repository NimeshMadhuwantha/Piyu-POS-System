export type OrderStatus = "New" | "Pending" | "Confirmed" | "Processing" | "Packed" | "Shipped" | "Delivered" | "Delivery Failed" | "Cancelled" | "Canceled" | "Returned";
export type PaymentStatus = "Pending" | "Paid" | "Partially Paid";
export type ShippingMethod = "Courier Delivery" | "Parcel / Post" | "Store Pickup" | "Other";
export type PaymentMethod = "Cash on Delivery (COD)" | "Cash" | "Bank Transfer" | "Online Payment" | "Other";

export interface CustomerSnapshot {
  name: string; email?: string; mobile1: string; mobile2?: string; address1: string; address2?: string;
  city?: string; district?: string; note?: string;
}
export interface Customer extends CustomerSnapshot {
  id: string; searchTerms: string[]; orderCount?: number; lastOrderAt?: string; updatedAtClient: string;
}
export interface OrderItem {
  id: string; name: string; variant?: string; quantity: number; unit: string; weight?: number;
  unitPrice: number; discount: number; subtotal: number;
}
export interface ShippingDetails {
  method: ShippingMethod; courier?: string; trackingNumber?: string; parcelWeight?: number; note?: string;
}
export interface PaymentDetails { method: PaymentMethod; status: PaymentStatus; }
export interface Order {
  id: string; orderCode: string; customerId?: string; customer: CustomerSnapshot; items: OrderItem[];
  shipping: ShippingDetails; payment: PaymentDetails; itemsSubtotal: number; orderDiscount: number;
  deliveryCharge: number; grandTotal: number; amountPaid: number; balance: number; orderStatus: OrderStatus;
  paymentStatus: PaymentStatus; notes?: string; requestDate: string; deliveryDate?: string;
  createdBy: string; createdByName: string; updatedBy: string; createdAtClient: string; updatedAtClient: string;
  createdAtServer?: unknown; updatedAtServer?: unknown; schemaVersion: number; pending?: boolean;
}
export interface OrderLog {
  id: string; orderId: string; orderCode: string; action: string; description: string;
  previousValue?: unknown; newValue?: unknown; actorUid: string; actorName: string;
  clientTimestamp: string; serverTimestamp?: unknown; pending?: boolean;
}
export interface AppUser { uid: string; name: string; email: string; role: "admin" | "staff"; active: boolean; }
export interface BusinessSettings { businessName: string; phone: string; address: string; receiptWidth: "58mm" | "80mm" | "A4"; footer: string; }
