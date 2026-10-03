import { Context } from "hono";
import { Constants } from "./constants.ts";
import { HttpError } from "./models.ts";
import type {
  ErrorStatus,
  FetchResult,
  MirrorStatus,
  Pagination,
  QueryParams,
} from "./models.ts";

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  byte: 1,
  bytes: 1,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
  pib: 1024 ** 5,
  kb: 1000,
  mb: 1000 ** 2,
  gb: 1000 ** 3,
  tb: 1000 ** 4,
  pb: 1000 ** 5,
};

export function isValidId(id: string): boolean {
  return /^\d+$/.test(id) && id.length <= Constants.MaxIdLength;
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_\-]{1,32}$/.test(username);
}

export function isValidInfoHash(value: string): boolean {
  return /^[a-fA-F0-9]{40}$/.test(value) || /^[A-Za-z2-7]{32}$/.test(value);
}

export function isKnownCategory(category: string): boolean {
  return Object.prototype.hasOwnProperty.call(Constants.SukebeiEndpoints, category);
}

export function isKnownSubcategory(
  category: string,
  subcategory: string | undefined
): boolean {
  if (subcategory === undefined || subcategory === "") {
    return true;
  }

  const entry = Constants.SukebeiEndpoints[category];
  return Boolean(entry && Object.prototype.hasOwnProperty.call(entry, subcategory));
}

export function getCategoryID(c: string, s: string | undefined): string {
  const endpoints = Constants.SukebeiEndpoints;
  const category = endpoints[c];

  if (!category) {
    return "0_0";
  }

  if (s === undefined || s === "") {
    return category["all"] ?? "0_0";
  }

  return category[s] ?? category["all"] ?? "0_0";
}

export function resolveCategoryParam(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const value = raw.trim();
  if (!value) {
    return undefined;
  }

  if (/^\d+_\d+$/.test(value)) {
    return value;
  }

  const parts = value.split(/[/.]/);
  const category = parts[0] ?? "";
  const subcategory = parts[1];

  if (!isKnownCategory(category)) {
    return undefined;
  }

  if (subcategory && !isKnownSubcategory(category, subcategory)) {
    return undefined;
  }

  return getCategoryID(category, subcategory);
}

function parsePage(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 1;
  }

  if (!/^\d+$/.test(value)) {
    return 1;
  }

  const digits = value.replace(/^0+(?=\d)/, "");
  if (digits.length > String(Constants.MaxPage).length || Number(digits) > Constants.MaxPage) {
    throw new HttpError(400, "Invalid page");
  }

  const page = Number(digits);
  return page > 0 ? page : 1;
}

function parseFilter(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 0;
  }

  if (!Constants.ValidFilters.has(Number(value)) || !/^\d+$/.test(value)) {
    throw new HttpError(400, "Invalid filter");
  }

  return Number(value);
}

function requireBoundedText(value: string, message: string): string {
  if (value.length > Constants.MaxQueryLength) {
    throw new HttpError(400, message);
  }
  return value;
}

function isTruthyQuery(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "" || normalized === "1" || normalized === "true" || normalized === "yes";
}

export function getSearchParameters(
  c: Context,
  options: { readCategory?: boolean } = {}
): QueryParams {
  const q = requireBoundedText(c.req.query("q") ?? "", "Query too long");
  const p = parsePage(c.req.query("p"));
  const f = parseFilter(c.req.query("f") ?? c.req.query("filter"));
  const oRaw = (c.req.query("o") ?? "").toLowerCase();
  let s = (c.req.query("s") ?? "").toLowerCase();

  if (s === "date") {
    s = "id";
  }

  if (!Constants.ValidOrders.has(oRaw)) {
    throw new HttpError(400, "Invalid order");
  }

  if (!Constants.ValidSorts.has(s)) {
    throw new HttpError(400, "Invalid sort");
  }

  const order = oRaw;
  const sort = s;
  const rawCategory = options.readCategory === false ? undefined : c.req.query("c");
  let category = "";

  if (rawCategory !== undefined && rawCategory !== "") {
    const resolved = resolveCategoryParam(rawCategory);
    if (!resolved) {
      throw new HttpError(400, "Invalid category");
    }
    category = resolved;
  }

  return {
    query: q,
    page: p,
    order,
    sort,
    filter: f,
    category,
    exclude: requireBoundedText(c.req.query("exclude") ?? "", "Query too long"),
    envelope: wantsEnvelope(c, false),
    magnets: isTruthyQuery(c.req.query("magnets")) || c.req.query("m") !== undefined,
    user: requireBoundedText(c.req.query("u") ?? c.req.query("user") ?? "", "Query too long"),
  };
}

