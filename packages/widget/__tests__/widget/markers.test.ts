// @vitest-environment jsdom

import type { AnnotationResponse, FeedbackResponse } from "@siteping/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus, type WidgetEvents } from "../../src/events.js";
import { createT } from "../../src/i18n/index.js";
import { buildThemeColors } from "../../src/styles/theme.js";
import type { Tooltip } from "../../src/tooltip.js";

// ---------------------------------------------------------------------------
// Mock resolveAnnotation — avoids the full DOM resolution chain in jsdom
// ---------------------------------------------------------------------------

const { mockState } = vi.hoisted(() => {
  const state = { confidence: 1, element: null as Element | null };
  return { mockState: state };
});

vi.mock(new URL("../../src/dom/resolver.js", import.meta.url).pathname, () => ({
  resolveAnnotation: () => {
    if (!mockState.element) {
      mockState.element = document.createElement("div");
      document.body.appendChild(mockState.element);
      mockState.element.getBoundingClientRect = () => ({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        top: 100,
        left: 100,
        right: 300,
        bottom: 200,
        toJSON() {
          return {};
        },
      });
    }
    return {
      element: mockState.element,
      rect: new DOMRect(100, 100, 200, 100),
      confidence: mockState.confidence,
      strategy: "css" as const,
    };
  },
}));

import { MarkerManager } from "../../src/markers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const colors = buildThemeColors();
const t = createT("fr");

function createMockTooltip(): Tooltip {
  return {
    tooltipId: "sp-tooltip",
    show: vi.fn(),
    scheduleHide: vi.fn(),
    cancelHide: vi.fn(),
    hide: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
    destroy: vi.fn(),
  } as unknown as Tooltip;
}

