import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import app from "../src/index.ts";
import { Constants } from "../src/constants.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const LISTING_HTML = `
<table class="table torrent-list">
  <tbody>
    <tr class="success">
      <td><a href="/?c=1_2" title="Art - Doujinshi"><img></a></td>
      <td colspan="2">
        <a href="/view/4123450">Commented Torrent</a>
      </td>
      <td class="text-center">
        <a href="/download/4123450.torrent"></a>
        <a href="magnet:?xt=urn:btih:def456"></a>
      </td>
      <td class="text-center">1.3 GiB</td>
      <td class="text-center" data-timestamp="1787059921">2026-08-18 13:32</td>
      <td class="text-center">70</td>
      <td class="text-center">2</td>
      <td class="text-center">1109</td>
    </tr>
  </tbody>
</table>
<ul class="pagination">
  <li class="active"><a>1</a></li>
  <li class="next"><a href="?p=2">Next</a></li>
</ul>
`;

const VIEW_HTML = `
<body>
  <div class="container">
    <div class="panel panel-success">
      <div class="panel-heading">
        <h3 class="panel-title">Example</h3>
      </div>
      <div class="panel-body">
        <div class="row">
          <div class="col-md-1">Category:</div>
          <div class="col-md-5"><a href="/?c=1_2">Art - Doujinshi</a></div>
          <div class="col-md-1">Date:</div>
          <div class="col-md-5" data-timestamp="1">2026-08-18 13:32 UTC</div>
        </div>
        <div class="row">
          <div class="col-md-1">Submitter:</div>
          <div class="col-md-5"><a href="/user/alice">alice</a></div>
          <div class="col-md-1">Seeders:</div>
          <div class="col-md-5">1</div>
        </div>
        <div class="row">
          <div class="col-md-1">Information:</div>
          <div class="col-md-5">No information.</div>
          <div class="col-md-1">Leechers:</div>
          <div class="col-md-5">0</div>
        </div>
        <div class="row">
          <div class="col-md-1">File size:</div>
          <div class="col-md-5">1 B</div>
          <div class="col-md-1">Completed:</div>
          <div class="col-md-5">0</div>
        </div>
        <div class="row">
          <div class="col-md-offset-6 col-md-1">Info hash:</div>
          <div class="col-md-5"><kbd>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</kbd></div>
        </div>
      </div>
      <div class="panel-footer">
        <a href="magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&amp;tr=udp://tracker.example/announce">Magnet</a>
      </div>
    </div>
    <div id="torrent-description" class="panel-body">Hi</div>
    <div class="torrent-file-list"><ul><li><i class="fa fa-file"></i>a.cbz <span class="file-size">(1 B)</span></li></ul></div>
    <div id="comments"><h3 class="panel-title">Comments - 0</h3></div>
  </div>
</body>
`;

const RSS_XML = `<?xml version="1.0"?>
<rss xmlns:nyaa="https://sukebei.nyaa.si/xmlns/nyaa" version="2.0">
  <channel>
    <title>Sukebei RSS</title>
    <description>feed</description>
    <item>
      <title>Example</title>
      <link>magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</link>
      <guid>https://sukebei.nyaa.si/view/9</guid>
      <nyaa:seeders>1</nyaa:seeders>
      <nyaa:infoHash>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</nyaa:infoHash>
      <nyaa:trusted>Yes</nyaa:trusted>
      <nyaa:remake>No</nyaa:remake>
    </item>
  </channel>
