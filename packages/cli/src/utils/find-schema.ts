import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Locate the Prisma schema file by checking common paths.
 * Returns the first match or null if none found.
 */
export function findPrismaSchema(cwd: string): string | null {
  const candidates = [
    join(cwd, "prisma", "schema.prisma"),
    join(cwd, "schema.prisma"),
    join(cwd, "prisma", "schema", "schema.prisma"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}
