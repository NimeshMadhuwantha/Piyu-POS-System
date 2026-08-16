export type PrintTarget = "document" | "receipt";

export function setPrintTarget(target: PrintTarget) {
  document.body.dataset.printTarget = target;
}

export function clearPrintTarget(target: PrintTarget) {
  if (document.body.dataset.printTarget === target) delete document.body.dataset.printTarget;
}

export function openPrintDialog(): string | null {
  try {
    window.print();
    return null;
  } catch (error) {
    return error instanceof Error && error.message.includes("Browser Locker")
      ? "A browser extension blocked printing. Disable Browser Locker for this site, then try again."
      : "The browser could not open the print screen. Check browser permissions and try again.";
  }
}
