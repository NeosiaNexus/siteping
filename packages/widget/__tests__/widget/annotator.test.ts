// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus, type WidgetEvents } from "../../src/events.js";
import { createT } from "../../src/i18n/index.js";
import { buildThemeColors } from "../../src/styles/theme.js";
import { mockMatchMedia } from "../helpers.js";

// ---------------------------------------------------------------------------
// Stubs — jsdom lacks matchMedia
// ---------------------------------------------------------------------------

mockMatchMedia(false);

// ---------------------------------------------------------------------------
// Mock Popup — avoid real popup DOM during annotation tests
// ---------------------------------------------------------------------------

vi.mock("../../src/popup.js", () => ({
  Popup: vi.fn().mockImplementation(() => ({
    show: vi.fn().mockResolvedValue({ type: "bug", message: "Test message" }),
    destroy: vi.fn(),
  })),
}));

// Mock anchor helpers to avoid @medv/finder dependency in jsdom
vi.mock("../../src/dom/anchor.js", () => ({
  findAnchorElement: vi.fn().mockReturnValue(document.body),
  generateAnchor: vi.fn().mockReturnValue({
    cssSelector: "body",
    xpath: "/html/body",
    textSnippet: "",
    elementTag: "BODY",
    elementId: undefined,
    textPrefix: "",
    textSuffix: "",
    fingerprint: "0:0:0",
    neighborText: "",
  }),
  rectToPercentages: vi.fn().mockReturnValue({ xPct: 0, yPct: 0, wPct: 1, hPct: 1 }),
}));

import { Annotator } from "../../src/annotator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const colors = buildThemeColors();
const t = createT("fr");

function createAnnotator() {
  const bus = new EventBus<WidgetEvents>();
  const annotator = new Annotator(colors, bus, t);
  return { annotator, bus };
}

/**
 * Find the annotator overlay — the div appended to body with aria-hidden="true"
 * and tabindex="0" (the overlay, not an SVG or other element).
 */
function findOverlay(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('div[aria-hidden="true"][tabindex="0"]');
}

