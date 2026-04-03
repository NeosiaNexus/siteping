import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/en.js";
import { fr } from "../../src/i18n/fr.js";
import { createT, getTypeLabel } from "../../src/i18n/index.js";

// ---------------------------------------------------------------------------
// createT — locale resolution
// ---------------------------------------------------------------------------

describe("createT", () => {
  it("returns French translations for 'fr'", () => {
    const t = createT("fr");
    expect(t("panel.title")).toBe("Feedbacks");
    expect(t("panel.close")).toBe("Fermer le panneau");
    expect(t("popup.submit")).toBe("Envoyer");
  });

  it("returns English translations for 'en'", () => {
    const t = createT("en");
    expect(t("panel.title")).toBe("Feedbacks");
    expect(t("panel.close")).toBe("Close panel");
    expect(t("popup.submit")).toBe("Send");
  });

  it("resolves language prefix from full locale tag (e.g. 'fr-FR')", () => {
    const t = createT("fr-FR");
    expect(t("panel.close")).toBe("Fermer le panneau");
  });

  it("resolves language prefix from full locale tag (e.g. 'en-US')", () => {
    const t = createT("en-US");
    expect(t("panel.close")).toBe("Close panel");
  });

  it("falls back to French for unknown locale", () => {
    const t = createT("de");
    expect(t("panel.close")).toBe("Fermer le panneau");
  });

  it("falls back to French for empty string locale", () => {
    const t = createT("");
    expect(t("panel.close")).toBe("Fermer le panneau");
  });

  it("is case-insensitive for locale prefix", () => {
    const t = createT("EN");
    expect(t("panel.close")).toBe("Close panel");
  });

  it("returns the key itself for a missing translation key", () => {
    const t = createT("fr");
    // Force a key that doesn't exist (the type system prevents this normally,
    // but we test runtime safety)
    const result = (t as (key: string) => string)("nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });
});

// ---------------------------------------------------------------------------
// getTypeLabel — maps FeedbackType to localized label
// ---------------------------------------------------------------------------

describe("getTypeLabel", () => {
  it("returns correct French labels for each type", () => {
    const t = createT("fr");
    expect(getTypeLabel("question", t)).toBe("Question");
    expect(getTypeLabel("change", t)).toBe("Changement");
    expect(getTypeLabel("bug", t)).toBe("Bug");
    expect(getTypeLabel("other", t)).toBe("Autre");
  });

  it("returns correct English labels for each type", () => {
    const t = createT("en");
    expect(getTypeLabel("question", t)).toBe("Question");
    expect(getTypeLabel("change", t)).toBe("Change");
    expect(getTypeLabel("bug", t)).toBe("Bug");
    expect(getTypeLabel("other", t)).toBe("Other");
  });

  it("returns the raw type string for unknown types", () => {
    const t = createT("fr");
    expect(getTypeLabel("unknown-type", t)).toBe("unknown-type");
  });
});

// ---------------------------------------------------------------------------
// Translation completeness — en.ts and fr.ts must have the same keys
// ---------------------------------------------------------------------------

describe("translation completeness", () => {
  const enKeys = Object.keys(en).sort();
  const frKeys = Object.keys(fr).sort();

  it("en.ts and fr.ts have the same set of keys", () => {
    expect(enKeys).toEqual(frKeys);
  });

  it("no translation value is an empty string in fr.ts", () => {
    for (const [key, value] of Object.entries(fr)) {
      expect(value, `fr.ts key "${key}" is empty`).not.toBe("");
    }
  });

  it("no translation value is an empty string in en.ts", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.ts key "${key}" is empty`).not.toBe("");
    }
  });

  it("all keys in en.ts exist in fr.ts", () => {
    for (const key of enKeys) {
      expect(fr).toHaveProperty(key);
    }
  });

  it("all keys in fr.ts exist in en.ts", () => {
    for (const key of frKeys) {
      expect(en).toHaveProperty(key);
    }
  });
});
