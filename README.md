# Kiyoko — Unofficial Sukebei Nyaa API

A fast, type-safe **Unofficial Sukebei Nyaa torrent API** built with TypeScript, [Hono](https://hono.dev/), and deployed on **Cloudflare Workers** or **Deno Deploy**.

> Inspired by [Gourab0002/Meoko](https://github.com/Gourab0002/Meoko) — adapted for [sukebei.nyaa.si](https://sukebei.nyaa.si).

## Capabilities

- 🔍 **Full-text search** across all Sukebei Nyaa categories using flexible query parameters
- 📂 **Category & sub-category browsing** — Art, Real Life
- 🧑 **User uploads** — fetch torrents uploaded by a specific user, optionally filtered by category
- 🆔 **Lookup by ID or info hash** — detailed torrent info, file list, comments, and trackers
- 🔃 **Sorting & filtering** — sort by size, seeders, leechers, date, downloads, or comments; filter out remakes or show trusted-only
- 🏷️ **Trusted / remake / hidden flags**, comment counts, category IDs, Unix timestamps, and size in bytes on every listing row
- 📄 **Pagination** — `p` query, `X-Page` / `X-Has-Next` headers, and an optional JSON envelope
- 📡 **RSS as JSON** — Sukebei’s native RSS feed, including trusted/remake and info hash
- 🌐 **CORS-enabled** — ready for use from any browser or frontend application
- ⚡ **Edge-deployed** — runs on Cloudflare Workers or Deno Deploy for low-latency responses worldwide
- 🛡️ **Null-safe scraping** — hardened against missing DOM elements, magnet-only rows, and unexpected markup changes
- 🔁 **Mirror fallback** — tries `sukebei.nyaa.si` first, then `sukebei.nyaa.land` if the primary host is down or blocked
- 🩺 **Health, categories, and OpenAPI** — `/health`, `/categories`, `/openapi.json`, `/docs`

## Usage

- `username` and `id` are required parameters if using `/user/{username}` and `/id/{id}` endpoints.

- If no parameters are specified in other endpoints like `/art`, `/real_life`, etc., it will return the latest uploaded torrents in the respective category.

- For filters, use `f=1` (or `filter=1`) for _No Remakes_ and `f=2` (or `filter=2`) for _Trusted Only_.

### Available Endpoints

| **Arguments**      | **Description**                                       |
| ------------------ | ----------------------------------------------------- |
| `q` **(Optional)** | Search query                                          |
| `s` **(Optional)** | Sorting parameter                                     |
| `p` **(Optional)** | Page number                                           |
| `f` **(Optional)** | Filter option (`filter` is accepted as an alias)      |
| `o` **(Optional)** | Order of sorting. Defaults to **_Descending order_**. |
| `c` **(Optional)** | Category id (`1_2`) or path (`art/doujinshi`). Used on `/search`, `/rss`, and `/user/{username}`. |
| `u` **(Optional)** | Uploader filter on `/rss`. |
| `magnets` **(Optional)** | On `/rss`, prefer magnet links (`m` is accepted as an alias). |
| `envelope` **(Optional)** | `1` wraps list results as `{ torrents, page, perPage, hasNext, total, origin }`. |
| `flat` **(Optional)** | `1` forces `/search` to return a raw array. |

#### Endpoints

| **Category** | **Endpoint**      |
| ------------ | ----------------- |
| All          | `/all`            |
| Art          | `/art`            |
| Real Life    | `/real_life`      |
| ID           | `/id/:id`         |
| ID files     | `/id/{id}/files`  |
| ID comments  | `/id/{id}/comments` |
| ID trackers  | `/id/{id}/trackers` |
| Info hash    | `/hash/{hash}`    |
| Batch IDs    | `/ids?ids=1,2,3`  |
| User         | `/user/:username` |
| User profile | `/user/{username}/profile` |
| Search       | `/search`         |
| RSS JSON     | `/rss`            |
| Categories   | `/categories`     |
| Health       | `/health`         |
| OpenAPI      | `/openapi.json`, `/docs` |

#### Sub-Categories

Sub-categories are nested under their parent: `/{category}/{sub_category}`.

| **Category** | **Sub-Category**                                           |
| ------------ | ---------------------------------------------------------- |
| Art          | `/art/anime`, `/art/doujinshi`, `/art/games`, `/art/manga`, `/art/pictures` |
| Real Life    | `/real_life/photobooks`, `/real_life/videos`               |

#### Sorting Parameters

| **Arguments** | **Methods**                                                     |
| ------------- | --------------------------------------------------------------- |
| Sort (`s`)    | `size`, `seeders`, `leechers`, `date`, `downloads`, `comments`  |
| Order (`o`)   | `asc`, `desc`                                                   |

- List endpoints (`/art`, `/user/{username}`, …) still return a **JSON array** of torrents so existing clients keep working. Pagination is also sent as `X-Page`, `X-Per-Page`, `X-Has-Next`, `X-Total`, and `X-Origin`. Pass `envelope=1` for a wrapped object. `/search` uses the envelope by default.

- Error responses are JSON: `{ "error": "Invalid ID", "status": 400 }`. Unknown subcategories now return **400** instead of silently falling back to the parent category.

### Example Requests

#### Lookup by ID
```
/id/{id}
/id/{id}/files
/id/{id}/comments
/id/{id}/trackers
/hash/{infoHash}
/ids?ids=1,2,3
```

#### Search
```
/search?q={search_query}
/search?q={search_query}&c=art/doujinshi&s=seeders&o=desc&p=2&f=2
/rss?q={search_query}&c=1_2&f=2&magnets=1
/rss?u={username}
```

#### Browse a category
```
/art?q={search_query}
/art?q={search_query}&s={sort}&p={page}&o={order}&f={filter}
```

#### Browse a sub-category
```
/art/doujinshi?q={search_query}
/art/doujinshi?q={search_query}&s={sort}&p={page}&o={order}&f={filter}
```

#### User uploads
```
/user/{username}
/user/{username}/profile
/user/{username}?q={search_query}
/user/{username}?c=art/doujinshi
/user/{username}?q={search_query}&s={sort}&p={page}&o={order}&f={filter}
```

### Listing fields

Each torrent object includes the original fields plus:

| Field | Meaning |
| --- | --- |
| `categoryId` | Sukebei `c=` id (`1_2`) |
| `uploadedTimestamp` | Unix seconds when present on the page |
| `commentCount` | Comment badge on listing rows |
| `sizeBytes` | Parsed size using binary units (`GiB` = 1024³) |
| `infoHash` | From the magnet `xt=urn:btih:` value, or RSS |
| `trusted` | Green / trusted row |
| `remake` | Red / remake row |
| `hidden` | Hidden row |
| `deleted` | Deleted row |

`/id/{id}` also returns `information`, `submitter`, `trackers`, `files`, `fileTree`, `fileListStatus`, comment ids/timestamps/edited/uploader flags, and `origin`.

## Development

```bash
# Install dependencies
npm install

# Start local dev server (Cloudflare Workers via Wrangler)
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

### Deno Deploy

```bash
deno task start
```

```bash
npm test
npm run typecheck
```

## Changelog

### 1.2.0 — Sukebei feature coverage

- **Listing flags and extra fields** — trusted/remake/hidden/deleted, comment count, category id, Unix timestamp, size in bytes, and info hash.
- **Detail pages** — file list (tree + flat), information URL, submitter profile/trusted/anonymous, magnet trackers, richer comments.
- **Pagination** — `X-Page` / `X-Has-Next` headers on every list; `envelope=1` wraps `{ torrents, page, perPage, hasNext, total, origin }`.
- **`/search`** — category-agnostic search; envelope by default (`flat=1` for a raw array). `c` accepts `1_2` or `art/doujinshi`.
- **`/rss`** — Sukebei RSS parsed to JSON; `magnets=1` (or `m`) prefers magnet links; `u` filters by uploader.
- **`/hash/{hash}`** — 40-char hex or 32-char base32 info-hash lookup.
- **`/ids?ids=`** — batch detail fetch, max 10 ids, per-id success/error.
- **`/id/{id}/files|comments|trackers`** — sub-resources of the view page.
- **User pages** — `c=` category filter; `/user/{username}/profile` for public username/level/upload count.
- **Invalid subcategory** — `/art/nope` is **400**, not silent fallback to all art.
- **JSON errors** — `{ "error", "status" }` instead of plain text.
- **`/health`**, **`/categories`**, **`/openapi.json`**, **`/docs`**.
- List endpoints still return a torrent **array** unless `envelope=1` is set.

### Reliability & scrape fixes

- **Cloudflare Workers no longer crash on boot** — `src/index.ts` now exports the Hono app for Workers and only calls `Deno.serve()` when the Deno runtime is present.
- **Mirror fallback** — requests try `sukebei.nyaa.si`, then `sukebei.nyaa.land`, and skip Cloudflare challenge pages instead of returning empty results.
- **Listing scrape no longer depends on brittle column indexes** — download/magnet links are selected by `href`, and size/date/seeders are read from the last cells so comment columns cannot shift fields.
- **Magnet-only torrents** — rows without a `.torrent` file now keep the magnet link instead of stuffing it into `file`.
- **Comment timestamps and avatars** — timestamps come from `small[data-timestamp]`; relative avatar URLs are resolved against the active mirror.
- **Detail pages ignore injected ads** — info hash is read from `<kbd>`, and Category/Date/Submitter/stats are read by label instead of `nth-child`.
- **Query parameters are encoded** — `URLSearchParams` is used so searches containing `&` or spaces cannot corrupt the upstream URL. Missing `p`/`f` no longer become `NaN`.
- **`filter` is accepted as an alias for `f`**, matching the documented filter names.
- **Invalid IDs, usernames, and categories return 400**; upstream failures return 502 instead of a blanket 404.
- **LICENSE** is Apache-2.0 as documented, and Cheerio on Workers is enabled via `nodejs_compat`.
- **CI** — `npm test` and `tsc --noEmit` run on push/PR.

## License

[Apache 2.0](LICENSE)
