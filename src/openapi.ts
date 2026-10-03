import { Constants } from "./constants.ts";

const listParameters = [
  { $ref: "#/components/parameters/q" },
  { $ref: "#/components/parameters/s" },
  { $ref: "#/components/parameters/o" },
  { $ref: "#/components/parameters/p" },
  { $ref: "#/components/parameters/f" },
  { $ref: "#/components/parameters/exclude" },
  { $ref: "#/components/parameters/envelope" },
];

const torrentSchema = {
  type: "object",
  required: ["id", "title", "magnet", "infoHash"],
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    category: { type: "string" },
    categoryId: { type: "string" },
    uploaded: { type: "string" },
    uploadedTimestamp: { type: "integer" },
    seeders: { type: "integer" },
    leechers: { type: "integer" },
    completed: { type: "integer" },
    commentCount: { type: "integer" },
    size: { type: "string" },
    sizeBytes: { type: "integer" },
    file: { type: "string", description: "Absolute .torrent URL. Present alongside magnet." },
    link: { type: "string" },
    magnet: { type: "string" },
    infoHash: { type: "string" },
    trusted: { type: "boolean" },
    remake: { type: "boolean" },
    hidden: { type: "boolean" },
    deleted: { type: "boolean" },
  },
};

const commentSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    content: { type: "string", description: "Plain text. Line breaks from br tags are kept." },
    contentHtml: {
      type: "string",
      description: "Sanitized HTML from the comment. Treat it as untrusted when rendering.",
    },
    image: { type: "string" },
    timestamp: { type: "string" },
    timestampUnix: { type: "integer" },
    edited: { type: "boolean" },
    uploader: { type: "boolean" },
    profile: { type: "string" },
  },
};

