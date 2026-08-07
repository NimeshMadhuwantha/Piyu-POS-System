import { z } from "zod";

const nonNegativeNumber = z.number().min(0);
export const orderItemSchema = z.object({
  id: z.string(), name: z.string().trim().min(1, "Item name is required"), variant: z.string().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1"), unit: z.string().min(1),
  weight: nonNegativeNumber.optional(), unitPrice: nonNegativeNumber, discount: nonNegativeNumber, subtotal: nonNegativeNumber,
});
export const orderFormSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, "Customer name is required"), mobile1: z.string().trim().min(7, "Primary mobile is required"),
    mobile2: z.string().optional(), address1: z.string().trim().min(1, "Address is required"), address2: z.string().optional(),
    city: z.string().optional(), district: z.string().optional(), note: z.string().optional(),
  }),
  items: z.array(orderItemSchema).min(1, "Add at least one item"),
  shipping: z.object({ method: z.enum(["Courier Delivery", "Parcel / Post", "Store Pickup", "Other"]), courier: z.string().optional(), trackingNumber: z.string().optional(), parcelWeight: nonNegativeNumber.optional(), note: z.string().optional() }),
  payment: z.object({ method: z.enum(["Cash on Delivery (COD)", "Cash", "Bank Transfer", "Online Payment", "Other"]), status: z.enum(["Pending", "Paid", "Partially Paid"]) }),
  orderDiscount: nonNegativeNumber, deliveryCharge: nonNegativeNumber, amountPaid: nonNegativeNumber,
  notes: z.string().optional(), requestDate: z.string().min(1, "Request date is required"), deliveryDate: z.string().optional(),
});
export type OrderFormValues = z.infer<typeof orderFormSchema>;
