import { createSitepingHandler } from "@siteping/adapter-prisma";
import { memoryStore } from "@/lib/memory-store";

export const { GET, POST, PATCH, DELETE, OPTIONS } = createSitepingHandler({
  store: memoryStore,
  // Demo only: everyone can wipe the in-memory store. Never do this on a
  // real deployment — set `apiKey` instead.
  requireAuthForDestructive: false,
});
