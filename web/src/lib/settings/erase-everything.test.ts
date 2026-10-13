import { beforeEach, describe, expect, it } from "vitest";

import { COGRA_DATABASES, eraseEverything } from "./erase-everything";

function create(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("s");
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function names(): Promise<string[]> {
  return (await indexedDB.databases()).flatMap(({ name }) => (name === undefined ? [] : [name]));
}

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  await Promise.all((await names()).map((name) => new Promise((done) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = done;
    request.onerror = done;
  })));
});

describe("erase everything from this browser (EraseConfirm.md:21)", () => {
  it("deletes_every_cogra_database_the_seen_record_with_its_watermark_included", async () => {
    // `cogra.seen` holds the seen ids AND the sync watermark (seam 171):
    // one database, so they go together.
    for (const name of [...COGRA_DATABASES, "cogra.future", "someone.else"]) await create(name);
    await eraseEverything();
    expect(await names()).toEqual(["someone.else"]);
  });

  it("clears_the_choices_kept_here_and_the_remembered_account_and_nothing_else", async () => {
    window.localStorage.setItem("cogra.theme", "dark");
    window.localStorage.setItem("cogra.refreshToken", "r");
    window.localStorage.setItem("cogra.activeAccount", "acct-1");
    window.localStorage.setItem("cogra.stanceInputMode", "entry");
    window.sessionStorage.setItem("cogra.heldEmailChangeLink", "t");
    window.localStorage.setItem("not-ours", "kept");
    await eraseEverything();
    expect(Object.keys({ ...window.localStorage })).toEqual(["not-ours"]);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("names_the_seen_record_by_the_database_its_store_opens", () => {
    expect(COGRA_DATABASES).toContain("cogra.seen");
    expect(COGRA_DATABASES).toContain("cogra.identity");
    expect(COGRA_DATABASES).toContain("cogra.compose");
  });
});