export function wantsEnvelope(c: Context, defaultEnvelope = false): boolean {
  const envelope = (c.req.query("envelope") ?? "").toLowerCase();
  if (envelope === "1" || envelope === "true" || envelope === "yes") {
    return true;
  }
  if (envelope === "0" || envelope === "false" || envelope === "no") {
    return false;
  }

  const flat = (c.req.query("flat") ?? "").toLowerCase();
  if (flat === "1" || flat === "true" || flat === "yes") {
    return false;
  }

  return defaultEnvelope;
}

export function buildSearchQuery(
  queryParams: QueryParams,
  extras: Record<string, string> = {},
  options: { includePage?: boolean } = {}
): string {
  const params = new URLSearchParams();
  const includePage = options.includePage !== false;

  if (queryParams.query) {
    params.set("q", queryParams.query);
  }

  const category = extras.c || queryParams.category;
  if (category) {
    params.set("c", category);
  }

  if (includePage && queryParams.page > 0) {
    params.set("p", String(queryParams.page));
  }

  if (queryParams.sort) {
    params.set("s", queryParams.sort);
  }

  if (queryParams.order) {
    params.set("o", queryParams.order);
  }

  params.set("f", String(queryParams.filter));

  if (queryParams.exclude) {
    params.set("exclude", queryParams.exclude);
  }

  const user = extras.u || queryParams.user;
  if (user) {
    params.set("u", user);
  }

  for (const [key, value] of Object.entries(extras)) {
    if (key === "c" || key === "u") {
      continue;
    }
    params.set(key, value);
  }

  return params.toString();
}

export function resolveUrl(origin: string, href: string | undefined): string {
  if (!href) {
    return "";
  }

  if (
    href.startsWith("magnet:") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("data:")
  ) {
    return href;
  }

  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}

