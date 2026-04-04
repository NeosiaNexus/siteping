import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  globalName: "SitePing",
  platform: "browser",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  noExternal: ["@medv/finder", "@siteping/core"],
});
