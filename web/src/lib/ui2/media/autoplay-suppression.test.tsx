// The device's autoplay-suppression signal (`autoplay-suppression.ts`):
// reduced motion OR data saver (FeedCover.md:23), read live. jsdom ships
// neither `matchMedia` nor the Network Information API, so both are stood in
// for here as the platform draws them — a MediaQueryList whose `change` event
// fires when the preference flips, and a connection that is an EventTarget.

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  isAutoplaySuppressed,
  prefersReducedMotion,
  savesData,
  useAutoplaySuppressed,
} from "./autoplay-suppression";

class FakeQuery extends EventTarget {
  constructor(public matches: boolean) {
    super();
  }

  /** The preference flips, and the list says so. */
  flip(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

class FakeConnection extends EventTarget {
  constructor(public saveData: boolean) {
    super();
  }

  flip(saveData: boolean) {
    this.saveData = saveData;
    this.dispatchEvent(new Event("change"));
  }
}

function stubReducedMotion(matches: boolean): FakeQuery {
  const query = new FakeQuery(matches);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (text: string) => {
      expect(text).toBe("(prefers-reduced-motion: reduce)");
      return query;
    },
  });
  return query;
}

function stubConnection(saveData: boolean): FakeConnection {
  const link = new FakeConnection(saveData);
  Object.defineProperty(navigator, "connection", { configurable: true, value: link });
  return link;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).matchMedia;
  delete (navigator as unknown as Record<string, unknown>).connection;
});

function Reader() {
  const suppressed = useAutoplaySuppressed();
  return <span data-testid="reader" data-suppressed={String(suppressed)} />;
}

const reads = () => screen.getByTestId("reader").dataset.suppressed;

describe("the snapshot", () => {
  it("allows autoplay where the device asks for neither (and where it cannot ask)", () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(savesData()).toBe(false);
    expect(isAutoplaySuppressed()).toBe(false);
  });

  it("suppresses under reduced motion", () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(isAutoplaySuppressed()).toBe(true);
  });

  it("suppresses under data saver", () => {
    stubReducedMotion(false);
    stubConnection(true);
    expect(savesData()).toBe(true);
    expect(isAutoplaySuppressed()).toBe(true);
  });
});

describe("the live signal", () => {
  it("follows the reduced-motion preference as it changes", () => {
    const query = stubReducedMotion(false);
    render(<Reader />);
    expect(reads()).toBe("false");

    act(() => query.flip(true));
    expect(reads()).toBe("true");
    act(() => query.flip(false));
    expect(reads()).toBe("false");
  });

  it("follows the data-saver request as it changes", () => {
    stubReducedMotion(false);
    const link = stubConnection(false);
    render(<Reader />);
    expect(reads()).toBe("false");

    act(() => link.flip(true));
    expect(reads()).toBe("true");
  });

  // TEARDOWN HYGIENE (the stage-law packet's §6 row).
  it("lets go of both sources when it unmounts", () => {
    const query = stubReducedMotion(false);
    const link = stubConnection(false);
    const removed: string[] = [];
    const watch = (target: EventTarget, name: string) => {
      const remove = target.removeEventListener.bind(target);
      target.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null) => {
        removed.push(`${name}:${type}`);
        remove(type, listener);
      };
    };
    watch(query, "query");
    watch(link, "connection");

    const { unmount } = render(<Reader />);
    unmount();

    expect(removed).toEqual(expect.arrayContaining(["query:change", "connection:change"]));
  });
});
