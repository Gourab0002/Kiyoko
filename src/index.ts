import { Hono } from "hono";
import { cors } from "hono/cors";
import { Constants } from "./constants.ts";
import { Handlers } from "./routes.ts";
import { jsonError } from "./utils.ts";

type RateLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

type Bindings = {
  RATE_LIMITER?: RateLimiter;
};

const LOCAL_PATHS = new Set(["/", "/health", "/docs", "/openapi", "/openapi.json", "/categories"]);

function rateLimiter(env: unknown): RateLimiter | undefined {
  if (!env || typeof env !== "object") {
    return undefined;
  }
  const candidate = (env as { RATE_LIMITER?: RateLimiter }).RATE_LIMITER;
  if (!candidate || typeof candidate.limit !== "function") {
    return undefined;
  }
  return candidate;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Cache-Control", "Content-Type"],
    allowMethods: ["GET", "HEAD"],
    exposeHeaders: [
      "X-Page",
      "X-Per-Page",
      "X-Has-Next",
      "X-Total",
      "X-Origin",
      "X-Kiyoko-Version",
      "X-Kiyoko-List-Shape",
      "Retry-After",
    ],
  })
);

app.use("*", async (c, next) => {
  await next();
  c.header("X-Kiyoko-Version", Constants.Version);
});

app.use("*", async (c, next) => {
  const limiter = rateLimiter(c.env);
  if (!limiter || LOCAL_PATHS.has(c.req.path)) {
    await next();
    return;
  }

  // This API has no accounts. The client address is the only stable limiter key.
  // Cloudflare applies the binding separately in each location.
  try {
    const key = c.req.header("cf-connecting-ip") || "unknown";
    const { success } = await limiter.limit({ key });
    if (!success) {
      console.warn(JSON.stringify({ level: "warn", status: 429, path: c.req.path }));
      return jsonError(c, 429, "Too many requests");
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "rate limiter failed",
        detail: error instanceof Error ? error.message : "rate limiter failed",
        path: c.req.path,
      })
    );
  }

  await next();
});

app.get("/", Handlers.Ping);
app.get("/health", Handlers.Health);
app.get("/docs", Handlers.Docs);
app.get("/openapi.json", Handlers.OpenApi);
app.get("/openapi", Handlers.OpenApi);
app.get("/categories", Handlers.Categories);
app.get("/search", Handlers.Search);
app.get("/rss", Handlers.Rss);
app.get("/ids", Handlers.GetBatchInfo);
app.get("/hash/:hash", Handlers.GetInfoFromHash);
app.get("/id/:id/files", Handlers.GetInfoSlice);
app.get("/id/:id/comments", Handlers.GetInfoSlice);
app.get("/id/:id/trackers", Handlers.GetInfoSlice);
app.get("/id/:id", Handlers.GetInfoFromID);
app.get("/user/:username/profile", Handlers.GetUserProfile);
app.get("/user/:username", Handlers.GetUserUploads);
app.get("/:category", Handlers.GetCategoryTorrents);
app.get("/:category/:subcategory", Handlers.GetCategoryTorrents);

app.notFound((c) => jsonError(c, 404, "Not Found"));

export default app;

const deno = (
  globalThis as {
    Deno?: { serve: (options: { port: number }, handler: typeof app.fetch) => void };
  }
).Deno;

if (deno?.serve) {
  deno.serve({ port: 3000 }, app.fetch);
}
