import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { request as httpRequest } from "node:http";

import {
  forwardedHeaders,
  proxyErrorText,
  proxyHandler,
  statusForProxyError,
  tlsCredentials,
  waitForPort,
} from "./prod.mjs";

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

describe("the proxy's error mapping", () => {
  // The status is what a client and an operator act on, so a timeout must not
  // read as "the server is not there".
  it("separates a timeout from an absent upstream", () => {
    expect(statusForProxyError({ code: "ECONNREFUSED" })).toBe(502);
    expect(statusForProxyError({ code: "ENOTFOUND" })).toBe(502);
    expect(statusForProxyError({ code: "ETIMEDOUT" })).toBe(504);
  });

  // A reset mid-exchange is not the same event as a refusal, and the sentence
  // written for the refusal is only true of the refusal.
  it("says something true of the case it names", () => {
    expect(proxyErrorText({ code: "ECONNREFUSED" })).toMatch(/not answering/);
    expect(proxyErrorText({ code: "ETIMEDOUT" })).toMatch(/too long/);
    expect(proxyErrorText({ code: "ECONNRESET" })).toMatch(/was lost/);
    expect(proxyErrorText(undefined)).toMatch(/was lost/);
  });
});

/** The proxy's handler on a plain server — TLS is not what these exercise. */
function proxyOn(options) {
  const server = createServer(proxyHandler(options));
  listening.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

/** A stub upstream driven by one handler, on an ephemeral port. */
function upstreamOn(handler) {
  const server = createServer(handler);
  listening.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function get(port, path = "/") {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET" }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }),
      );
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

describe("proxyHandler", () => {
  it("passes an upstream answer through untouched", async () => {
    const upstreamPort = await upstreamOn((_, res) => {
      res.writeHead(413, { "content-type": "application/json" });
      res.end('{"error":"too large"}');
    });
    const port = await proxyOn({
      upstreamPort,
      upstreamHost: "127.0.0.1",
      apiOrigin: "http://127.0.0.1:1/graphql",
    });

    // The client is told what the API said, not what the proxy guessed.
    expect(await get(port)).toEqual({ status: 413, body: '{"error":"too large"}' });
  });

  it("answers 502 when nothing is listening upstream", async () => {
    const port = await proxyOn({
      // Port 1 needs privileges nothing here has, so the connection is refused.
      upstreamPort: 1,
      upstreamHost: "127.0.0.1",
      apiOrigin: "http://127.0.0.1:1/graphql",
    });

    const answer = await get(port);
    expect(answer.status).toBe(502);
    expect(answer.body).toMatch(/not answering/);
  });

  // The case that used to corrupt the response: the upstream's status and
  // headers were already on the wire, and the handler appended its own prose
  // onto the body — a length mismatch, or a sentence concatenated onto the
  // API's JSON error so the client's parse fails on the real reason.
  it("truncates rather than appending prose after the headers went out", async () => {
    const upstreamPort = await upstreamOn((_, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"partial":');
      res.socket.destroy();
    });
    const port = await proxyOn({
      upstreamPort,
      upstreamHost: "127.0.0.1",
      apiOrigin: "http://127.0.0.1:1/graphql",
    });

    // The connection dies rather than delivering a body the client would
    // mis-parse; either outcome is fine as long as no sentence of the proxy's
    // own reached what the upstream had already said.
    const answer = await get(port).catch(() => null);
    if (answer !== null) {
      expect(answer.body).not.toMatch(/production server/);
    }
  });

  // `/graphql` and `/media/uploads/*` go straight to the API; everything else
  // goes to `next start`.
  it("routes the API paths to the API and the rest to next", async () => {
    const seenByApi = [];
    const seenByNext = [];
    const apiPort = await upstreamOn((req, res) => {
      seenByApi.push(req.url);
      res.end("api");
    });
    const upstreamPort = await upstreamOn((req, res) => {
      seenByNext.push(req.url);
      res.end("next");
    });
    const port = await proxyOn({
      upstreamPort,
      upstreamHost: "127.0.0.1",
      apiOrigin: `http://127.0.0.1:${apiPort}/graphql`,
    });

    expect((await get(port, "/graphql")).body).toBe("api");
    expect((await get(port, "/media/uploads/abc/1")).body).toBe("api");
    expect((await get(port, "/feed")).body).toBe("next");
    expect(seenByApi).toEqual(["/graphql", "/media/uploads/abc/1"]);
    expect(seenByNext).toEqual(["/feed"]);
  });
});
