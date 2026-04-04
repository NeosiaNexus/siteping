import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { statusCommand } from "../../src/commands/status.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid Prisma schema with both Siteping models — complete and up-to-date. */
const FULL_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model SitepingFeedback {
  id           String              @id @default(cuid())
  projectName  String
  type         String
  message      String              @db.Text
  status       String              @default("open")
  url          String
  viewport     String
  userAgent    String
  authorName   String
  authorEmail  String
  clientId     String              @unique
  resolvedAt   DateTime?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
  annotations  SitepingAnnotation[]

  @@index([projectName])
  @@index([projectName, status, createdAt])
}

model SitepingAnnotation {
  id               String           @id @default(cuid())
  feedbackId       String
  feedback         SitepingFeedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  cssSelector      String           @db.Text
  xpath            String           @db.Text
  textSnippet      String           @db.Text
  elementTag       String
  elementId        String?
  textPrefix       String           @db.Text
  textSuffix       String           @db.Text
  fingerprint      String
  neighborText     String           @db.Text
  xPct             Float
  yPct             Float
  wPct             Float
  hPct             Float
  scrollX          Float
  scrollY          Float
  viewportW        Int
  viewportH        Int
  devicePixelRatio Float            @default(1)
  createdAt        DateTime         @default(now())

  @@index([feedbackId])
}
`;

/** Schema missing SitepingAnnotation entirely and SitepingFeedback is partial. */
const PARTIAL_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model SitepingFeedback {
  id          String   @id @default(cuid())
  projectName String
  type        String
  message     String
  createdAt   DateTime @default(now())
}
`;

function createPackageJson(dir: string, deps?: Record<string, string>, devDeps?: Record<string, string>): void {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "test-project",
      dependencies: deps ?? {},
      devDependencies: devDeps ?? {},
    }),
  );
}

function createApiRoute(dir: string): void {
  const routeDir = join(dir, "app", "api", "siteping");
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(join(routeDir, "route.ts"), "export const GET = () => {};");
}

function createWidgetUsage(dir: string): void {
  const srcDir = join(dir, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(
    join(srcDir, "feedback.ts"),
    'import { initSiteping } from "@siteping/widget";\ninitSiteping({ endpoint: "/api/siteping", projectName: "test" });',
  );
}

function createPrismaSchema(dir: string, content: string): string {
  const prismaDir = join(dir, "prisma");
  mkdirSync(prismaDir, { recursive: true });
  const schemaPath = join(prismaDir, "schema.prisma");
  writeFileSync(schemaPath, content);
  return schemaPath;
}

/**
 * Collect all calls to the spy and return their first argument as strings.
 * Useful for searching through all messages logged by a specific log level.
 */
function allMessages(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call) => String(call[0]));
}

// ---------------------------------------------------------------------------
// Tests — integration style: real file system, spied clack output
// ---------------------------------------------------------------------------

