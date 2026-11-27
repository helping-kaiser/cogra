// The two sidecars, line by line (design/designs/canonical/behavior/
// ReportProblem.md, ReportProblemEmpty.md).

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { raisedLayersForTests } from "@/lib/ui2/covering-layer";

import { useReportProblem } from "./report-problem-layer";
import { REPORT_ADDRESS, REPORT_NOTE } from "./report-problem";
import { ReportProblemView } from "./report-problem-view";

const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";

function open({
  at = [new Date(2026, 9, 1, 14, 32)],
  onBack = vi.fn(),
  openMail = vi.fn(),
}: { at?: Date[]; onBack?: () => void; openMail?: (url: string) => void } = {}) {
  const clock = [...at];
  const now = () => (clock.length > 1 ? clock.shift()! : clock[0]);
  const view = render(
    <ReportProblemView onBack={onBack} now={now} userAgent={FIREFOX_LINUX} version="0.1.2" openMail={openMail} />,
  );
  return { onBack, openMail, view };
}

const field = () => screen.getByTestId("reportProblem.words") as HTMLTextAreaElement;
const send = () => screen.getByTestId("reportProblem.send");
const body = (url: string) => new URLSearchParams(url.split("?")[1]).get("body");

afterEach(() => window.localStorage.clear());

