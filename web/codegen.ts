import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "src/lib/graphql/**/*.graphql"],
  // The scaffold ships no operations yet; the first slice adds them.
  ignoreNoDocuments: true,
  generates: {
    "src/__generated__/": {
      preset: "client",
      config: {
        // The JSON wire form of both scalars is a string; without the
        // mapping the preset emits `unknown` (client preset docs,
        // config.scalars).
        scalars: {
          UUID: "string",
          DateTime: "string",
          // A float in the closed interval [-1.0, +1.0] on the wire
          // (api-spec.md § Scalars).
          Dimension: "number",
        },
      },
    },
  },
};

export default config;
