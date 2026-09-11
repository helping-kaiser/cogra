// @vitest-environment node
// The numbers the backend exports and this app must not restate.
//
// `client-constants.json` at the repo root is generated from the Rust
// definitions (`make constants`); every figure below is a named constant
// in the module that uses it, pinned HERE to that file. The alternative
// — importing the JSON into production code — was rejected: the file
// lives outside the Next project root, so reaching it at runtime means
// either shipping the whole blob into the browser bundle or reading the
// filesystem from a client component, and neither buys anything a test
// does not. This mirrors `ui/design-tokens.test.ts`, which pins colour
// the same way and for the same reason: never transcribe a contract
// value, and fail loudly when the contract moves.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CONTENT_PAGE_SIZE } from "@/lib/api/content-api";
import { PROFILE_PAGE_SIZE } from "@/lib/api/profile-api";
import { COMMENT_ATTACHMENT_CAP } from "@/lib/compose/comment-media";
import {
  BODY_MAX_CHARS,
  DESCRIPTION_MAX_CHARS,
  POST_ATTACHMENT_CAP,
  SENSITIVE_REASON_MAX_CHARS,
  TITLE_MAX_CHARS,
} from "@/lib/compose/wizard";
import { COMMENT_BODY_MAX_CHARS } from "@/lib/compose/reply-wizard";
import {
  HANDLE_MAX_CHARS,
  HANDLE_MIN_CHARS,
  HANDLE_PATTERN,
  PASSWORD_MIN_CHARS,
} from "@/lib/onboarding/registration-rules";
import { BIO_MAX_CHARS, DISPLAY_NAME_MAX_CHARS, WEBSITE_URL_MAX_CHARS } from "@/lib/profile/caps";
import { TAP_DEFAULT } from "@/lib/stance/model";
import {
  SEAL_POLL_ATTEMPTS,
  SEAL_POLL_DELAY_MS,
  TERMINAL_REFUSALS,
} from "@/lib/signing/write-signer";
import {
  ALT_TEXT_MAX_CHARS,
  COMMENT_VIDEO_MAX_BYTES,
  PICTURE_MAX_BYTES,
  POST_VIDEO_MAX_BYTES,
  RESUMABLE_THRESHOLD_BYTES,
} from "@/lib/ui2/media/caps";

type Constants = {
  version: number;
  content: {
    titleChars: number;
    descriptionChars: number;
    postBodyChars: number;
    commentBodyChars: number;
    sensitiveReasonChars: number;
  };
  profile: {
    displayNameChars: number;
    bioChars: number;
    websiteUrlChars: number;
  };
  media: {
    altTextChars: number;
    commentAttachments: number;
    commentVideoBytes: number;
    maxPixelDimension: number;
    minMultipartPartBytes: number;
    postAttachments: number;
    postVideoBytes: number;
    resumableThresholdBytes: number;
    stillBytes: number;
  };
  paging: { defaultPageSize: number; maxPageSize: number };
  stance: { tapDefault: number };
  registration: {
    handleCharsetPattern: string;
    handleMaxChars: number;
    handleMinChars: number;
    passwordMinChars: number;
  };
  writeSigner: {
    sealPollAttempts: number;
    sealPollIntervalMs: number;
    terminalRefusals: string[];
  };
};

const constants = JSON.parse(
  readFileSync(new URL("../../../client-constants.json", import.meta.url), "utf-8"),
) as Constants;

// The shape this client reads, not how fresh the file is: a group
// renamed or restructured on the server fails here rather than as an
// undefined deep inside one of the expectations below.
describe("the contract file", () => {
  it("is the version this client reads", () => {
    expect(constants.version).toBe(1);
  });
});

