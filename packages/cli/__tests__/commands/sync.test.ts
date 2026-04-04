import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCommand } from "../../src/commands/sync.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`;

const SCHEMA_WITH_PARTIAL_MODEL = `
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

// ---------------------------------------------------------------------------
// Tests — integration style: real syncPrismaModels, spied clack output
// ---------------------------------------------------------------------------

describe("syncCommand", () => {
  let tmpDir: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logErrorSpy: ReturnType<typeof vi.spyOn>;
  let logInfoSpy: ReturnType<typeof vi.spyOn>;
  let logSuccessSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "siteping-sync-test-"));
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    logErrorSpy = vi.spyOn(p.log, "error").mockImplementation(() => {});
    logInfoSpy = vi.spyOn(p.log, "info").mockImplementation(() => {});
    logSuccessSpy = vi.spyOn(p.log, "success").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    exitSpy.mockRestore();
    logErrorSpy.mockRestore();
    logInfoSpy.mockRestore();
    logSuccessSpy.mockRestore();
  });

  it("exits with code 1 when --schema points to a nonexistent file", () => {
    const schemaPath = join(tmpDir, "does-not-exist.prisma");

    syncCommand({ schema: schemaPath });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logErrorSpy).toHaveBeenCalled();
  });

  it("uses the specified --schema path for syncing", () => {
    const schemaPath = join(tmpDir, "custom.prisma");
    writeFileSync(schemaPath, MINIMAL_SCHEMA);

    syncCommand({ schema: schemaPath });

    // Should succeed without exit(1)
    expect(exitSpy).not.toHaveBeenCalled();
    // Models should have been created
    expect(logSuccessSpy).toHaveBeenCalledWith(expect.stringContaining("SitepingFeedback"));
  });

  it("adds both models to an empty schema", () => {
    const schemaPath = join(tmpDir, "schema.prisma");
    writeFileSync(schemaPath, MINIMAL_SCHEMA);

    syncCommand({ schema: schemaPath });

    expect(logSuccessSpy).toHaveBeenCalledWith(expect.stringContaining("SitepingFeedback"));
    expect(logSuccessSpy).toHaveBeenCalledWith(expect.stringContaining("SitepingAnnotation"));
    expect(exitSpy).not.toHaveBeenCalled();

    // Verify file was actually modified
    const output = readFileSync(schemaPath, "utf-8");
    expect(output).toContain("model SitepingFeedback");
    expect(output).toContain("model SitepingAnnotation");
  });

  it("reports field-level changes on a partial schema", () => {
    const schemaPath = join(tmpDir, "schema.prisma");
    writeFileSync(schemaPath, SCHEMA_WITH_PARTIAL_MODEL);

    syncCommand({ schema: schemaPath });

    // SitepingAnnotation is new, should appear in model creation log
    expect(logSuccessSpy).toHaveBeenCalledWith(expect.stringContaining("SitepingAnnotation"));
    // Field additions should be logged (e.g. status, url, etc.)
    expect(logSuccessSpy).toHaveBeenCalledWith(expect.stringContaining("status"));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("reports schema already up-to-date when run twice", () => {
    const schemaPath = join(tmpDir, "schema.prisma");
    writeFileSync(schemaPath, MINIMAL_SCHEMA);

    // First sync creates models
    syncCommand({ schema: schemaPath });
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    logInfoSpy = vi.spyOn(p.log, "info").mockImplementation(() => {});
    logSuccessSpy = vi.spyOn(p.log, "success").mockImplementation(() => {});

    // Second sync should report no changes
    syncCommand({ schema: schemaPath });

    expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining("up to date"));
    // No success log for created models on second run
    expect(logSuccessSpy).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("reminds the user to run prisma db push after successful sync", () => {
    const schemaPath = join(tmpDir, "schema.prisma");
    writeFileSync(schemaPath, MINIMAL_SCHEMA);

    syncCommand({ schema: schemaPath });

    expect(logInfoSpy).toHaveBeenCalledWith(expect.stringContaining("prisma db push"));
  });

  it("preserves existing user models when syncing", () => {
    const schemaPath = join(tmpDir, "schema.prisma");
    writeFileSync(
      schemaPath,
      `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    String @id @default(cuid())
  email String @unique
  name  String
}
`,
    );

    syncCommand({ schema: schemaPath });

    const output = readFileSync(schemaPath, "utf-8");
    expect(output).toContain("model User");
    expect(output).toContain("model SitepingFeedback");
    expect(output).toContain("model SitepingAnnotation");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("uses auto-detected schema path from prisma/ directory", () => {
    const prismaDir = join(tmpDir, "prisma");
    mkdirSync(prismaDir, { recursive: true });
    writeFileSync(join(prismaDir, "schema.prisma"), MINIMAL_SCHEMA);

    // Change cwd so findPrismaSchema can discover the file
    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      syncCommand({});

      expect(exitSpy).not.toHaveBeenCalled();
      expect(logSuccessSpy).toHaveBeenCalled();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("exits with code 1 when no schema found and no --schema flag", () => {
    // tmpDir has no prisma directory
    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      syncCommand({});

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(logErrorSpy).toHaveBeenCalled();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
