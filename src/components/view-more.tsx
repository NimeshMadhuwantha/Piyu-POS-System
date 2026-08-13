"use client";

export const RECORD_PAGE_SIZE = 100;

export function ViewMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  const next = Math.min(RECORD_PAGE_SIZE, total - shown);
  return <div className="view-more"><span className="muted">Showing {shown.toLocaleString()} of {total.toLocaleString()}</span><button type="button" onClick={onMore}>View {next.toLocaleString()} more</button></div>;
}
