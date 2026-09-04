// The object-URL lifecycle. A `URL.createObjectURL` call holds its blob alive
// until it is revoked, so what these pin is arithmetic: one url per blob, and
// one revoke per url.

import { render, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CENTERED } from "@/lib/ui2/media/crop";
import { usePreviewUrls } from "./previews";
import type { PickedAsset } from "./wizard";

let minted: string[];
let revoked: string[];

beforeEach(() => {
  minted = [];
  revoked = [];
  let next = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    const url = `blob:test/${(next += 1)}`;
    minted.push(url);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function asset(id: string): PickedAsset {
  return {
    id,
    file: new Blob([new Uint8Array([7]) as BlobPart], { type: "image/webp" }),
    crop: CENTERED,
    altText: "",
    upload: { kind: "waiting" },
  };
}

function Previews({ assets }: { assets: readonly PickedAsset[] }) {
  const urls = usePreviewUrls(assets);
  return <span data-testid="urls">{Object.values(urls).join(",")}</span>;
}

describe("usePreviewUrls", () => {
  it("mints one url per asset", () => {
    render(<Previews assets={[asset("a"), asset("b")]} />);
    expect(minted).toHaveLength(2);
    expect(revoked).toEqual([]);
  });

  // React double-invokes render and effects in Strict Mode to surface impure
  // work. The mint used to sit inside a `setState` updater, so every newly
  // picked asset produced two urls and only one of them was ever revoked.
  it("mints once under Strict Mode, not twice", () => {
    render(
      <StrictMode>
        <Previews assets={[asset("a")]} />
      </StrictMode>,
    );
    expect(minted.filter((url) => !revoked.includes(url))).toHaveLength(1);
  });

  it("revokes an asset's url when it leaves the draft, and only that one", () => {
    const kept = asset("a");
    const dropped = asset("b");
    const view = render(<Previews assets={[kept, dropped]} />);
    const [keptUrl, droppedUrl] = minted;

    view.rerender(<Previews assets={[kept]} />);
    expect(revoked).toEqual([droppedUrl]);
    expect(view.getByTestId("urls").textContent).toBe(keptUrl);
  });

  it("revokes everything outstanding on unmount", () => {
    const view = render(<Previews assets={[asset("a"), asset("b")]} />);
    view.unmount();
    expect(revoked.sort()).toEqual(minted.sort());
  });

  // The wizard runs two of these at once — the picked assets and the offered
  // draft's — and continuing a draft hands the second hook's very blobs to the
  // first. Each hook holds its own url, so the offered card unmounting cannot
  // revoke one out from under the composer that is now showing it.
  it("does not hand two hooks one url for one blob", () => {
    const shared = asset("a");
    const offered = render(<Previews assets={[shared]} />);
    const adopted = render(<Previews assets={[shared]} />);
    expect(new Set(minted).size).toBe(2);

    const shown = within(adopted.container).getByTestId("urls").textContent;
    offered.unmount();
    expect(shown).not.toBe("");
    expect(revoked).not.toContain(shown);
  });
});