</rss>`;

async function withMockFetch(
  impl: (url: string) => Response | Promise<Response>,
  run: () => Promise<void>
) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    return impl(url);
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

function html(body: string, url: string) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html" },
    url,
  } as ResponseInit);
}

test("GET / reports that the API is alive", async () => {
  const res = await app.request("/");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "Kiyoko — Sukebei Nyaa API v1 // Alive");
  assert.equal(res.headers.get("X-Kiyoko-Version"), Constants.Version);
});

test("unknown one-segment paths are invalid categories", async () => {
  const res = await app.request("/no-such-static-route-zzzz");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "Invalid category");
});

test("GET /id/:id rejects non-numeric IDs", async () => {
  const res = await app.request("/id/12abc");
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid ID", status: 400 });
});

test("GET /user/:username rejects path-like usernames", async () => {
  const res = await app.request("/user/has.dot");
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid username", status: 400 });
});

test("GET /:category rejects unknown categories", async () => {
  const res = await app.request("/software");
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid category", status: 400 });
});

test("invalid id and subcategory return JSON errors", async () => {
  const id = await app.request("/id/nope");
  assert.equal(id.status, 400);
  assert.deepEqual(await id.json(), { error: "Invalid ID", status: 400 });

  const sub = await app.request("/art/nope");
  assert.equal(sub.status, 400);
  assert.deepEqual(await sub.json(), { error: "Invalid subcategory", status: 400 });
});

test("GET /id/:id maps upstream 404 to 404", async () => {
  globalThis.fetch = (async () =>
    new Response("missing", { status: 404 })) as typeof fetch;

  const res = await app.request("/id/999999");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not Found", status: 404 });
});

test("GET /art maps upstream failures to 502 after trying both mirrors", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("blocked", { status: 503 });
  }) as typeof fetch;

  const res = await app.request("/art");
  assert.equal(res.status, 502);
  assert.equal(calls, 2);
  const body = await res.json();
  assert.equal(body.status, 502);
  assert.equal(res.headers.get("Retry-After"), "5");
});

test("categories and openapi are served locally", async () => {
  const categories = await app.request("/categories");
  assert.equal(categories.status, 200);
  const body = await categories.json();
  assert.equal(body.categories.art.doujinshi, "1_2");

  const spec = await app.request("/openapi.json");
  assert.equal(spec.status, 200);
  const openapi = await spec.json();
  assert.equal(openapi.info.version, Constants.Version);
  assert.ok(openapi.paths["/search"]);
});

test("category listings stay arrays and expose pagination headers", async () => {
  await withMockFetch(
    () => html(LISTING_HTML, "https://sukebei.nyaa.si/?c=1_0"),
    async () => {
      const res = await app.request("/art");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body));
      assert.equal(body[0].title, "Commented Torrent");
      assert.equal(body[0].trusted, true);
      assert.equal(res.headers.get("X-Has-Next"), "1");
      assert.equal(res.headers.get("X-Page"), "1");
      assert.equal(res.headers.get("X-Kiyoko-List-Shape"), "array");
    }
  );
});

test("envelope=1 wraps listings without dropping torrent fields", async () => {
  await withMockFetch(
    () => html(LISTING_HTML, "https://sukebei.nyaa.si/?c=1_0"),
    async () => {
      const res = await app.request("/art?envelope=1");
      const body = await res.json();
      assert.equal(body.page, 1);
      assert.equal(body.hasNext, true);
      assert.equal(res.headers.get("X-Kiyoko-List-Shape"), "envelope");
      assert.equal(body.torrents[0].id, 4123450);
      assert.ok(body.origin);
    }
  );
});

test("search rejects an unknown c= value", async () => {
  const res = await app.request("/search?c=nope");
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid category", status: 400 });
});

test("search defaults to an envelope", async () => {
  await withMockFetch(
    () => html(LISTING_HTML, "https://sukebei.nyaa.si/?q=test"),
    async () => {
      const res = await app.request("/search?q=test");
      const body = await res.json();
      assert.ok(Array.isArray(body.torrents));
      assert.equal(body.torrents[0].title, "Commented Torrent");
    }
  );
});

test("rss is parsed into JSON", async () => {
  await withMockFetch(
    () =>
      new Response(RSS_XML, {
        status: 200,
        headers: { "content-type": "application/xml" },
      }),
    async () => {
      const res = await app.request("/rss?q=test&magnets=1");
      const body = await res.json();
      assert.equal(body.title, "Sukebei RSS");
      assert.equal(body.torrents[0].id, 9);
      assert.equal(body.torrents[0].trusted, true);
      assert.equal(body.torrents[0].file, "https://sukebei.nyaa.si/download/9.torrent");
      assert.equal(body.torrents[0].magnet.startsWith("magnet:?xt=urn:btih:"), true);
    }
  );
});

test("id details include files, trackers, and information", async () => {
  await withMockFetch(
    (url) =>
      html(VIEW_HTML, url.includes("/view/") ? url : "https://sukebei.nyaa.si/view/1"),
    async () => {
      const res = await app.request("/id/1");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.torrent.title, "Example");
      assert.equal(body.fileListStatus, "ok");
      assert.equal(body.files[0].name, "a.cbz");
      assert.equal(body.trackers[0], "udp://tracker.example/announce");
      assert.equal(body.information, "");

      const files = await app.request("/id/1/files");
      const fileBody = await files.json();
      assert.equal(fileBody.status, "ok");
      assert.equal(fileBody.files.length, 1);
    }
  );
});

test("hash lookup follows a view page", async () => {
  const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  await withMockFetch(
    () => html(VIEW_HTML, "https://sukebei.nyaa.si/view/1"),
    async () => {
      const res = await app.request(`/hash/${hash}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.infoHash, hash);
    }
  );
});