const errorSchema = {
  type: "object",
  required: ["error", "status"],
  properties: {
    error: { type: "string" },
    status: { type: "integer" },
  },
};

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Kiyoko — Unofficial Sukebei Nyaa API",
    version: Constants.Version,
    description:
      "Read-only JSON API for public Sukebei listing, view, user, and RSS pages. Category and user routes return a torrent array unless envelope=1. /search returns the envelope. X-Kiyoko-List-Shape is array or envelope. A later 2.0 will return the envelope only. exclude drops matching words. descriptionHtml and contentHtml are sanitized HTML and must be treated as untrusted. Upstream routes are limited to 60 requests per minute per client address in each Cloudflare location.",
  },
  paths: {
    "/": {
      get: {
        summary: "Liveness ping",
        responses: {
          "200": {
            description: "Plain-text liveness string",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "Mirror health",
        responses: {
          "200": { description: "At least one mirror is reachable" },
          "503": { description: "All mirrors failed. Retry-After is set." },
        },
      },
    },
    "/docs": {
      get: {
        summary: "HTML API reference",
        responses: { "200": { description: "Reference rendered from this spec" } },
      },
    },
    "/categories": {
      get: {
        summary: "Category map",
        responses: { "200": { description: "Known categories and Sukebei c= ids" } },
      },
    },
    "/search": {
      get: {
        summary: "Search torrents",
        parameters: [{ $ref: "#/components/parameters/c" }, ...listParameters, { $ref: "#/components/parameters/flat" }],
        responses: {
          "200": { description: "Listing envelope by default. flat=1 returns the torrent array." },
          "400": { description: "Invalid query, sort, order, filter, page, or category", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "429": { description: "Rate limit exceeded" },
        },
      },
    },
    "/rss": {
      get: {
        summary: "Sukebei RSS parsed as JSON",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/c" },
          { $ref: "#/components/parameters/s" },
          { $ref: "#/components/parameters/o" },
          { $ref: "#/components/parameters/f" },
          { $ref: "#/components/parameters/exclude" },
          { $ref: "#/components/parameters/u" },
          { $ref: "#/components/parameters/magnets" },
        ],
        responses: {
          "200": { description: "JSON RSS payload. file is the .torrent URL when the id is known, and magnet is kept from the feed." },
        },
      },
    },
    "/ids": {
      get: {
        summary: "Batch torrent details",
        parameters: [
          { name: "ids", in: "query", required: true, description: "Comma-separated numeric ids, max 10. Upstream fetches run 3 at a time.", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Per-id results" }, "400": { description: "Invalid id list" } },
      },
    },
    "/hash/{hash}": {
      get: {
        summary: "Torrent details by info hash",
        description: "Uses an exact view redirect when Sukebei provides one. Otherwise matches the info hash on the search listing.",
        parameters: [{ name: "hash", in: "path", required: true, description: "40-char hex or 32-char base32 info hash", schema: { type: "string" } }],
        responses: { "200": { description: "Torrent details" }, "400": { description: "Invalid info hash" }, "404": { description: "Not found" } },
      },
    },
    "/id/{id}": {
      get: {
        summary: "Torrent details by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Torrent details, including descriptionHtml and files recovered from the .torrent when the page list is too long" },
          "400": { description: "Invalid ID" },
          "404": { description: "Not found" },
        },
      },
    },
    "/id/{id}/files": {
      get: {
        summary: "Torrent file list",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "File tree and flat list. status is ok, unavailable, or too_many." } },
      },
    },
    "/id/{id}/comments": {
      get: {
        summary: "Torrent comments",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Comments, with content and contentHtml" } },
      },
    },
    "/id/{id}/trackers": {
      get: {
        summary: "Trackers from the magnet URI",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Tracker list" } },
      },
    },
    "/user/{username}": {
      get: {
        summary: "User uploads",
        parameters: [
          { name: "username", in: "path", required: true, schema: { type: "string" } },
          { $ref: "#/components/parameters/c" },
          ...listParameters,
        ],
        responses: { "200": { description: "Torrent array by default. envelope=1 adds user when the heading is present." }, "400": { description: "Invalid username or query" } },
      },
    },
    "/user/{username}/profile": {
      get: {
        summary: "Public user profile",
        parameters: [{ name: "username", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Profile fields from the user page" }, "404": { description: "User heading was not on the page" } },
      },
    },
    "/{category}": {
      get: {
        summary: "Browse a category",
        parameters: [{ name: "category", in: "path", required: true, schema: { type: "string" } }, ...listParameters],
        responses: { "200": { description: "Torrent array by default" }, "400": { description: "Unknown category or invalid query" } },
      },
    },
    "/{category}/{subcategory}": {
      get: {
        summary: "Browse a subcategory",
        parameters: [
          { name: "category", in: "path", required: true, schema: { type: "string" } },
          { name: "subcategory", in: "path", required: true, schema: { type: "string" } },
          ...listParameters,
        ],
        responses: { "200": { description: "Torrent array by default" }, "400": { description: "Unknown subcategory or invalid query" } },
      },
    },
  },
  components: {
    parameters: {
      q: { name: "q", in: "query", description: "Search query, max 200 characters", schema: { type: "string", maxLength: Constants.MaxQueryLength } },
      c: { name: "c", in: "query", description: "Sukebei id (1_2) or category path (art/doujinshi). Used on /search, /rss, and /user/{username}.", schema: { type: "string" } },
      s: { name: "s", in: "query", description: "size, seeders, leechers, date, downloads, or comments. Unknown values return 400.", schema: { type: "string" } },
      o: { name: "o", in: "query", description: "asc or desc. Unknown values return 400.", schema: { type: "string", enum: ["asc", "desc"] } },
      p: { name: "p", in: "query", description: `Page number from 1 to ${Constants.MaxPage}`, schema: { type: "integer", minimum: 1, maximum: Constants.MaxPage } },
      f: { name: "f", in: "query", description: "0=all, 1=no remakes, 2=trusted only. filter is an alias. Other values return 400.", schema: { type: "integer", enum: [0, 1, 2] } },
      exclude: { name: "exclude", in: "query", description: "Words to exclude from the search, max 200 characters", schema: { type: "string", maxLength: Constants.MaxQueryLength } },
      envelope: { name: "envelope", in: "query", description: "1 wraps list results as { torrents, page, perPage, hasNext, total, origin }", schema: { type: "string" } },
      flat: { name: "flat", in: "query", description: "1 forces /search to return a torrent array", schema: { type: "string" } },
      u: { name: "u", in: "query", description: "Uploader filter on /rss. user is an alias.", schema: { type: "string" } },
      magnets: { name: "magnets", in: "query", description: "Present or 1 to ask Sukebei for magnet links. m is an alias. The .torrent URL is still returned when the id is known.", schema: { type: "string" } },
    },
    schemas: {
      Error: errorSchema,
      Torrent: torrentSchema,
      Comment: commentSchema,
      Listing: {
        type: "object",
        required: ["torrents", "page", "perPage", "hasNext", "origin"],
        properties: {
          torrents: { type: "array", items: { $ref: "#/components/schemas/Torrent" } },
          page: { type: "integer" },
          perPage: { type: "integer" },
          hasNext: { type: "boolean" },
          total: { type: ["integer", "null"] },
          origin: { type: "string" },
          user: { $ref: "#/components/schemas/UserProfile" },
        },
      },
      UserProfile: {
        type: "object",
        properties: {
          username: { type: "string" },
          url: { type: "string" },
          level: { type: "string" },
          trusted: { type: "boolean" },
          uploadCount: { type: ["integer", "null"] },
        },
      },
      TorrentDetails: {
        type: "object",
        properties: {
          torrent: { $ref: "#/components/schemas/Torrent" },
          description: { type: "string" },
          descriptionHtml: { type: "string", description: "Sanitized HTML. Treat it as untrusted when rendering." },
          submittedBy: { type: "string" },
          information: { type: "string" },
          infoHash: { type: "string" },
          trackers: { type: "array", items: { type: "string" } },
          files: { type: "array", items: { type: "object" } },
          fileListStatus: { type: "string", enum: ["ok", "unavailable", "too_many"] },
          origin: { type: "string" },
        },
      },
    },
  },
};

interface DocParameter {
  name?: string;
  in?: string;
  required?: boolean;
  description?: string;
  schema?: { type?: string };
  $ref?: string;
}

interface DocOperation {
  summary?: string;
  description?: string;
  parameters?: DocParameter[];
  responses?: Record<string, { description?: string }>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveParameter(parameter: DocParameter): DocParameter {
  if (!parameter.$ref?.startsWith("#/components/parameters/")) {
    return parameter;
  }
  const name = parameter.$ref.slice("#/components/parameters/".length);
  return openApiSpec.components.parameters[name as keyof typeof openApiSpec.components.parameters] ?? parameter;
}

export function renderDocs(spec: typeof openApiSpec): string {
  const paths = Object.entries(spec.paths)
    .map(([path, methods]) => {
      const operation = (methods as { get?: DocOperation }).get;
      if (!operation) {
        return "";
      }
      const parameters = (operation.parameters ?? []).map(resolveParameter);
      const rows = parameters
        .map((parameter) => {
          const where = parameter.in === "path" ? "path" : "query";
          const required = parameter.required ? "required" : "optional";
          return `<tr><td><code>${escapeHtml(parameter.name ?? "")}</code></td><td>${where}</td><td>${required}</td><td>${escapeHtml(parameter.description ?? "")}</td></tr>`;
        })
        .join("");
      const responses = Object.entries(operation.responses ?? {})
        .map(([status, response]) => `<li><code>${escapeHtml(status)}</code> ${escapeHtml(response.description ?? "")}</li>`)
        .join("");
      const parameterTable = rows
        ? `<table><thead><tr><th>Name</th><th>In</th><th></th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`
        : "";
      return `<section class="path"><h2><span class="method">GET</span> <code>${escapeHtml(path)}</code></h2><p>${escapeHtml(operation.summary ?? "")}</p>${operation.description ? `<p>${escapeHtml(operation.description)}</p>` : ""}${parameterTable}<ul>${responses}</ul></section>`;
    })
    .join("");

  const schemas = Object.entries(spec.components.schemas)
    .map(
      ([name, schema]) =>
        `<section><h2><code>${escapeHtml(name)}</code></h2><pre>${escapeHtml(JSON.stringify(schema, null, 2))}</pre></section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(spec.info.title)}</title>
  <style>
    body { margin: 2rem auto; max-width: 52rem; padding: 0 1rem; color: #1c1917; font: 16px/1.5 system-ui, sans-serif; }
    h1, h2 { line-height: 1.2; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    pre { background: #f5f5f4; padding: 1rem; overflow: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; border-bottom: 1px solid #e7e5e4; padding: 0.35rem 0.5rem; vertical-align: top; }
    .method { font-weight: 700; }
    a { color: #9a3412; }
  </style>
</head>
<body>
  <h1>${escapeHtml(spec.info.title)}</h1>
  <p>Version ${escapeHtml(spec.info.version)}. Machine-readable spec: <a href="/openapi.json">/openapi.json</a>.</p>
  <p>${escapeHtml(spec.info.description)}</p>
  ${paths}
  <h2>Schemas</h2>
  ${schemas}
</body>
</html>`;
}
