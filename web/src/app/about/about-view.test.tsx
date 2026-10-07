import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AboutView, TOPICS, topicKey } from "./about-view";

let search = new URLSearchParams("from=settings");
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));

const topic = (key: string) =>
  screen.getAllByTestId("about.topic").find((element) => element.getAttribute("data-testid-key") === key)!;
const row = (key: string) =>
  screen.getAllByTestId("about.topic.row").find((element) => element.getAttribute("data-testid-key") === key)!;

beforeEach(() => {
  search = new URLSearchParams("from=settings");
});

describe("About CoGra", () => {
  it("keys every topic the way the registry does", () => {
    expect(TOPICS.map((t) => topicKey(t.title))).toEqual([
      "what-this-is",
      "your-feed-is-your-own-steps",
      "everything-here-is-public",
      "an-opinion-says-two-things",
      "nothing-is-lost",
      "money-follows-the-reach-you-made",
      "getting-in-and-being-let-in",
      "your-key-is-yours",
      "this-page-grows",
    ]);
  });

  it("opens_with_every_topic_closed", () => {
    render(<AboutView />);
    expect(screen.getAllByTestId("about.topic")).toHaveLength(9);
    expect(screen.queryByTestId("about.topic.answer")).not.toBeInTheDocument();
    for (const button of screen.getAllByTestId("about.topic.row")) {
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("topics_open_and_fold_independently", () => {
    render(<AboutView />);
    fireEvent.click(row("what-this-is"));
    fireEvent.click(row("nothing-is-lost"));
    expect(row("what-this-is")).toHaveAttribute("aria-expanded", "true");
    expect(topic("what-this-is")).toHaveTextContent(
      "CoGra is a place to read and write in public",
    );
    expect(topic("nothing-is-lost")).toHaveTextContent("Nothing disappears quietly.");
    fireEvent.click(row("what-this-is"));
    expect(row("what-this-is")).toHaveAttribute("aria-expanded", "false");
    expect(row("nothing-is-lost")).toHaveAttribute("aria-expanded", "true");
  });

  it("back_reads_back_to_settings_from_settings", () => {
    render(<AboutView />);
    const back = screen.getByTestId("about.header.back");
    expect(back).toHaveAccessibleName("Back to settings");
    expect(back).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId("about.header.title")).toHaveTextContent("About CoGra");
  });

  it("reads a plain Back from any other door", () => {
    search = new URLSearchParams();
    render(<AboutView />);
    expect(screen.getByTestId("about.header.back")).toHaveAccessibleName("Back");
  });
});
