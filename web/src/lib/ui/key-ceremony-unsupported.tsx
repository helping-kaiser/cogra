"use client";

// THIS BROWSER CAN'T HOLD A KEY (design/designs/canonical/screens/
// KeyCeremonyUnsupported.jsx; behavior/KeyCeremonyUnsupported.md): what stands
// in a key ceremony's place — the minting one or the restore — on a browser
// without WebCrypto Ed25519. Nothing failed, so it wears the key-absent
// notice's tertiary at a page's `large` corner, never `error`; it offers no
// commitment and no "?", because nothing on it can be done here; and the app
// is a real door, the login landing's own download in its own words.
//
// Its back arrow is a LINK to where the ceremony was opened from (the sidecar's
// back lines), never history — the caller names it.
//
// UNREGISTERED: nodes.json has no `KeyCeremonyUnsupported` screen yet, so the
// nodes wear the board's evident paths under `keyCeremonyUnsupported`, in the
// shape of `KeyCeremony`'s registered ones.

import { APK_HREF, APK_LINE } from "@/lib/ui/apk-download";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";

const SCREEN: DataNode = { path: "keyCeremonyUnsupported" };
const NOTICE = part(SCREEN, "notice");

export const KEY_UNSUPPORTED_TITLE = "This browser can't hold a key";
export const KEY_UNSUPPORTED_LINE = "Open CoGra in a current Chrome, Firefox or Safari, or in the Android app.";

export function KeyCeremonyUnsupported({ backHref }: { backHref: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <PageHeader backHref={backHref} backLabel="Back" node={part(SCREEN, "header")} />
      <div className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-2">
        <h1 className="m-0 text-headline-small" {...testAttributes(part(SCREEN, "title"))}>
          Your key
        </h1>
        <NoticePanel title={KEY_UNSUPPORTED_TITLE} corner="large" node={NOTICE}>
          <NoticeLine node={part(NOTICE, "body")}>{KEY_UNSUPPORTED_LINE}</NoticeLine>
          <a
            href={APK_HREF}
            download
            className="cg-state cg-focus self-start text-body-medium underline"
            {...testAttributes(part(NOTICE, "download"))}
          >
            {APK_LINE}
          </a>
        </NoticePanel>
      </div>
    </main>
  );
}
