import { Context } from "hono";
import { torrentEntries } from "./bencode.ts";
import { Constants } from "./constants.ts";
import type { File, ListingResponse, Torrent } from "./models.ts";
import { HttpError } from "./models.ts";
import {
  flattenFileTree,
  isViewPage,
  parseFileInfo,
  parseListing,
  parseRss,
  parseRssMeta,
  parseTorrentList,
  treeFromPaths,
} from "./parse.ts";
import {
  extractViewId,
  fetchSukebei,
  mirrors,
  normalizeInfoHash,
  readCachedBytes,
  readCapped,
  setCache,
  setListingHeaders,
  wantsEnvelope,
  writeCachedBytes,
} from "./utils.ts";

export {
  flattenFileTree,
  parseFileInfo,
  parseListing,
  parsePagination,
  parseRss,
  parseTorrentList,
  parseUserProfile,
  treeFromPaths,
} from "./parse.ts";

function listingBody(
  torrents: Torrent[],
  listing: ReturnType<typeof parseListing>,
  origin: string
): ListingResponse {
  return {
    torrents,
    page: listing.pagination.page,
    perPage: listing.pagination.perPage,
    hasNext: listing.pagination.hasNext,
    total: listing.pagination.total,
    origin,
    ...(listing.user ? { user: listing.user } : {}),
  };
}

export async function scrapeSukebei(
  c: Context,
  path: string,
  options: { username?: string; envelope?: boolean } = {}
) {
  const result = await fetchSukebei(path);
  const requestedPage = Number(c.req.query("p") ?? "1") || 1;
  const listing = parseListing(
    result.html,
    result.origin,
    requestedPage,
    options.username
  );

  const envelope = wantsEnvelope(c, options.envelope === true);
  setListingHeaders(c, listing.pagination, result.origin, envelope ? "envelope" : "array");
  setCache(c, Constants.ListingCacheSeconds);

  if (envelope) {
    return c.json(listingBody(listing.torrents, listing, result.origin));
  }

  return c.json(listing.torrents);
}

export async function scrapeRss(c: Context, path: string) {
  const result = await fetchSukebei(path);
  const torrents = parseRss(result.html, result.origin);
  const meta = parseRssMeta(result.html);

  setCache(c, Constants.ListingCacheSeconds);
  c.header("X-Origin", result.origin);

  return c.json({
    title: meta.title,
    description: meta.description,
    origin: result.origin,
    torrents,
  });
}

function fileResponse(c: Context, file: File) {
  setCache(c, Constants.DetailCacheSeconds);
  c.header("X-Origin", file.origin);
  return c.json(file);
}

function isMirrorDownload(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      mirrors().some((origin) => parsed.origin === new URL(origin).origin) &&
      /^\/download\/\d+\.torrent$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

async function readTorrent(url: string): Promise<Uint8Array | null> {
  const cachePath = `/torrent?u=${encodeURIComponent(url)}`;
  const cached = await readCachedBytes(cachePath);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Constants.PrimaryTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": Constants.UserAgent,
        Accept: "application/x-bittorrent,*/*",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const bytes = await readCapped(response, Constants.MaxTorrentBytes);
    if (!bytes) {
      return null;
    }
    await writeCachedBytes(cachePath, bytes, Constants.DetailCacheSeconds);
    return bytes;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichFileList(file: File): Promise<File> {
  if (file.fileListStatus !== "too_many" || !isMirrorDownload(file.torrent.file)) {
    return file;
  }

  const bytes = await readTorrent(file.torrent.file);
  if (!bytes) {
    return file;
  }

  const entries = torrentEntries(bytes);
  if (!entries) {
    return file;
  }

  const fileTree = treeFromPaths(entries);
  return {
    ...file,
    fileTree,
    files: flattenFileTree(fileTree),
    fileListStatus: "ok",
  };
}

export async function loadFileInfo(path: string): Promise<File> {
  const result = await fetchSukebei(path, Constants.DetailCacheSeconds);
  const fileId = extractViewId(result.url) || extractViewId(path);
  const file = parseFileInfo(result.html, result.origin, fileId);

  if (!file) {
    throw new HttpError(404, "Not Found");
  }

  return enrichFileList(file);
}

export async function loadFileInfoFromSearch(query: string): Promise<File> {
  const result = await fetchSukebei(`/?q=${encodeURIComponent(query)}`);

  if (isViewPage(result.html, result.url)) {
    const fileId = extractViewId(result.url) || extractViewId(query);
    const file = parseFileInfo(result.html, result.origin, fileId);
    if (!file) {
      throw new HttpError(404, "Not Found");
    }
    return enrichFileList(file);
  }

  const wanted = normalizeInfoHash(query);
  const match = parseTorrentList(result.html, result.origin).find((torrent) => {
    return torrent.id > 0 && wanted !== "" && normalizeInfoHash(torrent.infoHash) === wanted;
  });
  if (!match) {
    throw new HttpError(404, "Not Found");
  }

  return loadFileInfo(`/view/${match.id}`);
}

export async function fileInfoScraper(c: Context, path: string) {
  const file = await loadFileInfo(path);
  return fileResponse(c, file);
}

export async function fileSliceScraper(
  c: Context,
  path: string,
  slice: "files" | "comments" | "trackers"
) {
  const file = await loadFileInfo(path);

  setCache(c, Constants.DetailCacheSeconds);
  c.header("X-Origin", file.origin);

  if (slice === "files") {
    return c.json({
      status: file.fileListStatus,
      files: file.files,
      fileTree: file.fileTree,
    });
  }

  if (slice === "comments") {
    return c.json(file.commentInfo);
  }

  return c.json({ trackers: file.trackers, magnet: file.torrent.magnet });
}