/** Count how many annotator overlays exist */
function countOverlays(): number {
  return document.body.querySelectorAll('div[aria-hidden="true"][tabindex="0"]').length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Annotator", () => {
  let annotator: Annotator;
  let bus: EventBus<WidgetEvents>;

  beforeEach(() => {
    ({ annotator, bus } = createAnnotator());
  });

  afterEach(() => {
    annotator.destroy();
  });

  // -------------------------------------------------------------------------
  // Activate / Deactivate
  // -------------------------------------------------------------------------

  describe("activate", () => {
    it("creates an overlay on annotation:start", () => {
      bus.emit("annotation:start");

      const overlay = findOverlay();
      expect(overlay).not.toBeNull();
      expect(overlay!.getAttribute("aria-hidden")).toBe("true");
    });

    it("creates a toolbar element (button with cancel text) on activation", () => {
      bus.emit("annotation:start");

      // Toolbar contains a cancel button
      const buttons = document.body.querySelectorAll("button");
      const hasCancel = Array.from(buttons).some((btn) => btn.textContent === t("annotator.cancel"));
      expect(hasCancel).toBe(true);
    });

    it("registers an Escape keydown listener on the document", () => {
      const spy = vi.spyOn(document, "addEventListener");

      bus.emit("annotation:start");

      const keydownCalls = spy.mock.calls.filter((call) => call[0] === "keydown");
      expect(keydownCalls.length).toBeGreaterThan(0);

      spy.mockRestore();
    });

    it("locks page scroll by setting body overflow to hidden", () => {
      document.body.style.overflow = "auto";

      bus.emit("annotation:start");

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("double activation is idempotent — no duplicate overlays", () => {
      bus.emit("annotation:start");
      bus.emit("annotation:start");

      expect(countOverlays()).toBe(1);
    });
  });

  describe("deactivate", () => {
    it("removes overlay and toolbar from DOM", () => {
      bus.emit("annotation:start");
      expect(findOverlay()).not.toBeNull();

      // Trigger deactivation via Escape key
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(findOverlay()).toBeNull();
    });

    it("restores original body overflow", () => {
      document.body.style.overflow = "scroll";

      bus.emit("annotation:start");
      expect(document.body.style.overflow).toBe("hidden");

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(document.body.style.overflow).toBe("scroll");
    });

    it("emits annotation:end on deactivation", () => {
      const listener = vi.fn();
      bus.on("annotation:end", listener);

      bus.emit("annotation:start");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(listener).toHaveBeenCalledOnce();
    });

    it("removes the document keydown listener", () => {
      const spy = vi.spyOn(document, "removeEventListener");

      bus.emit("annotation:start");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      const keydownCalls = spy.mock.calls.filter((call) => call[0] === "keydown");
      expect(keydownCalls.length).toBeGreaterThan(0);

      spy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Escape key
  // -------------------------------------------------------------------------

  describe("keyboard: Escape", () => {
    it("triggers deactivation on Escape key press", () => {
      bus.emit("annotation:start");

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(findOverlay()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Mouse drag — drawing rectangle
  // -------------------------------------------------------------------------

  describe("mouse drag", () => {
    it("creates a drawing rectangle on mousedown", () => {
      bus.emit("annotation:start");

      const overlay = findOverlay()!;
      overlay.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, bubbles: true }));

      // drawingRect is appended inside the overlay
      const drawingRect = overlay.querySelector("div");
      expect(drawingRect).not.toBeNull();
    });

    it("updates drawing rectangle dimensions on mousemove via rAF", () => {
      bus.emit("annotation:start");

      const overlay = findOverlay()!;
      overlay.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, bubbles: true }));

      // Mock rAF to execute callback synchronously
      const origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };

      overlay.dispatchEvent(new MouseEvent("mousemove", { clientX: 200, clientY: 150, bubbles: true }));

      const drawingRect = overlay.querySelector<HTMLElement>("div")!;
      expect(drawingRect.style.width).toBe("150px"); // |200-50|
      expect(drawingRect.style.height).toBe("100px"); // |150-50|

      window.requestAnimationFrame = origRAF;
    });

    it("rejects mouse drag smaller than 10px in width", async () => {
      bus.emit("annotation:start");

      const listener = vi.fn();
      bus.on("annotation:complete", listener);

      const overlay = findOverlay()!;
      overlay.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("mouseup", { clientX: 55, clientY: 200, bubbles: true }));

      // Wait a tick for the async handler
      await vi.waitFor(() => {
        // annotation:complete should NOT have been emitted
        expect(listener).not.toHaveBeenCalled();
      });
    });

    it("rejects mouse drag smaller than 10px in height", async () => {
      bus.emit("annotation:start");

      const listener = vi.fn();
      bus.on("annotation:complete", listener);

      const overlay = findOverlay()!;
      overlay.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("mouseup", { clientX: 200, clientY: 55, bubbles: true }));

      await vi.waitFor(() => {
        expect(listener).not.toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Touch events
  // -------------------------------------------------------------------------

  describe("touch events", () => {
    it("starts drawing on touchstart", () => {
      bus.emit("annotation:start");

      const overlay = findOverlay()!;
      // jsdom does not have Touch constructor — create a minimal touch-like event
      const touchEvent = new Event("touchstart", { bubbles: true, cancelable: true });
      Object.defineProperty(touchEvent, "touches", {
        value: [{ clientX: 50, clientY: 50 }],
      });
      Object.defineProperty(touchEvent, "preventDefault", { value: vi.fn() });
      overlay.dispatchEvent(touchEvent);

      const drawingRect = overlay.querySelector("div");
      expect(drawingRect).not.toBeNull();
    });

    it("updates drawing rect on touchmove via rAF", () => {
      bus.emit("annotation:start");

      const overlay = findOverlay()!;

      // Simulate touchstart
      const startEvent = new Event("touchstart", { bubbles: true, cancelable: true });
      Object.defineProperty(startEvent, "touches", {
        value: [{ clientX: 50, clientY: 50 }],
      });
      Object.defineProperty(startEvent, "preventDefault", { value: vi.fn() });
      overlay.dispatchEvent(startEvent);

      const origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };

      // Simulate touchmove
      const moveEvent = new Event("touchmove", { bubbles: true, cancelable: true });
      Object.defineProperty(moveEvent, "preventDefault", { value: vi.fn() });
      Object.defineProperty(moveEvent, "touches", {
        value: [{ clientX: 200, clientY: 150 }],
      });
      overlay.dispatchEvent(moveEvent);

      const drawingRect = overlay.querySelector<HTMLElement>("div")!;
      expect(drawingRect.style.width).toBe("150px");
      expect(drawingRect.style.height).toBe("100px");

      window.requestAnimationFrame = origRAF;
    });
  });

  // -------------------------------------------------------------------------
  // rAF throttling
  // -------------------------------------------------------------------------

  describe("mousemove throttling via rAF", () => {
    it("coalesces multiple mousemove events into a single rAF callback", () => {
      bus.emit("annotation:start");

      const overlay = findOverlay()!;
      overlay.dispatchEvent(new MouseEvent("mousedown", { clientX: 50, clientY: 50, bubbles: true }));

      const rafSpy = vi.spyOn(window, "requestAnimationFrame");

      // Fire multiple moves — only one rAF should be requested
      overlay.dispatchEvent(new MouseEvent("mousemove", { clientX: 100, clientY: 100, bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 150, bubbles: true }));
      overlay.dispatchEvent(new MouseEvent("mousemove", { clientX: 200, clientY: 200, bubbles: true }));

      // Only 1 rAF request should be pending (subsequent moves are coalesced)
      expect(rafSpy).toHaveBeenCalledTimes(1);

      rafSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // Destroy
  // -------------------------------------------------------------------------

  describe("destroy", () => {
    it("deactivates and cleans up popup", () => {
      bus.emit("annotation:start");

      annotator.destroy();

      expect(findOverlay()).toBeNull();
    });

    it("can be called when not active without throwing", () => {
      expect(() => annotator.destroy()).not.toThrow();
    });
  });
});
