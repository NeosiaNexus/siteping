import type {
  FeedbackCreateInput,
  FeedbackQuery,
  FeedbackRecord,
  FeedbackUpdateInput,
  SitepingStore,
} from "@siteping/core";
import {
  feedbackCreateSchema,
  feedbackDeleteSchema,
  feedbackPatchSchema,
  formatValidationErrors,
} from "./validation.js";

export type { SitepingStore } from "@siteping/core";
export { SITEPING_MODELS } from "@siteping/core";
export type {
  FeedbackCreateInput as FeedbackCreateSchemaInput,
  FeedbackDeleteInput,
  FeedbackPatchInput,
} from "./validation.js";

// ---------------------------------------------------------------------------
// Internal PrismaClient shape — kept private, not exported in .d.ts
// ---------------------------------------------------------------------------

/**
 * @internal Minimal Prisma client shape used internally.
 * Not part of the public API — consumers pass their own PrismaClient instance.
 */
interface _PrismaClient {
  sitepingFeedback: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown | null>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
}

// ---------------------------------------------------------------------------
// PrismaStore — SitepingStore implementation backed by Prisma
// ---------------------------------------------------------------------------

const INCLUDE_ANNOTATIONS = { annotations: true };

/**
 * Prisma-backed implementation of `SitepingStore`.
 *
 * Wraps a PrismaClient to satisfy the abstract store interface.
 */
export class PrismaStore implements SitepingStore {
  /** @internal */
  private prisma: _PrismaClient;

  constructor(prisma: _PrismaClient) {
    this.prisma = prisma;
  }

  async createFeedback(data: FeedbackCreateInput): Promise<FeedbackRecord> {
    return (await this.prisma.sitepingFeedback.create({
      data: {
        projectName: data.projectName,
        type: data.type,
        message: data.message,
        status: data.status,
        url: data.url,
        viewport: data.viewport,
        userAgent: data.userAgent,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        clientId: data.clientId,
        annotations: {
          create: data.annotations.map((ann) => ({
            cssSelector: ann.cssSelector,
            xpath: ann.xpath,
            textSnippet: ann.textSnippet,
            elementTag: ann.elementTag,
            elementId: ann.elementId,
            textPrefix: ann.textPrefix,
            textSuffix: ann.textSuffix,
            fingerprint: ann.fingerprint,
            neighborText: ann.neighborText,
            xPct: ann.xPct,
            yPct: ann.yPct,
            wPct: ann.wPct,
            hPct: ann.hPct,
            scrollX: ann.scrollX,
            scrollY: ann.scrollY,
            viewportW: ann.viewportW,
            viewportH: ann.viewportH,
            devicePixelRatio: ann.devicePixelRatio,
          })),
        },
      },
      include: INCLUDE_ANNOTATIONS,
    })) as FeedbackRecord;
  }

  async findByClientId(clientId: string): Promise<FeedbackRecord | null> {
    return (await this.prisma.sitepingFeedback.findUnique({
      where: { clientId },
      include: INCLUDE_ANNOTATIONS,
    })) as FeedbackRecord | null;
  }

  async getFeedbacks(query: FeedbackQuery): Promise<{ feedbacks: FeedbackRecord[]; total: number }> {
    const { projectName, type, status, search, page = 1, limit = 50 } = query;

    const where: Record<string, unknown> = { projectName };
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) where.message = { contains: search };

    const [feedbacks, total] = await Promise.all([
      this.prisma.sitepingFeedback.findMany({
        where,
        include: INCLUDE_ANNOTATIONS,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sitepingFeedback.count({ where }),
    ]);

    return { feedbacks: feedbacks as FeedbackRecord[], total };
  }

  async updateFeedback(id: string, data: FeedbackUpdateInput): Promise<FeedbackRecord> {
    return (await this.prisma.sitepingFeedback.update({
      where: { id },
      data: {
        status: data.status,
        resolvedAt: data.resolvedAt,
      },
      include: INCLUDE_ANNOTATIONS,
    })) as FeedbackRecord;
  }

  async deleteFeedback(id: string): Promise<void> {
    await this.prisma.sitepingFeedback.delete({ where: { id } });
  }

  async deleteAllFeedbacks(projectName: string): Promise<void> {
    await this.prisma.sitepingFeedback.deleteMany({ where: { projectName } });
  }
}

// ---------------------------------------------------------------------------
// Handler options — backwards compatible
// ---------------------------------------------------------------------------

export interface HandlerOptions {
  /** Prisma client — used when `store` is not provided. Wrapped in a `PrismaStore` internally. */
  prisma?: _PrismaClient;
  /** Abstract store — when provided, takes precedence over `prisma`. */
  store?: SitepingStore;
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Create request handlers for the Siteping API endpoint.
 *
 * Accepts either a `store` (abstract) or a `prisma` client (backwards compatible).
 * When `prisma` is provided without `store`, it is wrapped in a `PrismaStore`.
 *
 * @example Next.js App Router — `app/api/siteping/route.ts`
 * ```ts
 * import { createSitepingHandler } from '@siteping/adapter-prisma'
 * import { prisma } from '@/lib/prisma'
 *
 * export const { GET, POST, PATCH, DELETE } = createSitepingHandler({ prisma })
 * ```
 *
 * @example With abstract store
 * ```ts
 * import { createSitepingHandler, PrismaStore } from '@siteping/adapter-prisma'
 * import { prisma } from '@/lib/prisma'
 *
 * const store = new PrismaStore(prisma)
 * export const { GET, POST, PATCH, DELETE } = createSitepingHandler({ store })
 * ```
 */
export function createSitepingHandler({ prisma, store: providedStore }: HandlerOptions) {
  if (!providedStore && !prisma) {
    throw new Error("[siteping] createSitepingHandler requires either `store` or `prisma`.");
  }

  const store: SitepingStore = providedStore ?? new PrismaStore(prisma!);

  // For clientId dedup lookups we need PrismaStore-specific method
  const prismaStore = store instanceof PrismaStore ? store : null;

  return {
    POST: async (request: Request): Promise<Response> => {
      const body = await request.json().catch(() => null);
      if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const parsed = feedbackCreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ errors: formatValidationErrors(parsed.error) }, { status: 400 });
      }

