import { z } from "zod";
import { ORDER_PREFIXES, ORDER_SUFFIXES } from "./order-code";

const nonNegativeNumber = z.number().min(0);
export const orderItemSchema = z.object({
  id: z.string(), name: z.string().trim().min(1, "Select an item"), variant: z.string().optional(), categoryId: z.string().optional(), catalogItemId: z.string().optional(),
  quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1"), unit: z.string().min(1),
  weight: nonNegativeNumber.optional(), unitPrice: nonNegativeNumber, discount: z.number().min(0).max(100, "Discount cannot exceed 100%"), subtotal: nonNegativeNumber,
});
export const orderFormSchema = z.object({
  orderId: z.object({
    prefix: z.enum(ORDER_PREFIXES),
    number: z.string().trim().regex(/^[1-9]\d{3,}$/, "Enter at least 4 digits without a leading zero"),
    suffix: z.enum(ORDER_SUFFIXES),
  }),
  customer: z.object({
    name: z.string().trim().min(1, "Customer name is required"), email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(), mobile1: z.string().trim().min(7, "Primary mobile is required"),
    mobile2: z.string().optional(), address1: z.string().trim().min(1, "Address is required"), address2: z.string().optional(),
    city: z.string().optional(), district: z.string().optional(), note: z.string().optional(),
  }),
  items: z.array(orderItemSchema).min(1, "Add at least one item"),
  shipping: z.object({ method: z.string().trim(), methodId: z.string().optional(), courier: z.string().optional(), trackingNumber: z.string().optional(), parcelWeight: nonNegativeNumber.optional(), note: z.string().optional() }),
  payment: z.object({ method: z.enum(["Cash on Delivery (COD)", "Cash", "Bank Transfer", "Online Payment", "Other"]), status: z.enum(["Pending", "Paid", "Partially Paid"]) }),
  orderDiscount: nonNegativeNumber, deliveryCharge: nonNegativeNumber, amountPaid: nonNegativeNumber,
  notes: z.string().optional(), requestDate: z.string().min(1, "Request date is required"), deliveryDate: z.string().optional(),
});
export type OrderFormValues = z.infer<typeof orderFormSchema>;