export function toCount(value: string): number {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function extractViewId(href: string | undefined): number {
  if (!href) {
    return 0;
  }

  const match = href.match(/\/view\/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function extractCategoryId(href: string | undefined): string {
  if (!href) {
    return "";
  }

  try {
    return new URL(href, Constants.SukebeiBaseUrl).searchParams.get("c") ?? "";
  } catch {
    const match = href.match(/[?&]c=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }
}

export function extractInfoHash(magnet: string | undefined): string {
  if (!magnet) {
    return "";
  }

  const match = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
  return match ? match[1] : "";
}

export function parseMagnet(magnet: string | undefined): {
  infoHash: string;
  name: string;
  trackers: string[];
} {
  if (!magnet || !magnet.startsWith("magnet:")) {
    return { infoHash: "", name: "", trackers: [] };
  }

  const query = magnet.startsWith("magnet:?") ? magnet.slice("magnet:?".length) : magnet;
  const params = new URLSearchParams(query);
  const xt = params.get("xt") ?? "";

  return {
    infoHash: xt.replace(/^urn:btih:/i, ""),
    name: params.get("dn") ?? "",
    trackers: params.getAll("tr"),
  };
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32ToHex(input: string): string {
  const clean = input.toUpperCase().replace(/=+$/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) {
      return "";
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeInfoHash(value: string): string {
  const trimmed = value.trim();
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^[A-Za-z2-7]{32}$/.test(trimmed)) {
    const hex = base32ToHex(trimmed);
    return /^[a-f0-9]{40}$/.test(hex) ? hex : "";
  }
  return "";
}

export function timeoutForAttempt(index: number): number {
  return index === 0 ? Constants.PrimaryTimeoutMs : Constants.FetchTimeoutMs;
}

export function parseSizeBytes(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const match = value.trim().match(/^([\d.,]+)\s*([A-Za-z]+)$/);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1].replace(/,/g, ""));
  const multiplier = SIZE_UNITS[match[2].toLowerCase()];
  if (!Number.isFinite(amount) || multiplier === undefined) {
    return 0;
  }

  return Math.round(amount * multiplier);
}

function isChallengePage(html: string): boolean {
  return html.includes("<title>Just a moment...</title>");
}

export function mirrors(): string[] {
  const urls = Constants.SukebeiMirrors.length
    ? Constants.SukebeiMirrors
    : [Constants.SukebeiBaseUrl, Constants.SukebeiAltUrl];
  return [...new Set(urls.filter(Boolean))];
}

export async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const buffered = new Uint8Array(await response.arrayBuffer());
    return buffered.byteLength > maxBytes ? null : buffered;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

interface WorkerCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

const CACHE_ORIGIN = "https://kiyoko.cache";

function workerCache(): WorkerCache | null {
  const host = globalThis as { caches?: { default?: WorkerCache } };
  const cache = host.caches?.default;
  if (!cache || typeof cache.match !== "function" || typeof cache.put !== "function") {
    return null;
  }
  return cache;
}

function cacheRequest(path: string): Request {
  return new Request(new URL(path, CACHE_ORIGIN));
}

async function readCachedJson<T>(path: string, check: (value: unknown) => value is T): Promise<T | null> {
  try {
    const cache = workerCache();
    if (!cache) {
      return null;
    }
    const hit = await cache.match(cacheRequest(path));
    if (!hit) {
      return null;
    }
    const value: unknown = await hit.json();
    return check(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeCachedJson(path: string, value: unknown, maxAge: number): Promise<void> {
  try {
    const cache = workerCache();
    if (!cache) {
      return;
    }
    await cache.put(
      cacheRequest(path),
      new Response(JSON.stringify(value), {
        headers: {
          "Cache-Control": `public, max-age=${maxAge}`,
          "Content-Type": "application/json",
        },
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "cache write failed",
        detail: error instanceof Error ? error.message : "cache write failed",
      })
    );
  }
}

export async function readCachedBytes(path: string): Promise<Uint8Array | null> {
  try {
    const cache = workerCache();
    if (!cache) {
      return null;
    }
    const hit = await cache.match(cacheRequest(path));
    if (!hit) {
      return null;
    }
    const bytes = new Uint8Array(await hit.arrayBuffer());
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
}

export async function writeCachedBytes(path: string, bytes: Uint8Array, maxAge: number): Promise<void> {
  try {
    const cache = workerCache();
    if (!cache) {
      return;
    }
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    await cache.put(
      cacheRequest(path),
      new Response(copy, {
        headers: {
          "Cache-Control": `public, max-age=${maxAge}`,
          "Content-Type": "application/octet-stream",
        },
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "cache write failed",
        detail: error instanceof Error ? error.message : "cache write failed",
      })
    );
  }
}

function isCachedFetch(value: unknown): value is FetchResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.html === "string" &&
    typeof record.origin === "string" &&
    typeof record.status === "number" &&
    typeof record.url === "string"
  );
}

async function fetchOrigin(
  origin: string,
  path: string,
  timeoutMs: number
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${origin}${path}`, {
      headers: {
        "User-Agent": Constants.UserAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.status === 404) {
      await response.body?.cancel();
      throw new HttpError(404, "Not Found");
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(502, `Upstream returned ${response.status} from ${origin}`);
    }

    const bytes = await readCapped(response, Constants.MaxPageBytes);
    if (!bytes) {
      throw new HttpError(502, `Upstream response too large from ${origin}`);
    }

    const html = new TextDecoder("utf-8").decode(bytes);
    if (isChallengePage(html)) {
      throw new HttpError(502, `Upstream challenge page from ${origin}`);
    }

    return {
      origin,
      html,
      status: response.status,
      url: response.url || `${origin}${path}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSukebei(
  path: string,
  cacheSeconds = Constants.ListingCacheSeconds
): Promise<FetchResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const cached = await readCachedJson(normalizedPath, isCachedFetch);
  if (cached) {
    if (cached.status === 404) {
      throw new HttpError(404, "Not Found");
    }
    return cached;
  }

  let lastError: unknown;
  const origins = mirrors();

  for (let index = 0; index < origins.length; index += 1) {
    const origin = origins[index] ?? "";
    try {
      const result = await fetchOrigin(origin, normalizedPath, timeoutForAttempt(index));
      await writeCachedJson(normalizedPath, result, cacheSeconds);
      return result;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        await writeCachedJson(
          normalizedPath,
          { origin, html: "", status: 404, url: `${origin}${normalizedPath}` },
          cacheSeconds
        );
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError instanceof HttpError) {
    throw lastError;
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new HttpError(502, "Upstream timeout");
  }

  throw new HttpError(502, "All Sukebei mirrors failed");
}

function isMirrorList(value: unknown): value is MirrorStatus[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const record = item as MirrorStatus;
      return typeof record.origin === "string" && typeof record.ok === "boolean";
    })
  );
}

export async function probeMirrors(): Promise<MirrorStatus[]> {
  const cached = await readCachedJson("/__health", isMirrorList);
  if (cached) {
    return cached;
  }

  const results = await Promise.all(
    mirrors().map(async (origin) => {
      const started = Date.now();
      try {
        await fetchOrigin(origin, "/", Constants.HealthTimeoutMs);
        return {
          origin,
          ok: true,
          status: 200,
          error: null,
          ms: Date.now() - started,
        };
      } catch (error) {
        const status = error instanceof HttpError ? error.status : null;
        return {
          origin,
          ok: false,
          status: status === 502 || status === 404 ? status : null,
          error: errorMessage(error),
          ms: Date.now() - started,
        };
      }
    })
  );

  await writeCachedJson("/__health", results, Constants.HealthCacheSeconds);
  return results;
}

export function errorStatus(error: unknown): ErrorStatus {
  if (error instanceof HttpError) {
    return error.status;
  }
  return 502;
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "Upstream timeout";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Upstream error";
}

export function jsonError(c: Context, status: ErrorStatus, message: string) {
  c.header("Cache-Control", "no-store");
  if (status === 429) {
    c.header("Retry-After", String(Constants.RateLimitRetrySeconds));
  } else if (status === 502 || status === 503) {
    c.header("Retry-After", String(Constants.UpstreamRetrySeconds));
  }
  return c.json({ error: message, status }, status);
}

export function jsonErrorFrom(c: Context, error: unknown) {
  const status = errorStatus(error);
  const message = errorMessage(error);
  if (status === 502 || status === 503) {
    console.error(JSON.stringify({ level: "error", status, message, path: c.req.path }));
  }
  return jsonError(c, status, message);
}

export function setCache(c: Context, maxAge: number): void {
  c.header("Cache-Control", `public, max-age=${maxAge}`);
}

export function setListingHeaders(
  c: Context,
  pagination: Pagination,
  origin: string,
  shape: "array" | "envelope"
): void {
  c.header("X-Page", String(pagination.page));
  c.header("X-Per-Page", String(pagination.perPage));
  c.header("X-Has-Next", pagination.hasNext ? "1" : "0");
  c.header("X-Origin", origin);
  c.header("X-Kiyoko-List-Shape", shape);
  if (pagination.total !== null) {
    c.header("X-Total", String(pagination.total));
  }
}

export function parseIdList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Math.min(Math.max(limit, 1), items.length);

  await Promise.all(
    Array.from({ length: runners }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) {
          continue;
        }
        results[index] = await worker(item, index);
      }
    })
  );

  return results;
}
