// WHICH READS CARRY A NODE'S CITATION LIST (api-spec.md "Query budgets"; jakob
// 2026-11-23). The list is a fold priced at fifty rows, 1 400 a card, so a card
// carries `referenceCount` and the rows are read by id when a surface that shows
// them opens. Exactly three documents select the list: the detail's own post,
// and the two by-id reads. A card document that grew it back would price every
// page it rides at the fold again, which is the cost this rule exists to stop.

import { Kind, visit, type DocumentNode } from "graphql";
import { describe, expect, it } from "vitest";

import * as generated from "@/__generated__/graphql";

function operations(): { name: string; document: DocumentNode }[] {
  const found: { name: string; document: DocumentNode }[] = [];
  for (const [key, value] of Object.entries(generated)) {
    if (!key.endsWith("Document")) continue;
    const document = value as DocumentNode;
    const operation = document.definitions.find((definition) => definition.kind === Kind.OPERATION_DEFINITION);
    if (operation?.kind !== Kind.OPERATION_DEFINITION || operation.name === undefined) continue;
    found.push({ name: operation.name.value, document });
  }
  return found;
}

function selects(document: DocumentNode, field: string): boolean {
  let hit = false;
  visit(document, {
    Field(node) {
      if (node.name.value === field) hit = true;
    },
  });
  return hit;
}

describe("the documents that read a node's citation list", () => {
  it("are the detail's own post and the two by-id reads, and nothing else", () => {
    const reading = operations()
      .filter(({ document }) => selects(document, "references"))
      .map(({ name }) => name)
      .sort();
    expect(reading).toEqual(["CommentReferences", "PostDetail", "PostReferences"]);
  });

  it("give every card read the count instead", () => {
    const cards = [
      "Feed",
      "FeedCards",
      "PostDetail",
      "PostComments",
      "CommentReplies",
      "CommentCard",
      "HistoryPage",
      "SavedPage",
      "HashtagDetail",
      "TaggedComments",
      "ProfilePosts",
      "ProfileComments",
    ];
    const byName = new Map(operations().map(({ name, document }) => [name, document]));
    for (const name of cards) {
      const document = byName.get(name);
      expect(document, name).toBeDefined();
      expect(selects(document!, "referenceCount"), name).toBe(true);
    }
  });
});
