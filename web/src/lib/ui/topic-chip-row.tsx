// The read-only chip row (design.md §6): a post or comment card's
// current topics (`Post.topics` / `Comment.topics`), each chip
// navigating to its topic route. D8: the server already serves only
// the content author's own current tags this slice — this component
// renders exactly what it is given, with no further filtering.

import { TopicChip } from "./topic-chip";

export type TopicChipEntry = {
  readonly name: string;
  readonly pending: boolean;
};

export function TopicChipRow({
  topics,
  testIdPrefix,
}: {
  topics: readonly TopicChipEntry[];
  testIdPrefix: string;
}) {
  if (topics.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid={`${testIdPrefix}-topics`}>
      {topics.map((topic) => (
        <li key={topic.name}>
          <TopicChip
            name={topic.name}
            href={`/topics/${topic.name}`}
            pending={topic.pending}
            testId={`${testIdPrefix}-topic-${topic.name}`}
          />
        </li>
      ))}
    </ul>
  );
}
