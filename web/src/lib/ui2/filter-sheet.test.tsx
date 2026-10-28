import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterFoot, FilterSection, FilterTrigger, triggerName } from "./filter-sheet";

// `FeedFilter.jsx` `FilterTrigger` / `FilterFoot`; `OrderSection.jsx` `FilterSection`.
describe("the filter idiom's parts", () => {
  it("names the trigger by its reading, then its purpose", () => {
    expect(triggerName("Everything", "What your history shows")).toBe("Everything, what your history shows");
    expect(triggerName("Tags", "")).toBe("Tags");
  });

  it("draws the trigger as a worded outlined pill that opens its sheet", () => {
    const onOpen = vi.fn();
    render(
      <FilterTrigger
        reading="Everything"
        purpose="What your history shows"
        expanded={false}
        onOpen={onOpen}
        node={{ path: "history.filterTrigger" }}
      />,
    );
    const trigger = screen.getByTestId("history.filterTrigger");
    expect(trigger).toHaveTextContent("Everything");
    expect(trigger).toHaveAccessibleName("Everything, what your history shows");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.className).toContain("border-outline");
    expect(trigger.className).toContain("h-8");
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("draws a section's label, its hint and its controls", () => {
    render(
      <FilterSection label="Kinds" hint="Combine as many as you like." node={{ path: "history.filterSheet.kinds" }}>
        <button type="button">Posts</button>
      </FilterSection>,
    );
    expect(screen.getByTestId("history.filterSheet.kinds.label")).toHaveTextContent("Kinds");
    expect(screen.getByTestId("history.filterSheet.kinds.hint")).toHaveTextContent("Combine as many as you like.");
    expect(screen.getByRole("group", { name: "Kinds" })).toContainElement(screen.getByText("Posts"));
  });

  it("ends on Reset in the corner and Done at the end, with no reading", () => {
    const onReset = vi.fn();
    const onDone = vi.fn();
    render(<FilterFoot onReset={onReset} onDone={onDone} node={{ path: "history.filterSheet.foot" }} />);
    const foot = screen.getByTestId("history.filterSheet.foot");
    expect(foot.textContent).toBe("ResetDone");
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.reset"));
    fireEvent.click(screen.getByTestId("history.filterSheet.foot.done"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
