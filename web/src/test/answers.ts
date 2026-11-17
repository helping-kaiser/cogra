// WAITING FOR A MOCKED ANSWER, NEVER SLEEPING ON ONE. Under msw 3 a mocked
// request is a real round trip through undici (fetch.ts), so a fixed sleep
// before reading what the answer renders is a race a loaded runner loses.
// What should APPEAR is awaited directly (Testing Library's findBy / waitFor).
// What should stay ABSENT can only be read once the request it depends on
// has been answered and delivered, and a request sent from a timer (a
// debounced lookup) is not in flight yet when the test starts waiting. So a
// file's handlers note each answer here, and `answered` waits for that count,
// then for every in-flight body to be delivered and acted on.

import { act, waitFor } from "@testing-library/react";
import { beforeEach, expect } from "vitest";

import { settleFetches } from "./fetch";

export type AnswerLog = {
  /** Called by a handler as it answers. */
  readonly answer: () => void;
  /** How many answers this test's handlers have given. */
  readonly count: () => number;
  /** Waits until `count` answers were given and every request is delivered. */
  readonly answered: (count?: number) => Promise<void>;
};

/** A per-test log of answers; call once at a file's top level. */
export function answerLog(): AnswerLog {
  let answers = 0;
  beforeEach(() => {
    answers = 0;
  });
  return {
    answer: () => {
      answers += 1;
    },
    count: () => answers,
    answered: async (count = 1) => {
      await waitFor(() => expect(answers).toBeGreaterThanOrEqual(count));
      await act(() => settleFetches());
    },
  };
}