test("batch ids cap at 10 and return per-id results", async () => {
  const tooMany = await app.request("/ids?ids=1,2,3,4,5,6,7,8,9,10,11");
  assert.equal(tooMany.status, 400);

  await withMockFetch(
    () => html(VIEW_HTML, "https://sukebei.nyaa.si/view/1"),
    async () => {
      const res = await app.request("/ids?ids=1,2");
      const body = await res.json();
      assert.equal(body.results.length, 2);
      assert.equal(body.results[0].ok, true);
      assert.equal(body.results[0].data.torrent.title, "Example");
    }
  );
});

test("user uploads accept a category filter", async () => {
  const seen: string[] = [];
  await withMockFetch(
    (url) => {
      seen.push(url);
      return html(
        `<h3>Browsing <span class="text-success" title="Trusted">alice</span>'s torrents (1)</h3>${LISTING_HTML}`,
        url
      );
    },
    async () => {
      const res = await app.request("/user/alice?c=art/doujinshi&envelope=1");
      assert.equal(res.status, 200);
      assert.ok(seen.some((url) => url.includes("/user/alice") && url.includes("c=1_2")));
      const body = await res.json();
      assert.equal(body.user.username, "alice");
      assert.equal(body.user.trusted, true);
    }
  );
});

test("search rejects unknown sort, filter, page, and oversized queries before fetching", async () => {
  globalThis.fetch = (async () => {
    throw new Error("should not fetch");
  }) as typeof fetch;

  const sort = await app.request("/search?s=nope");
  assert.equal(sort.status, 400);
  assert.equal((await sort.json()).error, "Invalid sort");

  const filter = await app.request("/art?f=9");
  assert.equal(filter.status, 400);
  assert.equal((await filter.json()).error, "Invalid filter");

  const page = await app.request("/art?p=1001");
  assert.equal(page.status, 400);
  assert.equal((await page.json()).error, "Invalid page");

  const query = await app.request(`/search?q=${"a".repeat(201)}`);
  assert.equal(query.status, 400);
  assert.equal((await query.json()).error, "Query too long");
});

test("GET /id/:id rejects ids longer than 10 digits", async () => {
  const res = await app.request("/id/12345678901");
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "Invalid ID");
});

test("docs are self-contained HTML", async () => {
  const res = await app.request("/docs");
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(html.includes("unpkg.com"), false);
  assert.equal(html.includes("/search"), true);
  assert.equal(html.includes("exclude"), true);
  assert.equal(html.includes("descriptionHtml"), true);
});

test("openapi publishes torrent and error schemas", async () => {
  const res = await app.request("/openapi.json");
  const spec = await res.json();
  assert.equal(spec.components.schemas.Torrent.type, "object");
  assert.equal(spec.components.schemas.Error.required.includes("error"), true);
  assert.equal(JSON.stringify(spec).includes("exclude"), true);
});

