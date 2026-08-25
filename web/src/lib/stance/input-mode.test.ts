import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_STANCE_INPUT_MODE,
  readStanceInputMode,
  useStanceInputMode,
  writeStanceInputMode,
} from "./input-mode";

beforeEach(() => {
  window.localStorage.clear();
});

describe("the stance input preference", () => {
  it("starts on the pad", () => {
    expect(DEFAULT_STANCE_INPUT_MODE).toBe("pad");
    expect(readStanceInputMode()).toBe("pad");
  });

  it("survives a reload", () => {
    writeStanceInputMode("entry");
    expect(readStanceInputMode()).toBe("entry");
  });

  it("falls back to the pad on a value it does not recognise", () => {
    window.localStorage.setItem("cogra.stanceInputMode", "telepathy");
    expect(readStanceInputMode()).toBe("pad");
  });

  it("replaces the pad for every mounted control at once, not per screen", () => {
    const first = renderHook(() => useStanceInputMode());
    const second = renderHook(() => useStanceInputMode());
    act(() => {
      first.result.current[1]("sliders");
    });
    expect(first.result.current[0]).toBe("sliders");
    expect(second.result.current[0]).toBe("sliders");
  });

  it("follows the choice made in another tab", () => {
    const { result } = renderHook(() => useStanceInputMode());
    act(() => {
      // `storage` is the browser's own cross-tab signal; it never fires
      // in the tab that wrote, so this is the other tab's write arriving.
      window.localStorage.setItem("cogra.stanceInputMode", "entry");
      window.dispatchEvent(new StorageEvent("storage", { key: "cogra.stanceInputMode" }));
    });
    expect(result.current[0]).toBe("entry");
  });
});
