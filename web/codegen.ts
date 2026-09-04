import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "src/lib/graphql/**/*.graphql"],
  // The scaffold ships no operations yet; the first slice adds them.
  ignoreNoDocuments: true,
  generates: {
    "src/__generated__/": {
      preset: "client",
      // Extracted fragments stay TYPE-TRANSPARENT. Masking is the
      // preset's default and it is the right default for a codebase
      // whose components each declare their own fragment — but the
      // fragments in `src/lib/graphql/fragments.graphql` exist to
      // de-duplicate one selection across documents, and a masked
      // spread would make every consumer of `post.attachments` thread a
      // `FragmentType<>` unmask to read a field it already had. The
      // client preset documents `fragmentMasking: false` for exactly
      // this (client-preset docs, `fragmentMasking`).
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        // The JSON wire form of both scalars is a string; without the
        // mapping the preset emits `unknown` (client preset docs,
        // config.scalars).
        scalars: {
          UUID: "string",
            RecordId: "string",
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