test("missing user profiles return 404", async () => {
  await withMockFetch(
    () => html("<html><body><h3>Not a user</h3></body></html>", "https://sukebei.nyaa.si/user/ghost"),
    async () => {
      const res = await app.request("/user/ghost/profile");
      assert.equal(res.status, 404);
      assert.equal((await res.json()).error, "Not Found");
    }
  );
});

test("hash lookup uses a matching listing row", async () => {
  const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const listing = `
<table class="torrent-list"><tbody><tr>
  <td><a href="/?c=1_2" title="Art"></a></td>
  <td><a href="/view/42">Match</a></td>
  <td><a href="magnet:?xt=urn:btih:${hash}"></a></td>
  <td>1 MiB</td><td data-timestamp="1">date</td><td>1</td><td>0</td><td>0</td>
</tr></tbody></table>`;
  await withMockFetch(
    (url) => (url.includes("/view/") ? html(VIEW_HTML, url) : html(listing, url)),
    async () => {
      const res = await app.request(`/hash/${hash}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.torrent.id, 42);
      assert.equal(body.infoHash, hash);
    }
  );
});

test("too many files are recovered from the torrent", async () => {
  const pieces = "a".repeat(20);
  const torrent = new TextEncoder().encode(
    `d4:infod5:filesld6:lengthi2e4:pathl5:b.cbzeee4:name7:Example12:piece lengthi16384e6:pieces20:${pieces}ee`
  );
  const view = `
<body><div class="container">
  <div class="panel panel-success">
    <div class="panel-heading"><h3 class="panel-title">Packed</h3></div>
    <div class="panel-footer"><a href="/download/42.torrent">Download</a></div>
  </div>
  <div id="torrent-description" class="panel-body">Hi</div>
  <h3 class="panel-title">Too many files to display</h3>
</div></body>`;
  await withMockFetch(
    (url) =>
      url.includes("/download/")
        ? new Response(torrent, { status: 200, headers: { "content-type": "application/x-bittorrent" } })
        : html(view, url),
    async () => {
      const res = await app.request("/id/42/files");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, "ok");
      assert.equal(body.files[0].path, "Example/b.cbz");
    }
  );
});

test("rate limiter rejects upstream routes and skips health", async () => {
  let calls = 0;
  const env = {
    RATE_LIMITER: {
      limit: async () => {
        calls += 1;
        return { success: false };
      },
    },
  };

  const limited = await app.request("http://localhost/search?q=test", { headers: { "cf-connecting-ip": "1.2.3.4" } }, env);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.equal((await limited.json()).error, "Too many requests");

  await withMockFetch(
    () => new Response("ok", { status: 200 }),
    async () => {
      const health = await app.request("http://localhost/health", {}, env);
      assert.notEqual(health.status, 429);
    }
  );
  assert.equal(calls, 1);
});

test("health probes and listings are cached inside the worker", async () => {
  const store = new Map<string, Response>();
  const previous = (globalThis as { caches?: unknown }).caches;
  (globalThis as { caches?: unknown }).caches = {
    default: {
      async match(request: Request) {
        const hit = store.get(request.url);
        return hit ? hit.clone() : undefined;
      },
      async put(request: Request, response: Response) {
        store.set(request.url, response.clone());
      },
    },
  };

  let calls = 0;
  try {
    await withMockFetch(
      (url) => {
        calls += 1;
        if (url.endsWith("/") || url.endsWith(".si") || url.endsWith(".mom") || /nyaa\.(si|mom)\/?$/.test(url)) {
          return new Response("<html><title>nyaa</title></html>", { status: 200 });
        }
        return html(LISTING_HTML, url);
      },
      async () => {
        const firstHealth = await app.request("/health");
        const secondHealth = await app.request("/health");
        assert.equal(firstHealth.status, 200);
        assert.equal(secondHealth.status, 200);
        const healthCalls = calls;

        const firstList = await app.request("/art");
        const secondList = await app.request("/art");
        assert.equal(firstList.status, 200);
        assert.equal(secondList.status, 200);
        assert.equal(calls, healthCalls + 1);
      }
    );
    assert.equal(calls, 3);
  } finally {
    (globalThis as { caches?: unknown }).caches = previous;
  }
});
