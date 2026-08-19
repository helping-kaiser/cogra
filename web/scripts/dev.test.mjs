import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { httpsArgs } from "./dev.mjs";

function certificatesDir(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "cogra-certs-"));
  for (const name of files) writeFileSync(path.join(dir, name), "");
  return dir;
}

describe("httpsArgs", () => {
  it("pins Next to the stamped pair when both files are there", () => {
    const dir = certificatesDir(["localhost-key.pem", "localhost.pem"]);

    expect(httpsArgs(dir)).toEqual([
      "--experimental-https",
      "--experimental-https-key",
      path.join(dir, "localhost-key.pem"),
      "--experimental-https-cert",
      path.join(dir, "localhost.pem"),
    ]);
  });

  it("leaves Next to generate its own when the directory is empty", () => {
    expect(httpsArgs(certificatesDir([]))).toEqual(["--experimental-https"]);
  });

  it("leaves Next to generate its own when only one half is there", () => {
    expect(httpsArgs(certificatesDir(["localhost.pem"]))).toEqual(["--experimental-https"]);
    expect(httpsArgs(certificatesDir(["localhost-key.pem"]))).toEqual(["--experimental-https"]);
  });
});
