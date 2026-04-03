// @vitest-environment jsdom

import type { FeedbackResponse } from "@siteping/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBus, type WidgetEvents } from "../../src/events.js";
import { createT } from "../../src/i18n/index.js";
import { Panel } from "../../src/panel.js";
import { buildThemeColors } from "../../src/styles/theme.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockApiClient() {
  return {
    sendFeedback: vi.fn(),
    getFeedbacks: vi.fn().mockResolvedValue({ feedbacks: [], total: 0 }),
    resolveFeedback: vi.fn(),
    deleteFeedback: vi.fn(),
    deleteAllFeedbacks: vi.fn(),
  };
}

function createMockMarkers() {
  return {
    render: vi.fn(),
    highlight: vi.fn(),
    pinHighlight: vi.fn(),
    addFeedback: vi.fn(),
    destroy: vi.fn(),
    count: 0,
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
    annotations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createShadowRoot(): ShadowRoot {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host.attachShadow({ mode: "open" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Panel", () => {
  let shadow: ShadowRoot;
  let bus: EventBus<WidgetEvents>;
  let panel: Panel;
  let apiClient: ReturnType<typeof createMockApiClient>;
  let markers: ReturnType<typeof createMockMarkers>;

  const colors = buildThemeColors();
  const t = createT("fr");

  beforeEach(() => {
    shadow = createShadowRoot();
    bus = new EventBus<WidgetEvents>();
    apiClient = createMockApiClient();
    markers = createMockMarkers();
    panel = new Panel(shadow, colors, bus, apiClient as never, "test-project", markers as never, t, "fr");
  });

  afterEach(() => {
    panel.destroy();
    shadow.host.remove();
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe("construction", () => {
    it("creates panel root with role=complementary", () => {
      const root = shadow.querySelector<HTMLElement>('[role="complementary"]');
      expect(root).not.toBeNull();
    });

    it("sets aria-label on panel root", () => {
      const root = shadow.querySelector<HTMLElement>('[role="complementary"]')!;
      expect(root.getAttribute("aria-label")).toBe(t("panel.ariaLabel"));
    });

    it("starts with aria-hidden=true (closed state)", () => {
      const root = shadow.querySelector<HTMLElement>('[role="complementary"]')!;
      expect(root.getAttribute("aria-hidden")).toBe("true");
    });

    it("creates a search input", () => {
      const input = shadow.querySelector<HTMLInputElement>("input.sp-search");
      expect(input).not.toBeNull();
      expect(input!.type).toBe("text");
      expect(input!.getAttribute("aria-label")).toBe(t("panel.searchAria"));
    });

    it("creates a list container with role=list", () => {
      const list = shadow.querySelector<HTMLElement>('[role="list"]');
      expect(list).not.toBeNull();
      expect(list!.getAttribute("aria-label")).toBe(t("panel.feedbackList"));
    });

    it("creates filter chips with correct aria-pressed", () => {
      const chips = shadow.querySelectorAll<HTMLButtonElement>(".sp-chip");
      expect(chips.length).toBe(5); // all, question, change, bug, other

      // "All" chip is active by default
      const allChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="all"]')!;
      expect(allChip.getAttribute("aria-pressed")).toBe("true");

      // Other chips are not active
      const bugChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="bug"]')!;
      expect(bugChip.getAttribute("aria-pressed")).toBe("false");
    });

    it("creates close and delete-all buttons", () => {
      const closeBtn = shadow.querySelector<HTMLButtonElement>(".sp-panel-close");
      expect(closeBtn).not.toBeNull();
      expect(closeBtn!.getAttribute("aria-label")).toBe(t("panel.close"));

      const deleteAllBtn = shadow.querySelector<HTMLButtonElement>(".sp-btn-delete-all");
      expect(deleteAllBtn).not.toBeNull();
      expect(deleteAllBtn!.getAttribute("aria-label")).toBe(t("panel.deleteAll"));
    });
  });

  // -------------------------------------------------------------------------
  // Open / Close
  // -------------------------------------------------------------------------

  describe("open/close", () => {
    it("sets aria-hidden=false when opened", async () => {
      await panel.open();

      const root = shadow.querySelector<HTMLElement>('[role="complementary"]')!;
      expect(root.getAttribute("aria-hidden")).toBe("false");
    });

    it("adds sp-panel--open class when opened", async () => {
      await panel.open();

      const root = shadow.querySelector<HTMLElement>(".sp-panel")!;
      expect(root.classList.contains("sp-panel--open")).toBe(true);
    });

    it("emits 'open' event when opened", async () => {
      const listener = vi.fn();
      bus.on("open", listener);

      await panel.open();

      expect(listener).toHaveBeenCalledOnce();
    });

    it("calls getFeedbacks on open", async () => {
      await panel.open();

      expect(apiClient.getFeedbacks).toHaveBeenCalledWith("test-project", { limit: 50 });
    });

    it("sets aria-hidden=true when closed", async () => {
      await panel.open();
      panel.close();

      const root = shadow.querySelector<HTMLElement>('[role="complementary"]')!;
      expect(root.getAttribute("aria-hidden")).toBe("true");
    });

    it("removes sp-panel--open class when closed", async () => {
      await panel.open();
      panel.close();

      const root = shadow.querySelector<HTMLElement>(".sp-panel")!;
      expect(root.classList.contains("sp-panel--open")).toBe(false);
    });

    it("emits 'close' event when closed", async () => {
      const listener = vi.fn();
      bus.on("close", listener);

      await panel.open();
      panel.close();

      expect(listener).toHaveBeenCalledOnce();
    });

    it("does not emit open twice when already open", async () => {
      const listener = vi.fn();
      bus.on("open", listener);

      await panel.open();
      await panel.open();

      expect(listener).toHaveBeenCalledOnce();
    });

    it("does not emit close when already closed", () => {
      const listener = vi.fn();
      bus.on("close", listener);

      panel.close();

      expect(listener).not.toHaveBeenCalled();
    });

    it("responds to panel:toggle event from bus", async () => {
      bus.emit("panel:toggle", true);

      // Give the async open a tick to resolve
      await vi.waitFor(() => {
        const root = shadow.querySelector<HTMLElement>('[role="complementary"]')!;
        expect(root.getAttribute("aria-hidden")).toBe("false");
      });
    });
  });

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  describe("filters", () => {
    it("toggles aria-pressed when a chip is clicked", async () => {
      await panel.open();

      const bugChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="bug"]')!;
      bugChip.click();

      expect(bugChip.getAttribute("aria-pressed")).toBe("true");
    });

    it("deactivates other chips when a new one is selected (single-select)", async () => {
      await panel.open();

      const bugChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="bug"]')!;
      bugChip.click();

      const allChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="all"]')!;
      expect(allChip.getAttribute("aria-pressed")).toBe("false");
    });

    it("calls loadFeedbacks with type filter when a chip is clicked", async () => {
      await panel.open();
      apiClient.getFeedbacks.mockClear();

      const bugChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="bug"]')!;
      bugChip.click();

      // loadFeedbacks is called asynchronously
      await vi.waitFor(() => {
        expect(apiClient.getFeedbacks).toHaveBeenCalledWith("test-project", expect.objectContaining({ type: "bug" }));
      });
    });

    it("clicking 'all' chip removes type filter", async () => {
      await panel.open();

      // First select a type filter
      const bugChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="bug"]')!;
      bugChip.click();
      apiClient.getFeedbacks.mockClear();

      // Then click all
      const allChip = shadow.querySelector<HTMLButtonElement>('.sp-chip[data-filter="all"]')!;
      allChip.click();

      await vi.waitFor(() => {
        expect(apiClient.getFeedbacks).toHaveBeenCalledWith("test-project", expect.objectContaining({ limit: 50 }));
      });
    });
  });

  // -------------------------------------------------------------------------
  // Card rendering
  // -------------------------------------------------------------------------

  describe("card rendering", () => {
    it("renders feedback cards with correct ARIA role", async () => {
      const feedback = makeFeedback();
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [feedback], total: 1 });

      await panel.open();

      const card = shadow.querySelector<HTMLElement>('[role="listitem"]');
      expect(card).not.toBeNull();
    });

    it("renders feedback card with aria-label including type and message", async () => {
      const feedback = makeFeedback({ type: "bug", message: "Crash on load" });
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [feedback], total: 1 });

      await panel.open();

      const card = shadow.querySelector<HTMLElement>('[role="listitem"]')!;
      const label = card.getAttribute("aria-label")!;
      expect(label).toContain("Bug");
      expect(label).toContain("Crash on load");
    });

    it("sets data-feedback-id on cards", async () => {
      const feedback = makeFeedback({ id: "fb-42" });
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [feedback], total: 1 });

      await panel.open();

      const card = shadow.querySelector<HTMLElement>('[data-feedback-id="fb-42"]');
      expect(card).not.toBeNull();
    });

    it("renders 'resolved' class on resolved feedback cards", async () => {
      const feedback = makeFeedback({ status: "resolved" });
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [feedback], total: 1 });

      await panel.open();

      const card = shadow.querySelector<HTMLElement>(".sp-card--resolved");
      expect(card).not.toBeNull();
    });

    it("shows empty state when no feedbacks exist", async () => {
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [], total: 0 });

      await panel.open();

      const empty = shadow.querySelector<HTMLElement>(".sp-empty");
      expect(empty).not.toBeNull();
    });

    it("renders expand button for cards (initially hidden)", async () => {
      const feedback = makeFeedback();
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [feedback], total: 1 });

      await panel.open();

      const expandBtn = shadow.querySelector<HTMLButtonElement>(".sp-card-expand");
      expect(expandBtn).not.toBeNull();
      expect(expandBtn!.getAttribute("aria-expanded")).toBe("false");
    });

    it("renders resolve button on cards", async () => {
      const feedback = makeFeedback({ status: "open" });
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks: [feedback], total: 1 });

      await panel.open();

      const resolveBtn = shadow.querySelector<HTMLButtonElement>(".sp-btn-resolve");
      expect(resolveBtn).not.toBeNull();
    });

    it("renders multiple cards with staggered animation index", async () => {
      const feedbacks = [makeFeedback({ id: "fb-1" }), makeFeedback({ id: "fb-2" }), makeFeedback({ id: "fb-3" })];
      apiClient.getFeedbacks.mockResolvedValue({ feedbacks, total: 3 });

      await panel.open();

      const cards = shadow.querySelectorAll<HTMLElement>('[role="listitem"]');
      expect(cards.length).toBe(3);
      expect(cards[0].style.getPropertyValue("--sp-card-i")).toBe("0");
      expect(cards[1].style.getPropertyValue("--sp-card-i")).toBe("1");
      expect(cards[2].style.getPropertyValue("--sp-card-i")).toBe("2");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("shows error state when API call fails on first load", async () => {
      apiClient.getFeedbacks.mockRejectedValue(new Error("Network error"));

      await panel.open();

      const errorEl = shadow.querySelector<HTMLElement>(".sp-empty");
      expect(errorEl).not.toBeNull();
    });

    it("emits feedback:error on API failure", async () => {
      const listener = vi.fn();
      bus.on("feedback:error", listener);
      apiClient.getFeedbacks.mockRejectedValue(new Error("Network error"));

      await panel.open();

      expect(listener).toHaveBeenCalledWith(expect.any(Error));
    });

    it("renders retry button on error", async () => {
      apiClient.getFeedbacks.mockRejectedValue(new Error("Network error"));

      await panel.open();

      const retryBtn = shadow.querySelector<HTMLButtonElement>(".sp-btn-ghost");
      expect(retryBtn).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  describe("refresh", () => {
    it("reloads feedbacks when panel is open", async () => {
      await panel.open();
      apiClient.getFeedbacks.mockClear();

      await panel.refresh();

      expect(apiClient.getFeedbacks).toHaveBeenCalledOnce();
    });

    it("does not reload when panel is closed", async () => {
      apiClient.getFeedbacks.mockClear();

      await panel.refresh();

      expect(apiClient.getFeedbacks).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Destroy
  // -------------------------------------------------------------------------

  describe("destroy", () => {
    it("removes DOM elements from shadow root", () => {
      panel.destroy();

      const root = shadow.querySelector<HTMLElement>(".sp-panel");
      expect(root).toBeNull();
    });

    it("removes sp-marker-click document listener", () => {
      const spy = vi.spyOn(document, "removeEventListener");

      panel.destroy();

      expect(spy).toHaveBeenCalledWith("sp-marker-click", expect.any(Function));
      spy.mockRestore();
    });
  });
});
