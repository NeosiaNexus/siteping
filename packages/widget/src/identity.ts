const STORAGE_KEY = "siteping_identity";

export interface Identity {
  name: string;
  email: string;
}

export function getIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof (parsed as Record<string, unknown>).name === "string" &&
      "email" in parsed &&
      typeof (parsed as Record<string, unknown>).email === "string"
    ) {
      const identity = parsed as Identity;
      if (identity.name && identity.email) return identity;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Quota exceeded or localStorage disabled — identity works for this session only
  }
}
