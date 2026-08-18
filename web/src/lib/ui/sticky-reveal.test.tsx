import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StickyReveal } from "./sticky-reveal";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

describe("StickyReveal", () => {
  it("slides away scrolling down and back in scrolling up", async () => {
    render(
      <StickyReveal>
        <p>banner</p>
      </StickyReveal>,
    );
    const wrapper = screen.getByTestId("sticky-reveal");
    expect(wrapper.className).toContain("translate-y-0");

    scrollTo(200);
    await waitFor(() => expect(wrapper.className).toContain("-translate-y-"));

    scrollTo(120);
    await waitFor(() => expect(wrapper.className).toContain("translate-y-0"));
  });

  it("shows at the top regardless of the last direction", async () => {
    render(
      <StickyReveal>
        <p>banner</p>
      </StickyReveal>,
    );
    const wrapper = screen.getByTestId("sticky-reveal");
    scrollTo(300);
    await waitFor(() => expect(wrapper.className).toContain("-translate-y-"));
    scrollTo(0);
    await waitFor(() => expect(wrapper.className).toContain("translate-y-0"));
  });
});
