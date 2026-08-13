"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

export function CapacityWarning({ label, count, limit = 3000 }: { label: string; count: number; limit?: number }) {
  const [closed, setClosed] = useState(false);
  if (closed || count < limit) return null;
  return <div className="capacity-warning" role="alert"><AlertTriangle size={20}/><div><b>{label} storage limit reached ({count.toLocaleString()}/{limit.toLocaleString()}).</b><br/><span>Clear old data from <Link href="/settings">Settings</Link> before adding more records.</span></div><button type="button" aria-label="Close warning" onClick={() => setClosed(true)}><X size={18}/></button></div>;
}
