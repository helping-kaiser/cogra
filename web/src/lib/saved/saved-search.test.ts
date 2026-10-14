import { describe, expect, it } from "vitest";

import { matches, parseQuery, titleMatches, type Searchable } from "./saved-search";

const POST: Searchable = {
  kind: "post",
  authorHandle: "ada",
  title: "The long way home",
  tags: ["coastroad"],
};
const UNTITLED: Searchable = { kind: "post", authorHandle: "ada", title: null, tags: [] };
const COMMENT: Searchable = {
  kind: "comment",
  authorHandle: "tobias",
  rootTitle: "The long way home",
  tags: ["glovebox"],
};
const PERSON: Searchable = { kind: "person", handle: "mira", displayName: "Mira Voss" };

const hit = (item: Searchable, query: string) => matches(item, parseQuery(query));

describe("parseQuery", () => {
  it("a_blank_query_narrows_nothing", () => {
    expect(parseQuery("   ")).toEqual({ kind: "blank" });
    expect(hit(POST, "")).toBe(true);
    expect(hit(COMMENT, "  ")).toBe(true);
  });

  it("only_a_leading_sigil_is_a_scope", () => {
    expect(parseQuery("  @ada  long way ")).toEqual({
      kind: "scoped",
      scope: "handle",
      name: "ada",
      remainder: "long way",
    });
    expect(parseQuery("#salt")).toEqual({ kind: "scoped", scope: "tag", name: "salt", remainder: null });
    expect(parseQuery("long @ada")).toEqual({ kind: "unscoped", text: "long @ada" });
  });
});

describe("unscoped text — names and titles, never bodies", () => {
  it("a_post_matches_by_title_word_the_last_as_a_prefix", () => {
    expect(hit(POST, "long")).toBe(true);
    expect(hit(POST, "way ho")).toBe(true);
    expect(hit(POST, "LONG WAY")).toBe(true);
    // Every word is required, and only the last is a prefix.
    expect(hit(POST, "lon way")).toBe(false);
    expect(hit(POST, "short way")).toBe(false);
  });

  it("an_untitled_post_is_never_matched_by_its_stand_in", () => {
    expect(hit(UNTITLED, "ada")).toBe(false);
    expect(hit(UNTITLED, "pictures")).toBe(false);
  });

  it("a_comment_is_never_matched_unscoped", () => {
    expect(hit(COMMENT, "long way")).toBe(false);
    expect(hit(COMMENT, "tobias")).toBe(false);
  });

  it("a_person_matches_by_handle_or_display_name_substring", () => {
    expect(hit(PERSON, "mir")).toBe(true);
    expect(hit(PERSON, "voss")).toBe(true);
    expect(hit(PERSON, "a vo")).toBe(true);
    expect(hit(PERSON, "honey")).toBe(false);
  });

  it("a_query_with_no_word_matches_no_title", () => {
    expect(titleMatches("The long way home", "—")).toBe(false);
  });
});

describe("@handle — one person's own things", () => {
  it("a_bare_handle_narrows_to_the_people_whose_handle_starts_with_it", () => {
    expect(hit(PERSON, "@mi")).toBe(true);
    // Never anyone's contents, and never by display name.
    expect(hit(POST, "@ada")).toBe(false);
    expect(hit(COMMENT, "@tobias")).toBe(false);
    expect(hit(PERSON, "@voss")).toBe(false);
    // A lone sigil proposes no one.
    expect(hit(PERSON, "@")).toBe(false);
  });

  it("the_remainder_matches_their_posts_by_title", () => {
    expect(hit(POST, "@ada long")).toBe(true);
    expect(hit(POST, "@ADA long")).toBe(true);
    expect(hit(POST, "@tobias long")).toBe(false);
  });

  it("a_comment_matches_through_its_thread_root_title", () => {
    expect(hit(COMMENT, "@tobias way home")).toBe(true);
    expect(hit(COMMENT, "@ada way home")).toBe(false);
  });

  it("the_person_s_own_card_never_answers_a_content_search", () => {
    expect(hit(PERSON, "@mira voss")).toBe(false);
  });
});

describe("#tag — the things that carry it", () => {
  it("a_bare_tag_matches_nothing_because_a_tag_is_never_saved", () => {
    expect(hit(POST, "#coastroad")).toBe(false);
    expect(hit(COMMENT, "#glovebox")).toBe(false);
    expect(hit(PERSON, "#mira")).toBe(false);
  });

  it("the_remainder_matches_carried_posts_by_title_and_carried_comments_through_their_target", () => {
    expect(hit(POST, "#coastroad long")).toBe(true);
    expect(hit(POST, "#CoastRoad long")).toBe(true);
    expect(hit(COMMENT, "#glovebox home")).toBe(true);
    expect(hit(POST, "#glovebox long")).toBe(false);
    expect(hit(COMMENT, "#glovebox short")).toBe(false);
  });

  it("a_name_no_tag_can_carry_scopes_to_nothing", () => {
    expect(hit(POST, "##coastroad long")).toBe(false);
  });
});
