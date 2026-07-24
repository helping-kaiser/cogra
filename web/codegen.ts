import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "src/lib/graphql/**/*.graphql"],
  // The scaffold ships no operations yet; the first slice adds them.
  ignoreNoDocuments: true,
  generates: {
    "src/__generated__/": {
      preset: "client",
    },
  },
};

export default config;
