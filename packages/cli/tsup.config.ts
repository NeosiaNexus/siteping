import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
  dts: false,
  sourcemap: true,
  clean: true,
  noExternal: ["@siteping/core", "commander", "@clack/prompts", "@mrleebo/prisma-ast"],
});
