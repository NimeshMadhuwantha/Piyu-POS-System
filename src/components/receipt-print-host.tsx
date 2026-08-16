import { Receipt, type ReceiptType } from "./receipt";
import type { BusinessSettings, Order } from "@/types";

export function ReceiptPrintHost({ order, type, settings, printedAt }: { order: Order | null; type: ReceiptType; settings: BusinessSettings; printedAt?: string }) {
  if (!order) return null;
  return <div className="print-only receipt-print-host"><Receipt order={order} type={type} settings={settings} printedAt={printedAt}/></div>;
}
