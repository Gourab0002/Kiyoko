# Kiyoko — Unofficial Sukebei Nyaa API

A fast, type-safe **Unofficial Sukebei Nyaa torrent API** built with TypeScript, [Hono](https://hono.dev/), and deployed on **Cloudflare Workers** or **Deno Deploy**.

> Inspired by [Gourab0002/Meoko](https://github.com/Gourab0002/Meoko) — adapted for [sukebei.nyaa.si](https://sukebei.nyaa.si).

## Capabilities

- 🔍 **Full-text search** across all Sukebei Nyaa categories using flexible query parameters
- 📂 **Category & sub-category browsing** — Art, Real Life
- 🧑 **User uploads** — fetch all torrents uploaded by a specific user
- 🆔 **Lookup by ID** — retrieve detailed torrent info for any Sukebei Nyaa entry
- 🔃 **Sorting & filtering** — sort by size, seeders, leechers, date, downloads, or comments; filter out remakes or show trusted-only
- 📄 **Pagination** — navigate through any result set page by page
- 🌐 **CORS-enabled** — ready for use from any browser or frontend application
- ⚡ **Edge-deployed** — runs on Cloudflare Workers or Deno Deploy for low-latency responses worldwide
- 🛡️ **Null-safe scraping** — hardened against missing DOM elements, magnet-only rows, and unexpected markup changes
- 🔁 **Mirror fallback** — tries `sukebei.nyaa.si` first, then `sukebei.nyaa.land` if the primary host is down or blocked

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

#### Endpoints

| **Category** | **Endpoint**      |
| ------------ | ----------------- |
| All          | `/all`            |
| Art          | `/art`            |
| Real Life    | `/real_life`      |
| ID           | `/id/:id`         |
| User         | `/user/:username` |

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

### Example Requests

#### Lookup by ID
```
/id/{id}
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
/user/{username}?q={search_query}&s={sort}&p={page}&o={order}&f={filter}
```

Invalid IDs, usernames, and categories return **400**. Missing torrents return **404**. Upstream Sukebei failures return **502**.

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