describe("ReportProblem", () => {
  it("reads one field, What happened, at four lines, and no category or severity", () => {
    open();
    const box = screen.getByLabelText("What happened");
    expect(box.tagName).toBe("TEXTAREA");
    expect(box).toHaveAttribute("rows", "4");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("reads back the four facts between the field and Send by email, then the line", () => {
    open();
    const facts = screen.getByTestId("reportProblem.facts");
    const rows = within(facts).getAllByText(/^(To|Version|Running on|Time)$/).map((e) => e.textContent);
    expect(rows).toEqual(["To", "Version", "Running on", "Time"]);
    expect(facts).toHaveTextContent(REPORT_ADDRESS);
    expect(facts).toHaveTextContent("0.1.2");
    expect(facts).toHaveTextContent("Firefox on Linux");
    expect(facts).toHaveTextContent("01.10.2026, 14:32");
    expect(screen.getByTestId("reportProblem.note")).toHaveTextContent(REPORT_NOTE);
    const order = [field(), facts, screen.getByTestId("reportProblem.note"), send()];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("keeps its back arrow and carries no bottom bar", () => {
    const { onBack } = open();
    expect(screen.queryByRole("navigation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps Send by email enabled while typing and after the last character is deleted", () => {
    open();
    expect(send()).toBeEnabled();
    fireEvent.change(field(), { target: { value: "x" } });
    expect(send()).toBeEnabled();
    fireEvent.change(field(), { target: { value: "" } });
    expect(send()).toBeEnabled();
  });

  it("opens the reader's own mail with the words, the four facts and the address; Time is the press", () => {
    const { openMail } = open({ at: [new Date(2026, 9, 1, 14, 32), new Date(2026, 9, 1, 14, 40)] });
    fireEvent.change(field(), { target: { value: "The seal said this shouldn't have happened." } });
    fireEvent.click(send());
    expect(openMail).toHaveBeenCalledTimes(1);
    const url = vi.mocked(openMail).mock.calls[0][0];
    expect(url.startsWith(`mailto:${REPORT_ADDRESS}?`)).toBe(true);
    expect(body(url)).toBe(
      "The seal said this shouldn't have happened.\r\n\r\nVersion: 0.1.2\r\nRunning on: Firefox on Linux\r\nTime: 01.10.2026, 14:40",
    );
    expect(screen.getByTestId("reportProblem.facts")).toHaveTextContent("01.10.2026, 14:40");
  });

  it("sends nothing from CoGra: the press makes no network call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    open();
    fireEvent.click(send());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps the words through the handoff for the next time the report opens", () => {
    const first = open();
    fireEvent.change(field(), { target: { value: "kept words" } });
    fireEvent.click(send());
    first.view.unmount();
    open();
    expect(field().value).toBe("kept words");
  });

  it("keeps the words when Back leaves, and sends nothing", () => {
    const first = open();
    fireEvent.change(field(), { target: { value: "walked away" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(first.openMail).not.toHaveBeenCalled();
    first.view.unmount();
    open();
    expect(field().value).toBe("walked away");
  });
});

describe("ReportProblemEmpty", () => {
  it("opens empty with Send by email enabled when nothing was kept", () => {
    open();
    expect(field().value).toBe("");
    expect(send()).toBeEnabled();
  });

  it("stays enabled on only spaces and still reads back the facts and the line", () => {
    open();
    fireEvent.change(field(), { target: { value: "   " } });
    expect(send()).toBeEnabled();
    expect(screen.getByTestId("reportProblem.facts")).toHaveTextContent(REPORT_ADDRESS);
    expect(screen.getByTestId("reportProblem.note")).toBeInTheDocument();
  });

  it("opens the mail with the four facts and the address when the field is empty", () => {
    const { openMail } = open();
    fireEvent.click(send());
    const url = vi.mocked(openMail).mock.calls[0][0];
    expect(url.startsWith(`mailto:${REPORT_ADDRESS}?`)).toBe(true);
    expect(body(url)).toBe("Version: 0.1.2\r\nRunning on: Firefox on Linux\r\nTime: 01.10.2026, 14:32");
  });

  it("keeps no words when Back leaves an empty field", () => {
    const first = open();
    fireEvent.change(field(), { target: { value: "x" } });
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    first.view.unmount();
    open();
    expect(field().value).toBe("");
  });
});

describe("the report over a bug notice", () => {
  function Opener() {
    const [count, setCount] = useState(0);
    const { openReport, reportLayer } = useReportProblem();
    return (
      <>
        <p data-testid="opener-state">{count}</p>
        <button type="button" onClick={() => setCount(count + 1)}>
          bump
        </button>
        <button type="button" onClick={openReport}>
          Report a problem
        </button>
        {reportLayer}
      </>
    );
  }

  it("raises the same page over the opener, and Back returns the opener as it was", () => {
    render(<Opener />);
    fireEvent.click(screen.getByText("bump"));
    act(() => fireEvent.click(screen.getByText("Report a problem")));
    expect(screen.getByTestId("reportProblem.layer")).toBeInTheDocument();
    expect(screen.getByTestId("reportProblem")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByTestId("reportProblem.layer")).toBeNull();
    expect(screen.getByTestId("opener-state")).toHaveTextContent("1");
  });

  it("stands as a modal dialog that covers the surface, so a clip beneath stops", () => {
    render(<Opener />);
    expect(raisedLayersForTests()).toEqual([]);
    act(() => fireEvent.click(screen.getByText("Report a problem")));
    const layer = screen.getByTestId("reportProblem.layer");
    expect(layer.tagName).toBe("DIALOG");
    expect((layer as HTMLDialogElement).open).toBe(true);
    expect(raisedLayersForTests()).toEqual(["suspend"]);
    fireEvent.click(within(layer).getByRole("button", { name: "Back" }));
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("lowers on Escape or the system's Back, the dialog's cancel", () => {
    render(<Opener />);
    act(() => fireEvent.click(screen.getByText("Report a problem")));
    fireEvent(screen.getByTestId("reportProblem.layer"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByTestId("reportProblem.layer")).toBeNull();
  });

  it("hands focus back to Report a problem when it lowers", () => {
    render(<Opener />);
    const door = screen.getByText("Report a problem");
    door.focus();
    act(() => fireEvent.click(door));
    // showModal() hands focus into the dialog in a browser (the jsdom stub does not).
    const back = within(screen.getByTestId("reportProblem.layer")).getByRole("button", { name: "Back" });
    back.focus();
    fireEvent.click(back);
    expect(document.activeElement).toBe(door);
  });
});
