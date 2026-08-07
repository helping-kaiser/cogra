import "@testing-library/jest-dom/vitest";
// jsdom ships no IndexedDB; the identity store needs one wherever the
// registration runtime mounts.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
