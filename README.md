# Kiyoko — Unofficial Sukebei Nyaa API

A fast, type-safe **Unofficial Sukebei Nyaa torrent API** built with TypeScript, [Hono](https://hono.dev/), and deployed on **Cloudflare Workers** or **Deno Deploy**.

> Inspired by [Gourab0002/Meoko](https://github.com/Gourab0002/Meoko) — adapted for [sukebei.nyaa.si](https://sukebei.nyaa.si).

## Capabilities

- 🔍 **Full-text search** across all Sukebei Nyaa categories using flexible query parameters
- 📂 **Category & sub-category browsing** — Art, Real Life
- 🧑 **User uploads** — fetch all torrents uploaded by a specific user
- 🆔 **Lookup by ID** — retrieve detailed torrent info for any Sukebei Nyaa entry
- 🔃 **Sorting & filtering** — sort by size, seeders, leechers, date, or downloads; filter out remakes or show trusted-only
- 📄 **Pagination** — navigate through any result set page by page
- 🌐 **CORS-enabled** — ready for use from any browser or frontend application
- ⚡ **Edge-deployed** — runs on Cloudflare Workers or Deno Deploy for low-latency responses worldwide
- 🛡️ **Null-safe scraping** — hardened against missing DOM elements and unexpected markup changes

## Usage

- `username` and `id` are required parameters if using `/user/{username}` and `/id/{id}` endpoints.

- If no parameters are specified in other endpoints like `/art`, `/real_life`, etc., it will return the latest uploaded torrents in the respective category.

- For Filters, input `f=1` for _No Remakes_ and `f=2` for _Trusted Only_.

### Available Endpoints

| **Arguments**      | **Description**                                       |
| ------------------ | ----------------------------------------------------- |
| `q` **(Optional)** | Search query                                          |
| `s` **(Optional)** | Sorting parameter                                     |
| `p` **(Optional)** | Page number                                           |
| `f` **(Optional)** | Filter option                                         |
| `o` **(Optional)** | Order of sorting. Defaults to **_Descending order_**. |

#### Endpoints

| **Category** | **Endpoint**   |
| ------------ | -------------- |
| All          | `/all`         |
| Art          | `/art`         |
| Real Life    | `/real_life`   |
| ID           | `/id/:id`      |
| User         | `/user/:username` |

#### Sub-Categories

| **Category** | **Sub-Category**                                      |
| ------------ | ----------------------------------------------------- |
| Art          | `/anime`, `/doujinshi`, `/games`, `/manga`, `/pictures` |
| Real Life    | `/photobooks`, `/videos`                              |

#### Sorting Parameters

| **Arguments** | **Methods**                                     |
| ------------- | ----------------------------------------------- |
| Sort (`s`)    | `size`, `seeders`, `leechers`, `date`, `downloads` |
| Order (`o`)   | `asc`, `desc`                                   |

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
deno run --allow-net src/index.ts
```

## License

[Apache 2.0](LICENSE)
