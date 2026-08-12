import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Re-listed defaults of eslint-config-next (globalIgnores overrides them):
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Codegen output — generated, not linted.
    "src/__generated__/**",
  ]),
]);

export default eslintConfig;
