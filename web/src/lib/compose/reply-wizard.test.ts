import { describe, expect, it } from "vitest";

import { PUBLIC_DOMAIN } from "@/lib/license";
import { newReferenceDraft } from "@/lib/references/draft";
import { COMMENT_ATTACHMENT_CAP } from "./comment-media";
import {
  advanceGate,
  DEFAULT_REPLY_STANCE,
  emptyReply,
  nextStep,
  previousStep,
  replyActLabel,
  replyReducer,
  replySummary,
  sealGate,
  signedActions,
  type ReplyAction,
  type ReplyState,
  type ReplyTarget,
} from "./reply-wizard";

const POST_TARGET: ReplyTarget = {
  id: "post-1",
  kind: "post",
  label: "The long way home",
  authorHandle: "ada",
  authorName: "Ada Okonkwo",
  avatarUrl: null,
  snippet: "The light does something at the third headland…",
};

const COMMENT_TARGET: ReplyTarget = {
  ...POST_TARGET,
  id: "comment-1",
  kind: "comment",
  label: "Tobias Lindqvist",
  authorHandle: "tobias",
  authorName: "Tobias Lindqvist",
  snippet: "That stretch after the second bend…",
};

function reduce(state: ReplyState, ...actions: readonly ReplyAction[]): ReplyState {
  return actions.reduce(replyReducer, state);
}

function withWords(words = "Something worth saying."): ReplyState {
  return reduce(emptyReply(POST_TARGET), { type: "words", words });
}

function picked(count: number): readonly { id: string; file: Blob }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `asset-${index}`,
    file: new Blob(["x"], { type: "image/jpeg" }),
  }));
}

describe("emptyReply", () => {
  it("opens on the composer, pinned to what it answers", () => {
    const state = emptyReply(POST_TARGET);
    expect(state.step).toBe("compose");
    expect(state.target).toEqual(POST_TARGET);
  });

  it("starts at the policy stance the seal shows before anyone opens the pad", () => {
    expect(emptyReply(POST_TARGET).stance).toEqual({ pDirected: 0.1, pInterest: 0.1 });
    expect(DEFAULT_REPLY_STANCE).toEqual({ pDirected: 0.1, pInterest: 0.1 });
  });

  it("starts with no pictures, no topics, no citations and the default license", () => {
    const state = emptyReply(POST_TARGET);
    expect(state.media).toEqual([]);
    expect(state.tags).toEqual([]);
    expect(state.references).toEqual([]);
    expect(state.license).toEqual(PUBLIC_DOMAIN);
  });
});

describe("the two stages", () => {
  it("runs composer then seal, and the seal is the end of the sequence", () => {
    const composer = withWords();
    expect(nextStep(composer)).toBe("seal");
    const seal = replyReducer(composer, { type: "advance" });
    expect(seal.step).toBe("seal");
    expect(nextStep(seal)).toBeNull();
  });

  it("has nothing before the composer — the arrow leaves for the thread", () => {
    expect(previousStep(emptyReply(POST_TARGET))).toBeNull();
  });

  it("steps back to the composer from the seal", () => {
    const seal = reduce(withWords(), { type: "advance" });
    expect(replyReducer(seal, { type: "back" }).step).toBe("compose");
  });
});

describe("the gate", () => {
  it("refuses a wordless comment — the words are the mandatory half", () => {
    const gate = advanceGate(emptyReply(POST_TARGET));
    expect(gate.ok).toBe(false);
    expect(gate.ok === false && gate.reason).toBe("A comment needs words.");
  });

  it("refuses whitespace as words", () => {
    expect(advanceGate(withWords("   \n  ")).ok).toBe(false);
  });

  it("lets words alone through — the pictures are the optional half", () => {
    expect(advanceGate(withWords()).ok).toBe(true);
  });

  it("holds the seal while a picture is still on its way", () => {
    const state = reduce(withWords(), { type: "pick", assets: picked(1) });
    const gate = sealGate(state);
    expect(gate.ok).toBe(false);
    expect(gate.ok === false && gate.reason).toBe("One picture is still uploading.");
  });

  it("opens once every picture has landed", () => {
    const state = reduce(
      withWords(),
      { type: "pick", assets: picked(1) },
      { type: "upload", id: "asset-0", upload: { kind: "done", mediaId: "m1" } },
    );
    expect(sealGate(state).ok).toBe(true);
  });

  it("names a failed upload rather than refusing silently", () => {
    const state = reduce(
      withWords(),
      { type: "pick", assets: picked(1) },
      {
        type: "upload",
        id: "asset-0",
        upload: { kind: "failed", message: "no", retryable: true },
      },
    );
    const gate = sealGate(state);
    expect(gate.ok === false && gate.reason).toBe("One picture didn't upload.");
  });
});