describe("statusCommand", () => {
  let tmpDir: string;
  let originalCwd: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logErrorSpy: ReturnType<typeof vi.spyOn>;
  let logSuccessSpy: ReturnType<typeof vi.spyOn>;
  let logWarnSpy: ReturnType<typeof vi.spyOn>;
  let logInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "siteping-status-test-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    logErrorSpy = vi.spyOn(p.log, "error").mockImplementation(() => {});
    logSuccessSpy = vi.spyOn(p.log, "success").mockImplementation(() => {});
    logWarnSpy = vi.spyOn(p.log, "warn").mockImplementation(() => {});
    logInfoSpy = vi.spyOn(p.log, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    exitSpy.mockRestore();
    logErrorSpy.mockRestore();
    logSuccessSpy.mockRestore();
    logWarnSpy.mockRestore();
    logInfoSpy.mockRestore();
  });

  describe("Prisma schema detection", () => {
    it("reports error when no Prisma schema is found", () => {
      createPackageJson(tmpDir);

      statusCommand({});

      const errors = allMessages(logErrorSpy);
      expect(errors.some((m) => m.includes("Prisma schema"))).toBe(true);
    });

    it("reports success when schema is found and up-to-date", () => {
      createPrismaSchema(tmpDir, FULL_SCHEMA);
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      createApiRoute(tmpDir);

      statusCommand({});

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("Prisma schema"))).toBe(true);
    });

    it("reports warning when models are missing from schema", () => {
      createPrismaSchema(tmpDir, PARTIAL_SCHEMA);
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      createApiRoute(tmpDir);

      statusCommand({});

      const warnings = allMessages(logWarnSpy);
      expect(warnings.some((m) => m.includes("Prisma schema"))).toBe(true);
    });

    it("uses --schema flag path when provided", () => {
      const customDir = join(tmpDir, "custom");
      mkdirSync(customDir, { recursive: true });
      const schemaPath = join(customDir, "schema.prisma");
      writeFileSync(schemaPath, FULL_SCHEMA);
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      createApiRoute(tmpDir);

      statusCommand({ schema: schemaPath });

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("Prisma schema"))).toBe(true);
    });
  });

  describe("API route detection", () => {
    it("reports success when API route exists at app/api/siteping/route.ts", () => {
      createPackageJson(tmpDir);
      createApiRoute(tmpDir);

      statusCommand({});

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("API route"))).toBe(true);
    });

    it("reports success when API route exists at src/app/api/siteping/route.ts", () => {
      createPackageJson(tmpDir);
      const routeDir = join(tmpDir, "src", "app", "api", "siteping");
      mkdirSync(routeDir, { recursive: true });
      writeFileSync(join(routeDir, "route.ts"), "export const GET = () => {};");

      statusCommand({});

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("API route"))).toBe(true);
    });

    it("reports error when no API route is found", () => {
      createPackageJson(tmpDir);

      statusCommand({});

      const errors = allMessages(logErrorSpy);
      expect(errors.some((m) => m.includes("API route"))).toBe(true);
    });
  });

  describe("Package detection", () => {
    it("reports success when @siteping/widget is in dependencies", () => {
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });

      statusCommand({});

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("@siteping/widget"))).toBe(true);
    });

    it("reports success when @siteping/widget is in devDependencies", () => {
      createPackageJson(tmpDir, {}, { "@siteping/widget": "^1.0.0" });

      statusCommand({});

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("@siteping/widget"))).toBe(true);
    });

    it("reports error when @siteping/widget is not in any dependencies", () => {
      createPackageJson(tmpDir, { "some-other-package": "^1.0.0" });

      statusCommand({});

      const errors = allMessages(logErrorSpy);
      expect(errors.some((m) => m.includes("@siteping/widget"))).toBe(true);
    });

    it("reports error when package.json does not exist", () => {
      // No createPackageJson call

      statusCommand({});

      const errors = allMessages(logErrorSpy);
      expect(errors.some((m) => m.includes("package.json"))).toBe(true);
    });
  });

  describe("Widget integration detection", () => {
    it("reports success when initSiteping is found in source files", () => {
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      createWidgetUsage(tmpDir);

      statusCommand({});

      const successes = allMessages(logSuccessSpy);
      expect(successes.some((m) => m.includes("Widget"))).toBe(true);
    });

    it("reports warning when initSiteping is not found in source files", () => {
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });

      statusCommand({});

      const warnings = allMessages(logWarnSpy);
      expect(warnings.some((m) => m.includes("Widget"))).toBe(true);
    });
  });

  describe("Overall status", () => {
    it("does not exit(1) when everything is properly configured", () => {
      createPrismaSchema(tmpDir, FULL_SCHEMA);
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      createApiRoute(tmpDir);
      createWidgetUsage(tmpDir);

      statusCommand({});

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("exits with code 1 when critical elements are missing", () => {
      // No schema, no package.json, no route

      statusCommand({});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("does not exit(1) when schema has warnings but no hard errors", () => {
      createPrismaSchema(tmpDir, PARTIAL_SCHEMA);
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      createApiRoute(tmpDir);

      statusCommand({});

      // Warnings should not cause exit(1)
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("exits with code 1 when schema exists but no API route", () => {
      createPrismaSchema(tmpDir, FULL_SCHEMA);
      createPackageJson(tmpDir, { "@siteping/widget": "^1.0.0" });
      // No API route

      statusCommand({});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with code 1 when widget package is missing from deps", () => {
      createPrismaSchema(tmpDir, FULL_SCHEMA);
      createPackageJson(tmpDir, { "other-pkg": "^1.0.0" });
      createApiRoute(tmpDir);

      statusCommand({});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
