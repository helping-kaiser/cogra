import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    server: {
      deps: {
        // material-color-utilities ships ESM with extensionless relative
        // imports, which Node cannot resolve; inlining hands it to Vite's
        // resolver instead. Only the token generator imports it.
        inline: ["@material/material-color-utilities"],
      },
    },
  },
});