      const data = parsed.data;

      try {
        const feedback = await store.createFeedback({
          projectName: data.projectName,
          type: data.type,
          message: data.message,
          status: "open",
          url: data.url,
          viewport: data.viewport,
          userAgent: data.userAgent,
          authorName: data.authorName,
          authorEmail: data.authorEmail,
          clientId: data.clientId,
          annotations: data.annotations.map((ann) => ({
            cssSelector: ann.anchor.cssSelector,
            xpath: ann.anchor.xpath,
            textSnippet: ann.anchor.textSnippet,
            elementTag: ann.anchor.elementTag,
            elementId: ann.anchor.elementId,
            textPrefix: ann.anchor.textPrefix,
            textSuffix: ann.anchor.textSuffix,
            fingerprint: ann.anchor.fingerprint,
            neighborText: ann.anchor.neighborText,
            xPct: ann.rect.xPct,
            yPct: ann.rect.yPct,
            wPct: ann.rect.wPct,
            hPct: ann.rect.hPct,
            scrollX: ann.scrollX,
            scrollY: ann.scrollY,
            viewportW: ann.viewportW,
            viewportH: ann.viewportH,
            devicePixelRatio: ann.devicePixelRatio,
          })),
        });

        return Response.json(feedback, { status: 201 });
      } catch (error) {
        // Handle unique constraint violation (clientId dedup)
        if (isDuplicateError(error) && prismaStore) {
          const existing = await prismaStore.findByClientId(data.clientId);
          if (existing) return Response.json(existing, { status: 201 });
        }

        console.error("[siteping] Failed to create feedback:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    },

    GET: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const projectName = url.searchParams.get("projectName");

      if (!projectName) {
        return Response.json({ error: "projectName is required" }, { status: 400 });
      }

      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
      const type = url.searchParams.get("type") ?? undefined;
      const status = url.searchParams.get("status") ?? undefined;
      const search = url.searchParams.get("search") ?? undefined;

      try {
        const result = await store.getFeedbacks({ projectName, page, limit, type, status, search });
        return Response.json(result);
      } catch (error) {
        console.error("[siteping] Failed to fetch feedbacks:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    },

    PATCH: async (request: Request): Promise<Response> => {
      const body = await request.json().catch(() => null);
      if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const parsed = feedbackPatchSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ errors: formatValidationErrors(parsed.error) }, { status: 400 });
      }

      try {
        const feedback = await store.updateFeedback(parsed.data.id, {
          status: parsed.data.status,
          resolvedAt: parsed.data.status === "resolved" ? new Date() : null,
        });

        return Response.json(feedback);
      } catch (error) {
        console.error("[siteping] Failed to update feedback:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    },

    DELETE: async (request: Request): Promise<Response> => {
      const body = await request.json().catch(() => null);
      if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const parsed = feedbackDeleteSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ errors: formatValidationErrors(parsed.error) }, { status: 400 });
      }

      try {
        if ("deleteAll" in parsed.data) {
          await store.deleteAllFeedbacks(parsed.data.projectName);
          return Response.json({ deleted: true });
        }

        await store.deleteFeedback(parsed.data.id);
        return Response.json({ deleted: true });
      } catch (error) {
        if (isNotFoundError(error)) {
          return Response.json({ error: "Feedback not found" }, { status: 404 });
        }
        console.error("[siteping] Failed to delete feedback:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }
    },
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === code;
}

function isDuplicateError(error: unknown): boolean {
  return isPrismaError(error, "P2002");
}

function isNotFoundError(error: unknown): boolean {
  return isPrismaError(error, "P2025");
}
