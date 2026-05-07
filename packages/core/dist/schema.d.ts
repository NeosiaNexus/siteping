/**
 * Siteping database models — single source of truth.
 *
 * Used by:
 * - CLI to generate Prisma schema (via prisma-ast)
 * - Adapter for Zod validation
 * - Type exports
 *
 * This is a TS representation, NOT a .prisma file.
 * The CLI generates the actual Prisma schema from this definition.
 */
/** Definition of a single field in a Siteping database model. */
export interface FieldDef {
    type: string;
    default?: string;
    optional?: boolean;
    relation?: {
        kind: "1-to-many" | "many-to-1";
        model: string;
        fields?: string[];
        references?: string[];
        onDelete?: string;
    };
    isId?: boolean;
    isUnique?: boolean;
    /** Prisma native type attribute (e.g. "Text" for @db.Text) — used for MySQL compatibility on long strings */
    nativeType?: string;
    /** Prisma @updatedAt attribute */
    isUpdatedAt?: boolean;
}
/** Definition of a composite index on a Siteping database model. */
export interface IndexDef {
    fields: string[];
}
/** Definition of a single Siteping database model (fields + indexes). */
export interface ModelDef {
    fields: Record<string, FieldDef>;
    indexes?: IndexDef[];
}
export declare const SITEPING_MODELS: Readonly<{
    readonly SitepingFeedback: {
        readonly fields: {
            readonly id: {
                readonly type: "String";
                readonly isId: true;
                readonly default: "cuid()";
            };
            readonly projectName: {
                readonly type: "String";
            };
            readonly type: {
                readonly type: "String";
            };
            readonly message: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly status: {
                readonly type: "String";
                readonly default: "\"open\"";
            };
            readonly url: {
                readonly type: "String";
            };
            readonly urlPattern: {
                readonly type: "String";
                readonly optional: true;
            };
            readonly screenshotUrl: {
                readonly type: "String";
                readonly optional: true;
                readonly nativeType: "Text";
            };
            readonly viewport: {
                readonly type: "String";
            };
            readonly userAgent: {
                readonly type: "String";
            };
            readonly authorName: {
                readonly type: "String";
            };
            readonly authorEmail: {
                readonly type: "String";
            };
            readonly clientId: {
                readonly type: "String";
                readonly isUnique: true;
            };
            readonly resolvedAt: {
                readonly type: "DateTime";
                readonly optional: true;
            };
            readonly createdAt: {
                readonly type: "DateTime";
                readonly default: "now()";
            };
            readonly updatedAt: {
                readonly type: "DateTime";
                readonly isUpdatedAt: true;
            };
            readonly annotations: {
                readonly type: "SitepingAnnotation";
                readonly relation: {
                    readonly kind: "1-to-many";
                    readonly model: "SitepingAnnotation";
                };
            };
        };
        readonly indexes: [{
            readonly fields: ["projectName"];
        }, {
            readonly fields: ["projectName", "status", "createdAt"];
        }, {
            readonly fields: ["projectName", "url"];
        }];
    };
    readonly SitepingAnnotation: {
        readonly fields: {
            readonly id: {
                readonly type: "String";
                readonly isId: true;
                readonly default: "cuid()";
            };
            readonly feedbackId: {
                readonly type: "String";
            };
            readonly feedback: {
                readonly type: "SitepingFeedback";
                readonly relation: {
                    readonly kind: "many-to-1";
                    readonly model: "SitepingFeedback";
                    readonly fields: ["feedbackId"];
                    readonly references: ["id"];
                    readonly onDelete: "Cascade";
                };
            };
            readonly cssSelector: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly xpath: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly textSnippet: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly elementTag: {
                readonly type: "String";
            };
            readonly elementId: {
                readonly type: "String";
                readonly optional: true;
            };
            readonly textPrefix: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly textSuffix: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly fingerprint: {
                readonly type: "String";
            };
            readonly neighborText: {
                readonly type: "String";
                readonly nativeType: "Text";
            };
            readonly anchorKey: {
                readonly type: "String";
                readonly optional: true;
            };
            readonly xPct: {
                readonly type: "Float";
            };
            readonly yPct: {
                readonly type: "Float";
            };
            readonly wPct: {
                readonly type: "Float";
            };
            readonly hPct: {
                readonly type: "Float";
            };
            readonly scrollX: {
                readonly type: "Float";
            };
            readonly scrollY: {
                readonly type: "Float";
            };
            readonly viewportW: {
                readonly type: "Int";
            };
            readonly viewportH: {
                readonly type: "Int";
            };
            readonly devicePixelRatio: {
                readonly type: "Float";
                readonly default: "1";
            };
            readonly createdAt: {
                readonly type: "DateTime";
                readonly default: "now()";
            };
        };
        readonly indexes: [{
            readonly fields: ["feedbackId"];
        }];
    };
}>;
