import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { forwardedHeaders, tlsCredentials, waitForPort } from "./prod.mjs";

function certificatesDir(files) {
  const dir = mkdtempSync(path.join(tmpdir(), "cogra-prod-certs-"));
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

const listening = [];

afterEach(async () => {
  await Promise.all(
    listening.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

/** A server on an ephemeral port, so the test never fights a real one. */
function idleServer() {
  const server = createServer((_, res) => res.end());
  listening.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

describe("tlsCredentials", () => {
  it("reads the stamped pair when both halves are there", () => {
    const dir = certificatesDir({ "localhost-key.pem": "KEY", "localhost.pem": "CERT" });

    const credentials = tlsCredentials(dir);

    expect(credentials?.key.toString()).toBe("KEY");
    expect(credentials?.cert.toString()).toBe("CERT");
  });

  it("refuses rather than falling back when the machine never stamped", () => {
    // A self-signed stand-in would name neither this machine's address
    // nor the CA the guest APK pins, so there is nothing to fall back to.
    expect(tlsCredentials(certificatesDir({}))).toBeNull();
  });

  it("refuses on half a pair", () => {
    expect(tlsCredentials(certificatesDir({ "localhost.pem": "CERT" }))).toBeNull();
    expect(tlsCredentials(certificatesDir({ "localhost-key.pem": "KEY" }))).toBeNull();
  });
});

describe("forwardedHeaders", () => {
  it("tells the upstream it is being served over https at the outer host", () => {
    const headers = forwardedHeaders(
      { host: "127.0.0.1:3001", accept: "text/html" },
      { host: "192.168.0.5:3000", remoteAddress: "192.168.0.9" },
    );

    expect(headers["x-forwarded-proto"]).toBe("https");
    expect(headers["x-forwarded-host"]).toBe("192.168.0.5:3000");
    expect(headers.host).toBe("192.168.0.5:3000");
    expect(headers["x-forwarded-for"]).toBe("192.168.0.9");
    expect(headers.accept).toBe("text/html");
  });

  it("overwrites a client's own forwarding claims rather than trusting them", () => {
    // This process is the edge, so anything arriving under these names is
    // the client's assertion about itself.
    const headers = forwardedHeaders(
      { "x-forwarded-proto": "http", "x-forwarded-for": "10.0.0.1" },
      { host: "192.168.0.5:3000", remoteAddress: "192.168.0.9" },
    );

    expect(headers["x-forwarded-proto"]).toBe("https");
    expect(headers["x-forwarded-for"]).toBe("192.168.0.9");
  });

  it("survives a request that carried no remote address", () => {
    const headers = forwardedHeaders({}, { host: "localhost:3000" });

    expect(headers["x-forwarded-for"]).toBe("");
  });
});

describe("waitForPort", () => {
  it("resolves once something is accepting connections", async () => {
    const port = await idleServer();

    await expect(waitForPort(port, "127.0.0.1", { timeoutMs: 5_000 })).resolves.toBeUndefined();
  });

  it("gives up rather than hanging when nothing ever answers", async () => {
    // Port 1 needs privileges nothing here has, so it stays closed.
    await expect(waitForPort(1, "127.0.0.1", { timeoutMs: 0 })).rejects.toThrow(
      /nothing accepted a connection/,
    );
  });

  it("gives up on a port that hangs rather than refusing", async () => {
    // The case a retry loop that only re-checks the clock on failure
    // waits on forever: a discard address swallows the SYN and neither
    // accepts nor refuses.
    await expect(waitForPort(9, "192.0.2.1", { timeoutMs: 50 })).rejects.toThrow(
      /nothing accepted a connection/,
    );
  });
});