describe("advancing", () => {
  it("refuses to leave a composer the gate is holding", () => {
    const state = replyReducer(emptyReply(POST_TARGET), { type: "advance" });
    expect(state.step).toBe("compose");
  });
});

describe("the pictures", () => {
  it("takes picks into the tray", () => {
    const state = reduce(withWords(), { type: "pick", assets: picked(2) });
    expect(state.media).toHaveLength(2);
  });

  it("stops at four — the cap is a comment's, not a post's", () => {
    const state = reduce(withWords(), { type: "pick", assets: picked(6) });
    expect(state.media).toHaveLength(COMMENT_ATTACHMENT_CAP);
  });

  it("drops the one whose × was pressed", () => {
    const state = reduce(
      withWords(),
      { type: "pick", assets: picked(2) },
      { type: "unpick", id: "asset-0" },
    );
    expect(state.media.map((asset) => asset.id)).toEqual(["asset-1"]);
  });

  it("keeps each picture's own description", () => {
    const state = reduce(
      withWords(),
      { type: "pick", assets: picked(2) },
      { type: "altText", id: "asset-1", altText: "A film camera" },
    );
    expect(state.media[0]?.altText).toBe("");
    expect(state.media[1]?.altText).toBe("A film camera");
  });
});

describe("the stance", () => {
  it("takes the pad's pick", () => {
    const state = replyReducer(withWords(), {
      type: "stance",
      stance: { pDirected: -0.4, pInterest: 0.6 },
    });
    expect(state.stance).toEqual({ pDirected: -0.4, pInterest: 0.6 });
  });

  it("clamps to the contract's closed interval rather than trusting the caller", () => {
    const state = replyReducer(withWords(), {
      type: "stance",
      stance: { pDirected: 4, pInterest: -9 },
    });
    expect(state.stance).toEqual({ pDirected: 1, pInterest: -1 });
  });
});

describe("what it signs", () => {
  it("counts the comment alone as one act", () => {
    expect(signedActions(withWords())).toBe(1);
  });

  it("counts a topic and a citation as their own acts", () => {
    const state = reduce(
      withWords(),
      { type: "tags", tags: [{ name: "coastroad", relevance: 1, confidence: 1 }] },
      {
        type: "references",
        references: [
          newReferenceDraft("post-2", { kind: "Post", label: "Salt maps", href: "/posts/post-2" }),
        ],
      },
    );
    expect(signedActions(state)).toBe(3);
  });

  it("counts pictures as no acts at all — attaching mints nothing", () => {
    const state = reduce(withWords(), { type: "pick", assets: picked(4) });
    expect(signedActions(state)).toBe(1);
  });
});

describe("the seal's words", () => {
  it("says what is answered and how long the answer is", () => {
    expect(replySummary(withWords("Four"))).toBe('Reply to "The long way home" — 4 characters.');
  });

  it("counts one character without pluralising", () => {
    expect(replySummary(withWords("x"))).toBe('Reply to "The long way home" — 1 character.');
  });

  it("counts the trimmed words, not the whitespace around them", () => {
    expect(replySummary(withWords("  abc  "))).toBe(
      'Reply to "The long way home" — 3 characters.',
    );
  });

  it("names the post it answers on the acts row", () => {
    expect(replyActLabel(POST_TARGET)).toBe("Reply to @ada's post");
  });

  it("names the comment it answers when the reply was pre-targeted", () => {
    expect(replyActLabel(COMMENT_TARGET)).toBe("Reply to @tobias's comment");
  });
});