function makeAnnotation(overrides: Partial<AnnotationResponse> = {}): AnnotationResponse {
  return {
    id: "ann-1",
    feedbackId: "fb-1",
    cssSelector: "div.test",
    xpath: "/html/body/div",
    textSnippet: "test content",
    elementTag: "DIV",
    elementId: null,
    textPrefix: "",
    textSuffix: "",
    fingerprint: "0:0:0",
    neighborText: "",
    xPct: 0.1,
    yPct: 0.1,
    wPct: 0.5,
    hPct: 0.5,
    scrollX: 0,
    scrollY: 0,
    viewportW: 1920,
    viewportH: 1080,
    devicePixelRatio: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeFeedback(overrides: Partial<FeedbackResponse> = {}): FeedbackResponse {
  return {
    id: "fb-1",
    projectName: "test-project",
    type: "bug",
    message: "Something is broken",
    status: "open",
    url: "http://localhost/",
    viewport: "1920x1080",
    userAgent: "test",
    authorName: "Test User",
    authorEmail: "test@example.com",
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    annotations: [makeAnnotation()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarkerManager", () => {
  let bus: EventBus<WidgetEvents>;
  let tooltip: Tooltip;
  let markers: MarkerManager;

  beforeEach(() => {
    bus = new EventBus<WidgetEvents>();
    tooltip = createMockTooltip();
    mockState.confidence = 1;
    mockState.element = null;
    markers = new MarkerManager(colors, tooltip, bus, t);
  });

  afterEach(() => {
    markers.destroy();
    // Clean up any leftover elements
    for (const el of document.querySelectorAll("#siteping-markers")) {
      el.remove();
    }
    if (mockState.element) {
      mockState.element.remove();
      mockState.element = null;
    }
  });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  describe("render", () => {
    it("creates a container element with id siteping-markers", () => {
      const container = document.getElementById("siteping-markers");
      expect(container).not.toBeNull();
    });

    it("render([]) clears the container", () => {
      markers.render([makeFeedback()]);
      markers.render([]);

      const container = document.getElementById("siteping-markers")!;
      expect(container.children.length).toBe(0);
    });

    it("render([feedback]) creates marker elements", () => {
      markers.render([makeFeedback()]);

      const container = document.getElementById("siteping-markers")!;
      const markerEls = container.querySelectorAll("[data-feedback-id]");
      expect(markerEls.length).toBe(1);
    });

    it("marker has data-feedback-id attribute matching feedback id", () => {
      markers.render([makeFeedback({ id: "fb-42" })]);

      const marker = document.querySelector('[data-feedback-id="fb-42"]');
      expect(marker).not.toBeNull();
    });

    it("marker has tabindex=0 for keyboard accessibility", () => {
      markers.render([makeFeedback()]);

      const marker = document.querySelector("[data-feedback-id]")!;
      expect(marker.getAttribute("tabindex")).toBe("0");
    });

    it("marker has role=button", () => {
      markers.render([makeFeedback()]);

      const marker = document.querySelector("[data-feedback-id]")!;
      expect(marker.getAttribute("role")).toBe("button");
    });

    it("marker has aria-label with number, type, and message", () => {
      markers.render([makeFeedback({ type: "bug", message: "Crash on load" })]);

      const marker = document.querySelector("[data-feedback-id]")!;
      const label = marker.getAttribute("aria-label")!;
      expect(label).toContain("1"); // marker number
      expect(label).toContain("Bug"); // type label
      expect(label).toContain("Crash on load"); // message
    });

    it("marker has aria-describedby pointing to tooltip id", () => {
      markers.render([makeFeedback()]);

      const marker = document.querySelector("[data-feedback-id]")!;
      expect(marker.getAttribute("aria-describedby")).toBe("sp-tooltip");
    });

    it("renders multiple markers for multiple feedbacks", () => {
      const feedbacks = [makeFeedback({ id: "fb-1" }), makeFeedback({ id: "fb-2" }), makeFeedback({ id: "fb-3" })];

      markers.render(feedbacks);

      const markerEls = document.querySelectorAll("[data-feedback-id]");
      expect(markerEls.length).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Resolved feedback markers
  // -------------------------------------------------------------------------

  describe("resolved feedback", () => {
    it("displays checkmark text for resolved markers", () => {
      markers.render([makeFeedback({ status: "resolved" })]);

      const marker = document.querySelector<HTMLElement>("[data-feedback-id]")!;
      expect(marker.textContent).toContain("\u2713");
    });

    it("displays number for open markers", () => {
      markers.render([makeFeedback({ status: "open" })]);

      const marker = document.querySelector<HTMLElement>("[data-feedback-id]")!;
      expect(marker.textContent).toContain("1");
    });
  });

  // -------------------------------------------------------------------------
  // Confidence styling
  // -------------------------------------------------------------------------

  describe("confidence styling", () => {
    it("applies dashed border for low confidence annotations", () => {
      mockState.confidence = 0.5;
      mockState.element = null;

      markers.render([makeFeedback()]);

      const marker = document.querySelector<HTMLElement>("[data-feedback-id]")!;
      expect(marker.style.borderStyle).toBe("dashed");
    });

    it("applies reduced opacity (0.7) for low confidence annotations", () => {
      mockState.confidence = 0.5;
      mockState.element = null;

      markers.render([makeFeedback()]);

      const marker = document.querySelector<HTMLElement>("[data-feedback-id]")!;
      expect(marker.style.opacity).toBe("0.7");
    });

    it("uses solid border for high confidence annotations", () => {
      mockState.confidence = 0.9;
      mockState.element = null;

      markers.render([makeFeedback()]);

      const marker = document.querySelector<HTMLElement>("[data-feedback-id]")!;
      expect(marker.style.borderStyle).toBe("solid");
    });

    it("does not apply dashed border for resolved feedback even if low confidence", () => {
      mockState.confidence = 0.3;
      mockState.element = null;

      markers.render([makeFeedback({ status: "resolved" })]);

      const marker = document.querySelector<HTMLElement>("[data-feedback-id]")!;
      // Resolved feedback bypasses low-confidence styling
      expect(marker.style.borderStyle).toBe("solid");
    });
  });

  // -------------------------------------------------------------------------
  // addFeedback
  // -------------------------------------------------------------------------

  describe("addFeedback", () => {
    it("adds a single marker with animation", () => {
      markers.addFeedback(makeFeedback({ id: "fb-new" }), 1);

      const marker = document.querySelector<HTMLElement>('[data-feedback-id="fb-new"]')!;
      expect(marker).not.toBeNull();
      expect(marker.style.animation).toContain("sp-marker-in");
    });

    it("increments marker count", () => {
      expect(markers.count).toBe(0);

      markers.addFeedback(makeFeedback(), 1);

      expect(markers.count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Highlight
  // -------------------------------------------------------------------------

  describe("highlight", () => {
    it("applies pulse animation on the marker for the given feedback id", () => {
      markers.render([makeFeedback({ id: "fb-1" })]);

      markers.highlight("fb-1");

      const marker = document.querySelector<HTMLElement>('[data-feedback-id="fb-1"]')!;
      expect(marker.style.animation).toContain("sp-pulse-ring");
    });
  });

  // -------------------------------------------------------------------------
  // Annotations toggle via event bus
  // -------------------------------------------------------------------------

  describe("annotations:toggle", () => {
    it("hides container when toggled to false", () => {
      bus.emit("annotations:toggle", false);

      const container = document.getElementById("siteping-markers")!;
      expect(container.style.display).toBe("none");
    });

    it("shows container when toggled to true", () => {
      bus.emit("annotations:toggle", false);
      bus.emit("annotations:toggle", true);

      const container = document.getElementById("siteping-markers")!;
      expect(container.style.display).toBe("block");
    });
  });

  // -------------------------------------------------------------------------
  // Destroy
  // -------------------------------------------------------------------------

  describe("destroy", () => {
    it("removes the container element from DOM", () => {
      markers.destroy();

      const container = document.getElementById("siteping-markers");
      expect(container).toBeNull();
    });

    it("removes resize listener", () => {
      const spy = vi.spyOn(window, "removeEventListener");

      markers.destroy();

      const resizeCalls = spy.mock.calls.filter((call) => call[0] === "resize");
      expect(resizeCalls.length).toBeGreaterThan(0);

      spy.mockRestore();
    });

    it("removes scroll listener", () => {
      const spy = vi.spyOn(window, "removeEventListener");

      markers.destroy();

      const scrollCalls = spy.mock.calls.filter((call) => call[0] === "scroll");
      expect(scrollCalls.length).toBeGreaterThan(0);

      spy.mockRestore();
    });

    it("disconnects MutationObserver", () => {
      const disconnectSpy = vi.spyOn(MutationObserver.prototype, "disconnect");

      markers.destroy();

      expect(disconnectSpy).toHaveBeenCalled();

      disconnectSpy.mockRestore();
    });

    it("removes document click listener for clusters", () => {
      const spy = vi.spyOn(document, "removeEventListener");

      markers.destroy();

      const clickCalls = spy.mock.calls.filter((call) => call[0] === "click");
      expect(clickCalls.length).toBeGreaterThan(0);

      spy.mockRestore();
    });
  });
});