describe("media caps", () => {
  it("match the contract", () => {
    expect(PICTURE_MAX_BYTES).toBe(constants.media.stillBytes);
    expect(POST_VIDEO_MAX_BYTES).toBe(constants.media.postVideoBytes);
    expect(COMMENT_VIDEO_MAX_BYTES).toBe(constants.media.commentVideoBytes);
    expect(RESUMABLE_THRESHOLD_BYTES).toBe(constants.media.resumableThresholdBytes);
  });

  it("cap the attachment counts the write side refuses past", () => {
    expect(POST_ATTACHMENT_CAP).toBe(constants.media.postAttachments);
    expect(COMMENT_ATTACHMENT_CAP).toBe(constants.media.commentAttachments);
  });

  it("cap a description at the length the write side refuses past", () => {
    expect(ALT_TEXT_MAX_CHARS).toBe(constants.media.altTextChars);
  });
});

describe("the authored text caps", () => {
  it("cap a title at the length the write side refuses past", () => {
    expect(TITLE_MAX_CHARS).toBe(constants.content.titleChars);
  });

  it("cap a post's description and words at the lengths the write side refuses past", () => {
    expect(DESCRIPTION_MAX_CHARS).toBe(constants.content.descriptionChars);
    expect(BODY_MAX_CHARS).toBe(constants.content.postBodyChars);
  });

  it("caps a comment's words at the length the write side refuses past", () => {
    expect(COMMENT_BODY_MAX_CHARS).toBe(constants.content.commentBodyChars);
  });

  it("caps a sensitive-mark reason at the length the write side refuses past", () => {
    expect(SENSITIVE_REASON_MAX_CHARS).toBe(constants.content.sensitiveReasonChars);
  });
});

describe("the profile's authored text caps", () => {
  it("cap the display name, bio and website URL at the lengths the write side refuses past", () => {
    expect(DISPLAY_NAME_MAX_CHARS).toBe(constants.profile.displayNameChars);
    expect(BIO_MAX_CHARS).toBe(constants.profile.bioChars);
    expect(WEBSITE_URL_MAX_CHARS).toBe(constants.profile.websiteUrlChars);
  });
});

describe("paging", () => {
  // Both listings ask for the server's own default page. Asking for a
  // different number would be a client opinion about a figure the
  // contract already states.
  it("asks for the contract's default page", () => {
    expect(CONTENT_PAGE_SIZE).toBe(constants.paging.defaultPageSize);
    expect(PROFILE_PAGE_SIZE).toBe(constants.paging.defaultPageSize);
  });
});

describe("the stance pad", () => {
  // Both axes, because the tap is one policy and not two: a default
  // that moved on one axis only would tilt every plain tap.
  it("commits the contract's low default on a plain tap", () => {
    expect(TAP_DEFAULT.pDirected).toBe(constants.stance.tapDefault);
    expect(TAP_DEFAULT.pInterest).toBe(constants.stance.tapDefault);
  });
});

describe("the write signer", () => {
  it("waits the contract's seal-poll budget", () => {
    expect(SEAL_POLL_ATTEMPTS).toBe(constants.writeSigner.sealPollAttempts);
    expect(SEAL_POLL_DELAY_MS).toBe(constants.writeSigner.sealPollIntervalMs);
  });

  // EQUALITY, NOT CONTAINMENT. A subset check passes while this build
  // treats a terminal refusal as retryable — which parks a spent write
  // forever — and it passes just as happily while the build clears
  // material the server would have accepted on a retry.
  it("spends material on exactly the contract's terminal refusals", () => {
    expect([...TERMINAL_REFUSALS].sort()).toEqual(
      [...constants.writeSigner.terminalRefusals].sort(),
    );
  });
});

describe("registration rules", () => {
  it("enforce the contract's handle and password rules", () => {
    expect(HANDLE_MIN_CHARS).toBe(constants.registration.handleMinChars);
    expect(HANDLE_MAX_CHARS).toBe(constants.registration.handleMaxChars);
    expect(PASSWORD_MIN_CHARS).toBe(constants.registration.passwordMinChars);
    expect(HANDLE_PATTERN.source).toBe(constants.registration.handleCharsetPattern);
  });
});
