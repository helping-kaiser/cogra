import { describe, expect, it } from "vitest";

import { bandLine, confirmedBody, deletionSentence, mailBody, pendingBody, settingsRowStatus } from "./deletion-copy";

const NOW = Date.parse("2026-10-01T12:00:00");
const DEADLINE = "2026-10-08T00:00:00";
const deletion = (includesContent: boolean) => ({ scheduledFor: DEADLINE, includesContent });

describe("the deletion's words", () => {
  it("band_line_names_what_is_going", () => {
    expect(bandLine(deletion(false), NOW)).toBe("Your account is deleted in 7 days.");
    expect(bandLine(deletion(true), NOW)).toBe("Your account and everything you posted are deleted in 7 days.");
  });

  it("landing_heading_is_the_band_sentence_without_the_stop", () => {
    expect(deletionSentence(deletion(false), NOW)).toBe("Your account is deleted in 7 days");
  });

  it("settings_row_reads_the_forward_ladder", () => {
    expect(settingsRowStatus(deletion(false), Date.parse("2026-10-07T20:00:00"))).toBe("Deletion in 4 hours");
  });

  it("pending_and_confirmed_spell_the_deadline_date", () => {
    expect(pendingBody(deletion(false), Date.parse("2026-10-02T00:00:00"))).toBe(
      "Your account is deleted in 6 days, on 08.10.2026. Until then nothing has changed, and canceling keeps everything as it is.",
    );
    expect(confirmedBody(deletion(false))).toBe(
      "That's 08.10.2026. Until then nothing changes, and you can cancel from any device.",
    );
  });

  it("mail_names_the_address", () => {
    expect(mailBody("sol@solferreira.art")).toBe(
      "We sent a link to sol@solferreira.art. Opening it confirms the deletion and starts the seven days.",
    );
  });
});
