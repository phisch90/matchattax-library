/**
 * Tests für die reine Logik (Aufstellungen, Teamregeln, Werte, Saisons, Adressen,
 * Sicherungsformat). Die Oberfläche wird im gebauten Bogen geprüft (`pnpm e2e`),
 * nicht in einem nachgebauten DOM.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify("testcommit"),
    __APP_BUILT_AT__: JSON.stringify("2026-10-06T12:00:00.000Z"),
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
