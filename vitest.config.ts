import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // CI runs in UTC. Pinning it here means a test (for example the daylight-saving one) gives the same answer on a
    // developer's laptop in any time zone instead of passing in CI and failing locally.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
