// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findPrismaSchema } from "../../src/utils/find-schema.js";

describe("findPrismaSchema", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "siteping-schema-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Standard locations
  // -------------------------------------------------------------------------

  it("finds prisma/schema.prisma", () => {
    const schemaPath = join(tmpDir, "prisma", "schema.prisma");
    mkdirSync(join(tmpDir, "prisma"), { recursive: true });
    writeFileSync(schemaPath, "// schema");

    const result = findPrismaSchema(tmpDir);
    expect(result).toBe(schemaPath);
  });

  it("finds schema.prisma in current directory", () => {
    const schemaPath = join(tmpDir, "schema.prisma");
    writeFileSync(schemaPath, "// schema");

    const result = findPrismaSchema(tmpDir);
    expect(result).toBe(schemaPath);
  });

  it("finds prisma/schema/schema.prisma", () => {
    const schemaPath = join(tmpDir, "prisma", "schema", "schema.prisma");
    mkdirSync(join(tmpDir, "prisma", "schema"), { recursive: true });
    writeFileSync(schemaPath, "// schema");

    const result = findPrismaSchema(tmpDir);
    expect(result).toBe(schemaPath);
  });

  // -------------------------------------------------------------------------
  // Priority
  // -------------------------------------------------------------------------

  it("prefers prisma/schema.prisma over schema.prisma in root", () => {
    mkdirSync(join(tmpDir, "prisma"), { recursive: true });
    writeFileSync(join(tmpDir, "prisma", "schema.prisma"), "// prisma dir");
    writeFileSync(join(tmpDir, "schema.prisma"), "// root");

    const result = findPrismaSchema(tmpDir);
    expect(result).toBe(join(tmpDir, "prisma", "schema.prisma"));
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  it("returns null when no schema is found", () => {
    const result = findPrismaSchema(tmpDir);
    expect(result).toBeNull();
  });
});
