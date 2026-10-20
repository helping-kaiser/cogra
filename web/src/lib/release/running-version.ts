// THE VERSION RUNNING HERE — the one source its three readers share: the
// Settings `What's new` row's value (Settings.md, "the What's new row reads
// the version running here"), the `installed` dateline on What's new
// (WhatsNew.md, "it is the version the settings row reads") and the
// cold-open announcer. One module, so the row and the page cannot disagree.
//
// `web/package.json`'s version, inlined into the bundle at build time
// (`next.config.ts` `env`; Next docs, `next.config.js` `env`): a tab runs
// the build it loaded, and that build knows the version it was built as.

/** The version this bundle was built as; empty when the build was not told. */
export const RUNNING_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
