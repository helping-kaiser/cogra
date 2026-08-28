// `apollo-upload-client` ships JSDoc-typed `.mjs` with no `.d.ts`, and its
// DefinitelyTyped package still describes the v18 `createUploadLink` factory
// rather than the v20 class — so it would type the wrong shape. TypeScript's own
// remedy for an untyped module is a local declaration, and that is what this is:
// narrow to what the app actually constructs, so a wrong option is still a
// compile error rather than an `any`.
//
// The package is a terminating Apollo Link, so the declared type is `ApolloLink`
// and nothing else about the link's behaviour is asserted here.

declare module "apollo-upload-client/UploadHttpLink.mjs" {
  import { ApolloLink } from "@apollo/client";

  export default class UploadHttpLink extends ApolloLink {
    constructor(options?: {
      uri?: string;
      useGETForQueries?: boolean;
      isExtractableFile?: (value: unknown) => boolean;
      FormData?: typeof FormData;
      formDataAppendFile?: (formData: FormData, fieldName: string, file: unknown) => void;
      print?: unknown;
      fetch?: typeof fetch;
      fetchOptions?: RequestInit;
      credentials?: string;
      headers?: Record<string, string>;
      includeExtensions?: boolean;
    });
  }
}
