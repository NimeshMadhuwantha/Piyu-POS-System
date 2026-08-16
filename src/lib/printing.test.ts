import { afterEach, describe, expect, it, vi } from "vitest";
import { openPrintDialog } from "./printing";

describe("openPrintDialog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the browser print dialog without reporting an error", () => {
    const print = vi.fn();
    vi.stubGlobal("window", { print });

    expect(openPrintDialog()).toBeNull();
    expect(print).toHaveBeenCalledOnce();
  });

  it("returns a useful message when Browser Locker blocks printing", () => {
    vi.stubGlobal("window", { print: () => { throw new Error("Breaking Browser Locker Behavior detected"); } });

    expect(openPrintDialog()).toContain("Browser Locker");
  });

  it("returns a generic message for other browser print failures", () => {
    vi.stubGlobal("window", { print: () => { throw new Error("Print unavailable"); } });

    expect(openPrintDialog()).toContain("could not open");
  });
});
