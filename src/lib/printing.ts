export type PrintTarget = "document" | "receipt";

export function setPrintTarget(target: PrintTarget) {
  document.body.dataset.printTarget = target;
}

export function clearPrintTarget(target: PrintTarget) {
  if (document.body.dataset.printTarget === target) delete document.body.dataset.printTarget;
}

export async function waitForPrintAssets(): Promise<void> {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".receipt-print-host img"));
  await Promise.all(images.map(image => {
    if (image.complete && image.naturalWidth > 0) {
      return image.decode?.().catch(() => undefined) ?? Promise.resolve();
    }

    return new Promise<void>(resolve => {
      const finish = () => {
        window.clearTimeout(timeout);
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      const timeout = window.setTimeout(finish, 3000);
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
  }));

  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
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
